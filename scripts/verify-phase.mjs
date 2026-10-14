#!/usr/bin/env node
// verify-phase: the only thing that decides whether a blueprint phase is done.
// zero dependencies. node 18+. lives at scripts/verify-phase.mjs in the target repo.
//
//   node scripts/verify-phase.mjs --status                 every phase, done/total, learnings entry
//   node scripts/verify-phase.mjs --phase 2                full gates for phase 2
//   node scripts/verify-phase.mjs --phase 2 --fast         parse, state, prior phases, types, lint (what the hook runs)
//   node scripts/verify-phase.mjs --phase 2 --write-receipt  writes .blueprint/receipt.json only when every gate passes
//   node scripts/verify-phase.mjs --list                   gate names
//
// exit 0 = every gate passed. exit 1 = at least one FAIL. exit 2 = harness error (no blueprint, bad args).
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = process.cwd();
const BLUEPRINT = 'blueprint.md';
const LEARNINGS = 'learnings.json';
export const RECEIPT = '.blueprint/receipt.json';
// files the gates never verify because the loop writes them after the gates run
const BOOKKEEPING = /^(blueprint\.md|learnings\.json|deviations\.md|AGENTS\.md|CLAUDE\.md|\.blueprint\/|\.agents\/|\.cursor\/|\.claude\/)/;
const IGNORED_DIRS = /(^|\/)(node_modules|dist|build|out|coverage|\.next|\.vercel|\.git)\//;

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const pass = (detail) => ({ status: 'PASS', detail });
const fail = (detail) => ({ status: 'FAIL', detail });
const skip = (detail) => ({ status: 'SKIP', detail });

// ---------------------------------------------------------------- blueprint parsing

const ID_RE = /\b([A-Z][A-Z0-9]{1,7}-\d{3})\b/g;

