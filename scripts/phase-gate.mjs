#!/usr/bin/env node
// phase-gate: refuses any change to blueprint.md that marks a feature done, fills a completion stamp,
// or adds a completion ledger row, unless all of these hold:
//   1. .blueprint/receipt.json exists and is under 2 hours old,
//   2. its tree hash equals the tree right now (nothing changed since the gates ran),
//   3. the feature being stamped is in the receipt's phase,
//   4. the fast gates still pass when re-run right now.
// everything else passes through untouched. lives at scripts/phase-gate.mjs and runs three ways:
//
//   node scripts/phase-gate.mjs --staged     git pre-commit (.githooks/pre-commit): every agent and every person
//   node scripts/phase-gate.mjs --install    points git at .githooks; package.json "prepare" runs it on npm install
//   node scripts/phase-gate.mjs < payload    a pre-edit hook that sends { tool_name, tool_input } on stdin
//                                            (claude code's PreToolUse today; wired by .claude/settings.json)
//
// the git hook is the contract. a pre-edit hook only catches the edit earlier, in the agents that have one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT = path.join(ROOT, '.blueprint', 'receipt.json');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-phase.mjs');
const MAX_AGE_MIN = 120;

const DONE = /\*\*Status:\*\*\s*done\b/gi;
const STAMP = /\*\*Completed:\*\*\s*`?date:\s*\S/gi;
const LEDGER = /^\|\s*[A-Z][A-Z0-9]{1,7}-\d{3}\s*\|/gm;
const count = (s, re) => (String(s ?? '').match(re) ?? []).length;
const idsNear = (s) => new Set(String(s ?? '').match(/\b[A-Z][A-Z0-9]{1,7}-\d{3}\b/g) ?? []);

/** why this change to blueprint.md must not land, or null when it may */
async function judge(before, after) {
  const adds = count(after, DONE) > count(before, DONE) || count(after, STAMP) > count(before, STAMP) || count(after, LEDGER) > count(before, LEDGER);
  if (!adds) return null;

  if (!fs.existsSync(RECEIPT)) return 'Phase gate: this change marks work complete in blueprint.md, but no gate receipt exists. Run `node scripts/verify-phase.mjs --phase <N> --write-receipt` first, and only stamp after it prints GREEN.';
  const receipt = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
  const ageMin = (Date.now() - Date.parse(receipt.at)) / 60000;
  if (!(ageMin <= MAX_AGE_MIN)) return `Phase gate: the receipt is ${Math.round(ageMin)} minutes old (limit ${MAX_AGE_MIN}). Re-run the gates.`;

  let mod;
  try { mod = await import(pathToFileURL(VERIFIER).href); } catch (e) { return `Phase gate: cannot load scripts/verify-phase.mjs (${e.message}).`; }
  if (mod.computeTreeHash() !== receipt.treeHash) return `Phase gate: the tree changed since the gates ran (receipt hash differs). Re-run \`node scripts/verify-phase.mjs --phase ${receipt.phase} --write-receipt\`.`;

  const newIds = [...idsNear(after)].filter((id) => !idsNear(before).has(id) || count(after, DONE) > count(before, DONE));
  const outside = newIds.filter((id) => !receipt.featureIds.includes(id));
  if (newIds.length && outside.length === newIds.length) return `Phase gate: ${outside.join(', ')} is not in the receipt's phase (${receipt.phase}: ${receipt.featureIds.join(', ')}). Gate the right phase first.`;

  try {
    execFileSync('node', [VERIFIER, '--phase', String(receipt.phase), '--fast'], { cwd: ROOT, stdio: 'pipe', timeout: 600000 });
  } catch (e) {
    const tail = (e.stdout?.toString() ?? '').trim().split('\n').slice(-6).join('\n');
    return `Phase gate: fast gates are red right now.\n${tail}`;
  }
  return null;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const gitOr = (fallback, ...args) => { try { return git(...args); } catch { return fallback; } };

if (process.argv.includes('--install')) {
  // never fails an install: outside a git checkout (a vercel build) or beside another hook manager, it does nothing
  const inside = gitOr('', 'rev-parse', '--is-inside-work-tree').trim() === 'true';
  const current = gitOr('', 'config', '--get', 'core.hooksPath').trim();
  if (inside && fs.existsSync(path.join(ROOT, '.githooks', 'pre-commit')) && (!current || current === '.githooks')) {
    gitOr('', 'config', 'core.hooksPath', '.githooks');
  }
  process.exit(0);
}

if (process.argv.includes('--staged')) {
  // git pre-commit: compare the staged blueprint.md with the one in HEAD
  const staged = gitOr('', 'diff', '--cached', '--name-only', '--diff-filter=AM').split('\n');
  if (!staged.includes('blueprint.md')) process.exit(0);
  const reason = await judge(gitOr('', 'show', 'HEAD:blueprint.md'), gitOr('', 'show', ':blueprint.md'));
  if (reason) { process.stderr.write(`${reason}\nThe commit was stopped. Never bypass this with --no-verify.\n`); process.exit(1); }
  process.exit(0);
}

// pre-edit hook: { tool_name, tool_input } on stdin; anything it cannot read passes, the git hook still guards the commit
let payload;
try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
const tool = payload.tool_name ?? '';
const input = payload.tool_input ?? {};
const filePath = String(input.file_path ?? '').replace(/\\/g, '/');
if (!/(^|\/)blueprint\.md$/.test(filePath)) process.exit(0);

let before = '', after = '';
if (tool === 'Edit') { before = input.old_string; after = input.new_string; }
else if (tool === 'Write') { try { before = fs.readFileSync(input.file_path, 'utf8'); } catch { before = ''; } after = input.content; }
else process.exit(0);

const reason = await judge(before, after);
if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
process.exit(0);