export function parseBlueprint(text) {
  const lines = text.split(/\r?\n/);
  const phases = [];
  const features = {};
  const ledger = new Set();
  const errors = [];
  let feature = null;
  let field = '';
  let inLedger = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = /^## (.*)/.exec(line);
    if (h2) { feature = null; field = ''; inLedger = false; continue; }
    if (/^### Completion ledger/.test(line)) { inLedger = true; feature = null; continue; }
    if (inLedger) {
      if (/^### /.test(line)) inLedger = false;
      else { const m = /^\|\s*([A-Z][A-Z0-9]{1,7}-\d{3})\s*\|/.exec(line); if (m) ledger.add(m[1]); }
      if (inLedger) continue;
    }
    const ph = /^### Phase (\d+)\s*[:.]?\s*(.*)$/.exec(line);
    if (ph) { phases.push({ n: Number(ph[1]), title: ph[2].trim(), ids: [], line: i + 1 }); feature = null; continue; }
    const fh = /^### ([A-Z][A-Z0-9]{1,7}-\d{3}):\s*(.*)$/.exec(line);
    if (fh) {
      if (features[fh[1]]) errors.push(`duplicate feature block ${fh[1]} at line ${i + 1}`);
      feature = { id: fh[1], title: fh[2].trim(), status: '', phase: '', verification: [], completed: null, line: i + 1 };
      features[fh[1]] = feature;
      field = '';
      continue;
    }
    const cur = phases[phases.length - 1];
    if (cur && !feature) {
      const ids = /^\*\*Feature IDs:\*\*\s*(.*)$/.exec(line);
      if (ids) cur.ids = (ids[1].match(ID_RE) ?? []);
    }
    if (!feature) continue;
    const st = /^\*\*Status:\*\*\s*(\w[\w ]*)/.exec(line);
    if (st) { feature.status = st[1].trim().toLowerCase(); continue; }
    const pf = /^\*\*Phase:\*\*\s*(.*)$/.exec(line);
    if (pf) { feature.phase = pf[1].trim(); continue; }
    if (/^\*\*Verification:\*\*/.test(line)) { field = 'verification'; continue; }
    const cp = /^\*\*Completed:\*\*\s*`?(.*?)`?\s*$/.exec(line);
    if (cp) {
      field = '';
      const stamp = {};
      for (const key of ['date', 'commit', 'verifier', 'deviations']) {
        const m = new RegExp(`${key}:\\s*([^/]*?)\\s*(?:/|$)`).exec(cp[1]);
        stamp[key] = m ? m[1].trim() : '';
      }
      feature.completed = stamp;
      continue;
    }
    if (/^\*\*\w/.test(line)) { field = ''; continue; }
    if (field === 'verification') {
      const ac = /^-\s*(AC-\d+):\s*(.*)$/.exec(line);
      if (ac) feature.verification.push({ ac: ac[1], text: ac[2].trim(), pending: /^pending\b/i.test(ac[2].trim()) });
    }
  }
  if (!phases.length) errors.push('no "### Phase N" headings found');
  for (const p of phases) for (const id of p.ids) if (!features[id]) errors.push(`phase ${p.n} lists ${id} but no block exists`);
  return { phases, features, ledger, errors };
}

export function loadLearnings() {
  if (!exists(LEARNINGS)) return { ok: false, error: 'learnings.json missing', phases: [] };
  try { const j = JSON.parse(read(LEARNINGS)); return { ok: true, phases: Array.isArray(j.phases) ? j.phases : [] }; }
  catch (e) { return { ok: false, error: `learnings.json does not parse: ${e.message}`, phases: [] }; }
}

export function stampFilled(stamp) {
  return !!stamp && ['date', 'commit', 'verifier', 'deviations'].every((k) => stamp[k] && stamp[k].length > 0);
}

// ---------------------------------------------------------------- tree hash

export function computeTreeHash() {
  let list;
  try {
    list = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  } catch { return null; }
  const h = createHash('sha256');
  for (const f of list.sort()) {
    if (BOOKKEEPING.test(f) || IGNORED_DIRS.test(f)) continue;
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
    h.update(f); h.update('\0'); h.update(fs.readFileSync(full)); h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------- gates

function runCmd(cmd, cmdArgs, timeout = 900000) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', timeout, shell: process.platform === 'win32' });
  const tail = ((r.stdout ?? '') + (r.stderr ?? '')).trim().split('\n').slice(-4).join(' | ').slice(0, 300);
  return r.status === 0 ? pass(`exit 0`) : fail(`exit ${r.status}: ${tail}`);
}

const pkg = (() => { try { return JSON.parse(read('package.json')); } catch { return null; } })();
const hasScript = (s) => !!(pkg && pkg.scripts && pkg.scripts[s]);

export const GATES = {
  integrity: (ctx) => {
    if (!exists(BLUEPRINT)) return fail('blueprint.md missing');
    const errs = [...ctx.bp.errors];
    if (!ctx.learn.ok) errs.push(ctx.learn.error);
    const ids = Object.keys(ctx.bp.features);
    if (!ids.length) errs.push('no feature blocks found');
    return errs.length ? fail(errs.join('; ')) : pass(`${ctx.bp.phases.length} phases, ${ids.length} features`);
  },
  'blueprint-state': (ctx) => {
    const problems = [];
    for (const f of Object.values(ctx.bp.features)) {
      const filled = stampFilled(f.completed);
      if (f.status === 'done') {
        const pend = f.verification.filter((v) => v.pending).map((v) => v.ac);
        if (pend.length) problems.push(`${f.id} is done but ${pend.join(', ')} still pending`);
        const thin = f.verification.filter((v) => !v.pending && /^pass\b/i.test(v.text) && v.text.length < 12).map((v) => v.ac);
        if (thin.length) problems.push(`${f.id} ${thin.join(', ')} says pass with no observation`);
        if (!filled) problems.push(`${f.id} is done but the completion stamp is not filled`);
        if (!ctx.bp.ledger.has(f.id)) problems.push(`${f.id} is done but has no completion ledger row`);
      } else if (filled) {
        problems.push(`${f.id} has a filled stamp but status is "${f.status || 'missing'}"`);
      } else if (ctx.bp.ledger.has(f.id)) {
        problems.push(`${f.id} is in the ledger but status is "${f.status || 'missing'}"`);
      }
    }
    return problems.length ? fail(problems.slice(0, 6).join('; ')) : pass('every done feature is verified, stamped, and in the ledger');
  },
  'prior-phases': (ctx) => {
    if (ctx.phase == null) return skip('no --phase');
    const problems = [];
    for (const p of ctx.bp.phases) {
      if (p.n >= ctx.phase) continue;
      const open = p.ids.filter((id) => ctx.bp.features[id]?.status !== 'done');
      if (open.length) problems.push(`phase ${p.n} still open: ${open.join(', ')}`);
      const entry = ctx.learn.phases.find((e) => e.id === `P${p.n}`);
      if (!entry) problems.push(`phase ${p.n} has no learnings.json entry`);
      else if (entry.status !== 'complete') problems.push(`phase ${p.n} learnings entry is "${entry.status}"`);
      else if (!Array.isArray(entry.carryForward)) problems.push(`phase ${p.n} learnings entry has no carryForward array (use [] with a "why" only when nothing generalises)`);
      // every completed phase interrogated its own deviations, even to say there were none
      const dev = read('deviations.md');
      if (!dev) problems.push('deviations.md missing (every phase appends a "## Phase N" section)');
      else if (!new RegExp(`^## Phase ${p.n}\\b`, 'm').test(dev)) problems.push(`deviations.md has no "## Phase ${p.n}" section`);
    }
    const unique = [...new Set(problems)];
    return unique.length ? fail(unique.join('; ')) : pass(`phases before ${ctx.phase} are complete, interrogated, and learned from`);
  },
  // prefer the repo's own typecheck; a solution-style tsconfig makes a bare tsc --noEmit check nothing
  types: () => hasScript('typecheck') ? runCmd('npm', ['run', 'typecheck', '--silent'])
    : exists('tsconfig.json') ? runCmd('npx', /"references"/.test(read('tsconfig.json')) ? ['tsc', '-b'] : ['tsc', '--noEmit'])
    : skip('no tsconfig'),
  lint: () => hasScript('lint') ? runCmd('npm', ['run', 'lint', '--silent']) : skip('no lint script'),
  test: () => hasScript('test') ? runCmd('npm', ['test', '--silent']) : skip('no test script'),
  build: () => hasScript('build') ? runCmd('npm', ['run', 'build', '--silent']) : skip('no build script'),
  // the playwright suite drives the running app in headless chromium; full gate only, it is too slow for the hook
  e2e: () => hasScript('test:e2e') ? runCmd('npm', ['run', 'test:e2e', '--silent']) : skip('no test:e2e script'),
  house: () => exists('scripts/house-audit.mjs') ? runCmd('node', ['scripts/house-audit.mjs', '--md-ok']) : skip('no scripts/house-audit.mjs'),
};
const FAST = ['integrity', 'blueprint-state', 'prior-phases', 'types', 'lint'];

// ---------------------------------------------------------------- commands

export function runGates({ phase, fast }) {
  const bp = parseBlueprint(read(BLUEPRINT));
  const learn = loadLearnings();
  const ctx = { bp, learn, phase };
  const results = {};
  for (const name of Object.keys(GATES)) {
    if (fast && !FAST.includes(name)) continue;
    try { results[name] = GATES[name](ctx); } catch (e) { results[name] = fail(`gate crashed: ${e.message}`); }
    if (results[name].status === 'FAIL' && name === 'integrity') break; // nothing else is trustworthy
  }
  const ok = Object.values(results).every((r) => r.status !== 'FAIL');
  let progress = null;
  if (phase != null) {
    const p = bp.phases.find((x) => x.n === phase);
    if (p) {
      const done = p.ids.filter((id) => bp.features[id]?.status === 'done');
      progress = { phase, title: p.title, featureIds: p.ids, done: done.length, total: p.ids.length, complete: done.length === p.ids.length };
    }
  }
  return { ok, results, progress, ctx };
}

function printStatus() {
  const bp = parseBlueprint(read(BLUEPRINT));
  const learn = loadLearnings();
  if (bp.errors.length) console.log('integrity: ' + bp.errors.join('; '));
  console.log('phase  done/total  learnings  title');
  for (const p of bp.phases) {
    const done = p.ids.filter((id) => bp.features[id]?.status === 'done').length;
    const e = learn.phases.find((x) => x.id === `P${p.n}`);
    const l = e ? (e.status === 'complete' ? 'complete' : e.status) : '-';
    console.log(`P${String(p.n).padEnd(5)} ${String(done).padStart(4)}/${String(p.ids.length).padEnd(6)} ${l.padEnd(10)} ${p.title}`);
  }
  const receipt = exists(RECEIPT) ? JSON.parse(read(RECEIPT)) : null;
  if (receipt) {
    const fresh = receipt.treeHash === computeTreeHash();
    console.log(`\nreceipt: phase ${receipt.phase} at ${receipt.at}, ${fresh ? 'fresh' : 'STALE (tree changed since gates ran)'}`);
  } else console.log('\nreceipt: none');
}

function main() {
  const argv = process.argv.slice(2);
  const get = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--list')) { console.log(Object.keys(GATES).join('\n')); return 0; }
  if (!exists(BLUEPRINT)) { console.error('no blueprint.md in this directory'); return 2; }
  if (argv.includes('--status')) { printStatus(); return 0; }
  const phaseArg = get('--phase');
  const phase = phaseArg != null ? Number(phaseArg) : null;
  if (phaseArg != null && !Number.isInteger(phase)) { console.error('--phase needs an integer'); return 2; }
  const fast = argv.includes('--fast');
  const { ok, results, progress } = runGates({ phase, fast });
  const w = Math.max(...Object.keys(results).map((k) => k.length));
  console.log(`verify-phase${phase != null ? ` --phase ${phase}` : ''}${fast ? ' --fast' : ''}\n`);
  for (const [k, r] of Object.entries(results)) console.log(`${r.status.padEnd(4)} ${k.padEnd(w)}  ${r.detail}`);
  if (progress) console.log(`\nphase ${progress.phase} (${progress.title}): ${progress.done}/${progress.total} done${progress.complete ? ', COMPLETE' : ''}`);
  console.log(`\n${ok ? 'GREEN' : 'RED'}`);
  if (argv.includes('--write-receipt')) {
    if (!ok) { console.log('receipt not written: a gate failed'); return 1; }
    if (fast) { console.log('receipt not written: --fast runs are not a full gate'); return 1; }
    if (phase == null) { console.log('receipt not written: --phase is required'); return 2; }
    fs.mkdirSync(path.join(ROOT, '.blueprint'), { recursive: true });
    const receipt = { phase, featureIds: progress?.featureIds ?? [], phaseComplete: !!progress?.complete, at: new Date().toISOString(), treeHash: computeTreeHash(), gates: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.status])) };
    fs.writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + '\n');
    console.log(`receipt written: ${RECEIPT}`);
  }
  return ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exit(main());
