#!/usr/bin/env node
// house-audit: deterministic check of one repo against the Calabro house rules.
// zero dependencies. node 18+. run from the repo root:
//   node house-audit.mjs            human table, exit 1 on any FAIL
//   node house-audit.mjs --json     machine output for /house-audit and verify-phase
//   node house-audit.mjs --md-ok    downgrade em dashes in .md files to WARN
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const MD_OK = args.has('--md-ok');

// ---------------------------------------------------------------- helpers

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const pass = (detail) => ({ status: 'PASS', detail });
const fail = (detail) => ({ status: 'FAIL', detail });
const warn = (detail) => ({ status: 'WARN', detail });
const skip = (detail) => ({ status: 'SKIP', detail });

// first-party files: tracked plus untracked-not-ignored, minus vendored and generated paths
function firstPartyFiles() {
  let list = [];
  try {
    list = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT })
      .toString().split('\0').filter(Boolean);
  } catch {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { if (!/^(node_modules|\.git)$/.test(e.name)) walk(full); }
        else list.push(path.relative(ROOT, full).replace(/\\/g, '/'));
      }
    };
    walk(ROOT);
  }
  const EXCLUDE = /(^|\/)(node_modules|dist|build|out|coverage|\.next|\.vercel|vendor|third_party|upstream|raw-orig|\.blueprint)\//;
  const LOCK = /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.min\.(js|css))$/;
  return list.filter((f) => !EXCLUDE.test(f) && !LOCK.test(f) && fs.existsSync(path.join(ROOT, f)));
}

const BINARY_RE = /\.(png|jpe?g|gif|webp|avif|ico|svg|pdf|woff2?|ttf|otf|mp[34]|wav|ogg|m4a|aac|zip|db|sqlite|lockb?)$/i;
const ALL = firstPartyFiles();
const FILES = ALL.filter((f) => !BINARY_RE.test(f));
const pkg = (() => { try { return JSON.parse(read('package.json')); } catch { return null; } })();
// the audit's own tooling and the loop files are not the app: an installed copy of this script holds
// the very regexes the checks look for, so they must never count as evidence
const TOOLING = /^(scripts\/(house-audit|verify-phase|phase-gate)\.mjs|blueprint\.md|skill-library\/|\.githooks\/|\.agents\/|\.claude\/|\.cursor\/)/;
const CODE = FILES.filter((f) => !TOOLING.test(f) && /\.(tsx?|jsx?|mjs|cjs|html|css|scss|vue|svelte|astro|py|dart)$/.test(f));
const DOCS = FILES.filter((f) => /\.(md|mdx|txt)$/.test(f));

function grepFiles(files, re) {
  const hits = [];
  for (const f of files) {
    const text = read(f);
    if (!text) continue;
    text.split(/\r?\n/).forEach((line, i) => { if (re.test(line)) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) }); });
  }
  return hits;
}

// like grepFiles, but over code with comments removed, so a comment that mentions a feature is not evidence of it
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}
function grepCode(files, re) {
  const hits = [];
  for (const f of files) {
    const text = read(f);
    if (!text) continue;
    stripComments(text).split(/\r?\n/).forEach((line, i) => { if (re.test(line)) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) }); });
  }
  return hits;
}

// a package that ships a bin and no page is a cli or server; the footer, theme, and seo rules are for apps
const isCli = !!(pkg && pkg.bin) && !exists('index.html') && !exists('app') && !exists('src/app') && !exists('pages') && !exists('public');
const isApp = !isCli && (exists('index.html') || exists('app') || exists('src/app') || exists('pages') || exists('src') || exists('next.config.js') || exists('next.config.ts') || exists('vite.config.ts') || exists('vite.config.js'));

// ---------------------------------------------------------------- checks

const checks = {};

checks['version-format'] = () => {
  if (!pkg) return isApp ? warn('no package.json; first ship creates one at 0.0.1 (house rule)') : skip('no package.json and not an app');
  const v = String(pkg.version ?? '');
  if (!/^\d+\.\d+\.\d+$/.test(v)) return fail(`package.json version "${v}" is not MAJOR.MINOR.PATCH`);
  if (v === '0.0.0') return warn('version is 0.0.0; first ship bumps to 0.0.1');
  return pass(`v${v}`);
};

// a footer line, not a json-ld author name: the copyright symbol or the "name - v" shape must be on the same line
const FOOTER_LINE = /©.*Bryan J\. Calabro|Bryan J\. Calabro\s*[-\u2013\u2014\u00b7|]\s*(v|\{|\$\{|["'`+])/;
const footerFiles = CODE.filter((f) => read(f).split(/\r?\n/).some((l) => FOOTER_LINE.test(l)) && !/\.test\.|\.spec\./.test(f));

checks['footer-present'] = () => {
  if (!isApp) return skip('not an app repo');
  if (footerFiles.length === 0) return fail('no source file renders "Bryan J. Calabro"; add the house footer');
  return pass(footerFiles.join(', '));
};

checks['footer-format'] = () => {
  if (!isApp) return skip('not an app');
  if (footerFiles.length === 0) return skip('no footer');
  const problems = [];
  for (const f of footerFiles) {
    const t = read(f);
    if (/©\s*20\d\d\s+Bryan J\. Calabro/.test(t)) problems.push(`${f}: year is hardcoded`);
    if (/Bryan J\. Calabro\s*-\s*v\d+\.\d+\.\d+/.test(t) && !/\.html$/.test(f)) problems.push(`${f}: version is hardcoded`);
    if (/Bryan J\. Calabro\s*[\u2013\u2014\u00b7|]/.test(t)) problems.push(`${f}: separator must be a plain hyphen`);
    if (/Bryan J\. Calabro\s*-\s*v\.\d/.test(t)) problems.push(`${f}: "v.0.1.0" form; write v0.1.0`);
    const hasYear = /getFullYear\(\)/.test(t) || /getFullYear\(\)/.test(CODE.map(read).join('\n'));
    if (!hasYear) problems.push(`${f}: no getFullYear() feeding the year`);
    const hasVersion = /(pkg|packageJson|package)\.version|__APP_VERSION__|npm_package_version|APP_VERSION|VITE_APP_VERSION|import\.meta\.env\.\w*VERSION|version\.json|\bversion\b/.test(t);
    if (!hasVersion) problems.push(`${f}: version is not read from package.json`);
  }
  return problems.length ? fail(problems.join('; ')) : pass('year from clock, version from package.json, hyphen separator');
};

checks['footer-link'] = () => {
  if (!isApp) return skip('not an app');
  if (footerFiles.length === 0) return skip('no footer');
  const problems = [];
  for (const f of footerFiles) {
    const t = read(f);
    if (!/https:\/\/bryancalabro\.com\/?["'`]/.test(t)) problems.push(`${f}: footer must link to https://bryancalabro.com`);
    const footerBlock = t.split(/\r?\n/).filter((l) => /Bryan J\. Calabro/.test(l)).join('\n');
    if (/hover:/.test(footerBlock)) problems.push(`${f}: footer link carries hover styling`);
  }
  return problems.length ? fail(problems.join('; ')) : pass('whole line links to bryancalabro.com');
};

checks['footer-version-sync'] = () => {
  if (!isApp) return skip('not an app');
  if (!pkg || footerFiles.length === 0) return skip('needs package.json and a footer');
  // static apps read version.json and fall back to a literal when the fetch fails; boids shipped 0.0.2 with a 0.0.1 fallback
  const fallback = footerFiles.map(read).join('\n').match(/FALLBACK_VERSION\s*=\s*["'](\d+\.\d+\.\d+)["']/);
  if (fallback && fallback[1] !== pkg.version) return fail(`FALLBACK_VERSION is ${fallback[1]} but package.json is ${pkg.version}`);
  const literal = footerFiles.map(read).join('\n').match(/Bryan J\. Calabro\s*-\s*v(\d+\.\d+\.\d+)/);
  if (!literal) return pass(fallback ? `fallback v${fallback[1]} matches package.json` : 'no literal version in footer (derived at build)');
  return literal[1] === pkg.version ? pass(`footer v${literal[1]} matches package.json`) : fail(`footer v${literal[1]} but package.json is ${pkg.version}`);
};

checks['em-dash'] = () => {
  const EM = new RegExp(String.fromCharCode(0x2014));
  // inventory-catalog.test.mjs pins a real build prompt fixture (an em dash included) to prove build
  // prompts survive a render/parse round trip verbatim; the em dash there is a recording, not authored code
  const CODE_EXEMPT = /^skill-library\/inventory\/inventory\/inventory-catalog\.test\.mjs$/;
  const code = grepFiles(CODE.concat(FILES.filter((f) => /\.(json|ya?ml|toml)$/.test(f) && !/package(-lock)?\.json$/.test(f))).filter((f) => !CODE_EXEMPT.test(f)), EM);
  // specs/app-inventory/ records carry build prompts verbatim from the catalog; a recording is excluded, never rewritten
  const docs = grepFiles(DOCS.filter((f) => !/^specs\/app-inventory\//.test(f)), EM);
  const sample = (h) => h.slice(0, 3).map((x) => `${x.file}:${x.line}`).join(', ');
  // a test that bans the character usually spells it; say how to build it instead (overhead P2)
  const hint = code.some((x) => /\.test\.[cm]?[jt]sx?$/.test(x.file)) ? '; in a test, build it with String.fromCharCode(0x2014)' : '';
  if (code.length) return fail(`${code.length} in code/markup (${sample(code)})${docs.length ? `; ${docs.length} in docs` : ''}${hint}`);
  if (docs.length) return MD_OK ? warn(`${docs.length} in docs (${sample(docs)})`) : fail(`${docs.length} in docs (${sample(docs)})`);
  return pass('none');
};

// zero-width and bidi control characters draw nothing, so a diff never shows them. agent file tools
// have written them by decoding a unicode escape into the character it names (ampersand P0 and P1).
// built from code points, so this file never holds the characters it hunts. WARN, not FAIL: a
// literal emoji sequence legitimately carries a zero width joiner.
const INVISIBLE_POINTS = [[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff]];
const INVISIBLE = new RegExp(`[${INVISIBLE_POINTS.map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('')}]`);
checks['invisible-chars'] = () => {
  const files = CODE.concat(DOCS).filter((f) => !/^specs\/app-inventory\//.test(f));
  const hits = grepFiles(files, INVISIBLE).filter((h) => !(h.line === 1 && read(h.file).indexOf(String.fromCharCode(0xfeff)) === 0 && !INVISIBLE.test(read(h.file).split(/\r?\n/)[0].slice(1))));
  if (!hits.length) return pass('none');
  return warn(`${hits.length} line(s) with a zero-width or bidi character (${hits.slice(0, 3).map((x) => `${x.file}:${x.line}`).join(', ')}); write it as an escape`);
};

// ai tells in the copy people read: page markup and readme. mirrors the hard rules of
// writing/humanize/humanize-scan.mjs (em dashes have their own check above); this script is copied
// into app repos alone, so the rules live here too and house-audit.test.mjs keeps them in step.
// dash and chatbot phrasing FAIL; a cluster of filler words and contrasts is a WARN.
const EN_DASH = String.fromCharCode(0x2013);
const AI_HARD = [
  // a spaced dash with a number on either side is a range ("9 am - 5 pm"), not a clause break
  { id: 'dash-punct', what: 'en dash or double hyphen used as a clause break', re: new RegExp(`(?<!\\d)\\s(?:${EN_DASH}|--)\\s(?!\\d)`, 'g') },
  { id: 'chatbot', what: 'chatbot residue', re: /\b(?:i hope this helps|great question|as an ai|i'?d be happy to|happy to help|feel free to|let me know if you|here'?s a (?:breakdown|quick overview|summary)|certainly!|absolutely!|i apologize for|as of my (?:last|knowledge)|in this (?:article|post|guide), (?:we|i) will)/gi },
];
const AI_SOFT = /\b(?:delve|delves|delving|tapestry|realm|leverage|leverages|leveraging|utilize|utilizes|utilizing|unlock|unlocks|unlocking|empower|empowers|empowering|seamless|seamlessly|robust|holistic|multifaceted|pivotal|crucial|paramount|transformative|revolutionary|groundbreaking|cutting-edge|game-changer|game-changing|unparalleled|elevate|elevates|foster|fosters|fostering|showcase|showcases|showcasing|underscore|underscores|meticulous|meticulously|vibrant|bustling|embark|synergy|furthermore|moreover|in conclusion|in today'?s (?:fast-paced|digital|modern) (?:world|landscape|age)|a testament to|at its core|plays? an? (?:pivotal|crucial|key|vital) role|not (?:just|only|merely) [^.;!?]{1,40}, but\b|the (?:result|answer|catch|kicker|best part)\?)/gi;
// soft tells worth a look: at least this many, and at least this many per thousand words
const AI_SOFT_MIN = 5;
const AI_SOFT_PER_1K = 6;

// the prose inside a page file: text between tags and string literals of three words or more, with
// comments, code in backticks, and urls left out. class lists never hold three plain words in a row.
function copyOf(file) {
  let text = read(file);
  if (/\.md$/i.test(file)) {
    return text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, (m) => m.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/^>.*$/gm, ' ');
  }
  text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/https?:\/\/\S+/g, ' ');
  return text.split(/\r?\n/).map((line) => {
    if (/^\s*(\/\/|\*|#(?!\w))/.test(line)) return '';
    const bits = [];
    for (const m of line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) bits.push(m[1]);
    for (const m of line.matchAll(/(["'])((?:(?!\1)[^\\]|\\.)*)\1/g)) if (/[A-Za-z]{2,} [a-z]{2,} [a-z]{2,}/.test(m[2])) bits.push(m[2]);
    // a whole line of jsx text sits between tags that open and close on other lines
    if (/\.(tsx|jsx|html|vue|svelte|astro)$/.test(file) && !/[<>{}=;()]/.test(line) && /[A-Za-z]{2,} [a-z]{2,} [a-z]{2,}/.test(line)) bits.push(line);
    return bits.join('  ');
  }).join('\n');
}

checks['ai-tells'] = () => {
  if (!isApp) return skip('not an app');
  const pages = CODE.filter((f) => /\.(tsx|jsx|html|vue|svelte|astro)$/.test(f) && !/\.(test|spec)\.|(^|\/)(e2e|tests?|__tests__)\//.test(f));
  const files = pages.concat(DOCS.filter((f) => /^README\.md$/i.test(f)));
  const hard = [];
  let soft = [];
  let words = 0;
  for (const f of files) {
    const lines = copyOf(f).split('\n');
    lines.forEach((line, i) => {
      words += (line.match(/\b[A-Za-z][\w'-]*\b/g) || []).length;
      for (const rule of AI_HARD) for (const m of line.matchAll(rule.re)) hard.push({ file: f, line: i + 1, rule: rule.id, match: m[0].trim() });
      for (const m of line.matchAll(AI_SOFT)) soft.push({ file: f, line: i + 1, match: m[0] });
    });
  }
  const at = (h) => h.slice(0, 3).map((x) => `${x.file}:${x.line} "${x.match}"`).join(', ');
  if (hard.length) {
    const inCode = hard.filter((h) => !/\.md$/i.test(h.file));
    const detail = `${hard.length} hard tell(s) in copy (${at(hard)}); rewrite with /humanize`;
    return inCode.length || !MD_OK ? fail(detail) : warn(detail);
  }
  const per1k = words ? (soft.length * 1000) / words : 0;
  if (soft.length >= AI_SOFT_MIN && per1k >= AI_SOFT_PER_1K) return warn(`${soft.length} filler words or contrasts in ${words} words of copy (${per1k.toFixed(1)} per 1k: ${at(soft)}); run /humanize scan`);
  return pass(`${words} words of copy, no hard tells${soft.length ? `, ${soft.length} soft` : ''}`);
};

// house rules calabrodesign has since retired; an app repo still carrying one blocks the current rules
// (lunar's and har-view's forbade the Playwright checks the house now requires, 2026-09-27)
const RETIRED_HOUSE_LINES = [
  [/never add an agent name as co-author/i, 'forbids agent co-authors'],
  [/do not use chromium, playwright|never drive this app with playwright/i, 'forbids the Playwright checks the house now requires'],
  // the house has no CI: gates run locally and /new-app merges the first build PR itself (gambit P4)
  [/greenfield-merge/i, 'describes the retired greenfield-merge job'],
  [/spec in `?e2e\/`? that CI runs/i, 'says CI runs the e2e suite, where the gates now run locally'],
];

checks['agents-md'] = () => {
  if (!exists('AGENTS.md')) return fail('no AGENTS.md at root; run /house-audit fix to add the house rules');
  const a = read('AGENTS.md');
  const missing = ['### Footer', '### Version bumps', '### Agent rule files', '### Git'].filter((h) => !a.includes(h));
  if (missing.length) return warn(`AGENTS.md lacks house sections: ${missing.join(', ')}`);
  const retired = RETIRED_HOUSE_LINES.filter(([re]) => re.test(a)).map(([, why]) => why);
  // run from calabrodesign, the canonical block sits beside this script; a copy in an app repo skips this half
  let stale = [];
  try {
    const canonical = fs.readFileSync(new URL('./AGENTS.house.md', import.meta.url), 'utf8');
    stale = [...canonical.matchAll(/^#{2,3} .+$/gm)].map((m) => m[0].trim()).filter((h) => !a.includes(h));
  } catch { /* copied into an app repo alone: only the retired-line half runs */ }
  if (retired.length || stale.length) {
    return warn(`AGENTS.md house block is out of date (${[...retired, ...(stale.length ? [`missing ${stale.slice(0, 3).join(', ')}`] : [])].join('; ')}); replace it with AGENTS.house.md from calabrodesign`);
  }
  return pass('house sections present and current');
};

checks['claude-md-wiring'] = () => {
  if (!exists('CLAUDE.md')) return exists('AGENTS.md') ? fail('CLAUDE.md missing; it must contain only @AGENTS.md') : skip('no rule files yet');
  const body = read('CLAUDE.md').replace(/^#\s*CLAUDE\.md\s*$/m, '').trim();
  return body === '@AGENTS.md' ? pass('wiring only') : fail('CLAUDE.md carries content beyond @AGENTS.md');
};

checks['secrets'] = () => {
  let tracked = [];
  try { tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0'); } catch { /* not a git repo, so there is nothing tracked to check */ }
  const envs = tracked.filter((f) => /(^|\/)\.env(\.local|\.production|\.development)?$/.test(f));
  const keyRe = /(sk-[A-Za-z0-9]{20,}|xai-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY)/;
  const hits = grepFiles(FILES.filter((f) => !/\.example$/.test(f)), keyRe);
  if (envs.length || hits.length) return fail([envs.length && `tracked env files: ${envs.join(', ')}`, hits.length && `key-shaped strings: ${hits.slice(0, 3).map((h) => `${h.file}:${h.line}`).join(', ')}`].filter(Boolean).join('; '));
  return pass('no tracked .env, no key-shaped strings');
};

checks['theme-tokens'] = () => {
  if (!isApp) return skip('not an app');
  const t = grepCode(CODE, /prefers-color-scheme/);
  return t.length ? pass(`${t.length} reference(s)`) : warn('no prefers-color-scheme; house apps ship real light and dark tokens');
};

checks['reduced-motion'] = () => {
  if (!isApp) return skip('not an app');
  const anim = grepCode(CODE, /@keyframes|transition:|animation:|framer-motion|requestAnimationFrame/);
  if (!anim.length) return pass('no animation found');
  const rm = grepCode(CODE, /prefers-reduced-motion/);
  return rm.length ? pass('honored') : warn(`animation present (${anim.length} sites) but no prefers-reduced-motion`);
};

checks['seo-files'] = () => {
  if (!isApp) return skip('not an app');
  // ALL, not FILES: an og image is a binary, and FILES has the binaries filtered out
  const has = (re) => ALL.some((f) => re.test(f));
  const missing = [];
  if (!has(/(^|\/)sitemap\.(xml|ts|js)$/)) missing.push('sitemap');
  if (!has(/(^|\/)robots\.(txt|ts|js)$/)) missing.push('robots');
  if (!has(/(^|\/)og(-image)?\.(png|jpe?g|webp)$/i) && !has(/opengraph-image\./)) missing.push('og image');
  return missing.length ? warn(`missing ${missing.join(', ')}; run /seo-agent`) : pass('sitemap, robots, og image');
};

checks['scripts'] = () => {
  if (!pkg) return skip('no package.json');
  const s = pkg.scripts ?? {};
  const missing = ['build', 'lint', 'test'].filter((k) => !s[k]);
  if (missing.includes('build') && isApp) return fail(`no build script`);
  return missing.length ? warn(`no ${missing.join('/')} script`) : pass('build, lint, test');
};

checks['ts-strict'] = () => {
  if (!exists('tsconfig.json')) return skip('no tsconfig');
  const t = read('tsconfig.json');
  // a solution-style root ("files": [] plus references) makes a bare tsc --noEmit pass without reading a file
  if (/"files"\s*:\s*\[\s*\]/.test(t) && !/"include"\s*:/.test(t)) {
    const typecheck = String(pkg?.scripts?.typecheck ?? '');
    if (!/tsc\b[^&|;]*(-b|--build)\b/.test(typecheck)) return fail('solution-style tsconfig.json but no typecheck script running tsc -b; tsc --noEmit at the root checks nothing');
    // create-vite leaves strict off on the root; pass when every referenced project sets it (erd P0)
    const refs = [...t.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    if (refs.length) {
      const missing = refs.filter((rel) => {
        const p = rel.endsWith('.json') ? rel : `${rel}.json`;
        return !exists(p) || !/"strict"\s*:\s*true/.test(read(p));
      });
      if (!missing.length) return pass(`strict in ${refs.length} referenced project(s)`);
      return warn(`solution-style root: strict missing in ${missing.slice(0, 3).join(', ')}`);
    }
  }
  return /"strict"\s*:\s*true/.test(t) ? pass('strict') : warn('tsconfig strict is off');
};

// line numbers of every caches.match / cache.match call whose options do not set ignoreVary, read
// either inline or through a const the file defines (calabrodesign src/sw.js passes MATCH)
function matchesWithoutIgnoreVary(text) {
  const misses = [];
  const re = /\bcaches?\.match\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    const args = text.slice(m.index + m[0].length, i - 1);
    if (/ignoreVary\s*:\s*true/.test(args)) continue;
    const named = [...args.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map((x) => x[1]);
    if (named.some((n) => new RegExp(`\\b${n}\\s*=\\s*\\{[^}]*ignoreVary\\s*:\\s*true`).test(text))) continue;
    misses.push(text.slice(0, m.index).split('\n').length);
  }
  return misses;
}

checks['offline-precache'] = () => {
  if (!isApp) return skip('not an app');
  const viteConfig = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].find(exists);
  if (viteConfig) {
    // hashed bundle names change every build, so a hand-kept list in public/ goes stale on the next deploy
    if (exists('public/sw.js')) return warn('public/sw.js is a hand-kept worker in a Vite app; emit it from a build plugin that reads the bundle');
    // vite-plugin-pwa emits sw.js by default without naming it, so the plugin call counts too (rewind, compound)
    if (/sw\.js|VitePWA\s*\(/.test(read(viteConfig))) {
      // a plugin that reads a hand-written worker source (reps: sw/service-worker.js) is judged by that
      // source's own matches, since the config naming ignoreVary proves nothing about the worker
      const sources = [...read(viteConfig).matchAll(/['"`]([\w./-]+\.(?:m?js|ts))['"`]/g)].map((m) => m[1].replace(/^\.\//, ''))
        .filter((f, i, a) => a.indexOf(f) === i && f !== viteConfig && exists(f) && /\bcaches?\.match\s*\(/.test(read(f)));
      if (sources.length) {
        const misses = sources.flatMap((f) => matchesWithoutIgnoreVary(read(f)).map((line) => `${f}:${line}`));
        if (misses.length) return warn(`${misses.length} cache match(es) without ignoreVary (${misses.slice(0, 3).join(', ')}); offline cors assets miss under Vary: Origin (erd D1)`);
        return pass(`worker emitted by ${viteConfig} from ${sources.join(', ')}, every match ignores Vary`);
      }
      // cors module scripts carry Origin; Vary: Origin on the host makes offline matches miss without this
      if (!/ignoreVary/.test(read(viteConfig))) return warn(`${viteConfig} emits a worker but never sets ignoreVary; offline cors assets miss under Vary: Origin (erd D1)`);
      return pass(`worker emitted by ${viteConfig} from the built bundle`);
    }
    // a page prerendered after vite build gets its worker from a later build step that reads the finished dist/
    const writer = [...String(pkg?.scripts?.build ?? '').matchAll(/\bnode\s+(\S+\.m?js)\b/g)].map((m) => m[1]).find((f) => exists(f) && /sw\.js/.test(read(f)) && /\bdist\b/.test(read(f)));
    if (writer) {
      // the writer may only fill placeholders into src/sw.js (calabrodesign); check both
      const src = exists('src/sw.js') ? read('src/sw.js') : '';
      if (!/ignoreVary/.test(read(writer)) && !/ignoreVary/.test(src)) {
        return warn(`${writer} writes sw.js but never sets ignoreVary; offline cors assets miss under Vary: Origin (erd D1)`);
      }
      return pass(`worker written by ${writer} from the built dist/`);
    }
    return skip('no service worker');
  }
  const sw = exists('sw.js') ? 'sw.js' : null;
  if (!sw) return skip('no service worker at sw.js');
  // static apps: every quoted relative path the worker precaches must exist, and every shipped src file must be listed
  const listed = [...read(sw).matchAll(/["']\.\/([^"'\s]+\.[a-z0-9]+)["']/gi)].map((m) => m[1]);
  if (!listed.length) return warn(`${sw} precaches no relative paths; offline after first load is a ship gate`);
  const stale = listed.filter((f) => !exists(f));
  const missing = ALL.filter((f) => /^src\/.+\.(js|mjs|css)$/.test(f) && !/\.test\./.test(f) && !listed.includes(f));
  const problems = [stale.length && `precached but missing: ${stale.slice(0, 3).join(', ')}`, missing.length && `shipped but not precached: ${missing.slice(0, 3).join(', ')}`].filter(Boolean);
  return problems.length ? fail(problems.join('; ')) : pass(`${listed.length} precached paths, all on disk, src covered`);
};

// an author display on a class outranks the user-agent [hidden] rule, so an element the markup
// hides with that class never hides (invaders P3: a full-screen notice covered the game). static
// markup only; a fake document or server render cannot see it, so this reads the css directly.
checks['hidden-display'] = () => {
  if (!isApp) return skip('not an app');
  const html = CODE.filter((f) => /\.html$/.test(f));
  const css = CODE.filter((f) => /\.(css|scss)$/.test(f)).map(read).join('\n');
  if (!html.length || !css) return skip('no static markup with a stylesheet');
  if (/(^|[\s,}])\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(css)) return pass('global [hidden] rule');
  const block = (sel) => {
    const esc = sel.replace(/[.[\]-]/g, (c) => `\\${c}`);
    return [...css.matchAll(new RegExp(`(?:^|[\\s,}])${esc}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join(';');
  };
  const bad = new Set();
  for (const f of html) {
    for (const m of read(f).matchAll(/<\w+[^>]*\shidden[\s>/=][^>]*>|<\w+[^>]*\sclass="[^"]*"[^>]*\shidden[^>]*>/g)) {
      const cls = /\sclass="([^"]+)"/.exec(m[0]);
      if (!cls) continue;
      for (const name of cls[1].split(/\s+/)) {
        if (/display\s*:\s*(?!none)/.test(block(`.${name}`)) && !/display\s*:\s*none/.test(block(`.${name}[hidden]`))) bad.add(name);
      }
    }
  }
  return bad.size ? warn(`hidden in the markup but its class sets display with no [hidden] rule: .${[...bad].slice(0, 3).join(', .')}; add .class[hidden] { display: none }`) : pass('every hidden element can hide');
};

// the gates run locally before every PR; Actions minutes are a shared monthly budget across every
// private repo, so a workflow runs on dispatch or a schedule only. a pull_request trigger counts
// even when limited to `labeled`: the greenfield label it served is retired (gambit P4)
const ciTriggers = (src) => {
  const block = src.match(/^on:[ \t]*\n((?:[ \t]+.*\n|[ \t]*\n)*)/m)?.[1] ?? src.match(/^on:[ \t]*(\S.*)$/m)?.[1] ?? '';
  return /\bpush\b/.test(block) || /\bpull_request(_target)?\b/.test(block);
};
checks['ci'] = () => {
  const wf = FILES.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f));
  const burning = wf.filter((f) => ciTriggers(read(f)));
  return burning.length
    ? warn(`runs on a push or PR event and spends Actions minutes: ${burning.join(', ')}; run the gates locally and keep only workflow_dispatch or a schedule`)
    : pass(wf.length ? 'no workflow runs on push or PR' : 'no workflows');
};

checks['sentence-case'] = () => {
  if (!isApp) return skip('not an app');
  // heuristic: three or more consecutive capitalized words inside user-facing string attributes or heading tags
  const re = /(<title>|aria-label=["']|alt=["']|<h[1-3][^>]*>|title=["'])\s*([A-Z][a-z]+ (?:[A-Z][a-z]+ ){1,}[A-Z][a-z]+)/;
  const hits = grepFiles(CODE.filter((f) => /\.(tsx?|jsx?|html|vue|svelte|astro)$/.test(f)), re);
  return hits.length ? warn(`${hits.length} Title Case candidate(s): ${hits.slice(0, 3).map((h) => `${h.file}:${h.line}`).join(', ')}`) : pass('no Title Case candidates');
};

// ---------------------------------------------------------------- checks from the house-rules tab

const headSource = ['index.html', 'public/index.html', 'app/layout.tsx', 'src/app/layout.tsx'].find(exists);
const head = headSource ? read(headSource) : '';

// a metadata field in layout.tsx, as the meta guide writes it: the first `key:` wins, whether
// it is a string literal or a constant (`title: pageTitle`), which is resolved to its value.
// taking the first literal anywhere misread appleWebApp.title as the page title.
function metaField(key) {
  const at = new RegExp(`\\b${key}:\\s*`).exec(head);
  if (!at) return undefined;
  const rest = head.slice(at.index + at[0].length);
  const literal = /^["'`]([^"'`\n]*)["'`]/.exec(rest);
  if (literal) return literal[1];
  const template = /^\{[^}]*?default:\s*["'`]([^"'`\n]*)["'`]/.exec(rest);
  if (template) return template[1];
  const ident = /^([A-Za-z_$][\w$]*)\b/.exec(rest);
  if (!ident) return undefined;
  return new RegExp(`(?:const|let|var)\\s+${ident[1]}\\s*=\\s*["'\`]([^"'\`]*)["'\`]`).exec(head)?.[1];
}

checks['favicons'] = () => {
  if (!isApp) return skip('not an app');
  const want = ['favicons/favicon.svg', 'favicons/favicon-32.png', 'favicons/favicon-48.png', 'favicons/favicon-180.png'];
  const missing = want.filter((w) => !ALL.some((f) => f.endsWith(w)));
  const og = ALL.some((f) => /favicons\/og-image\.(jpe?g|png)$/.test(f) || /(^|\/)public\/og\.(png|jpe?g)$/.test(f) || /opengraph-image\./.test(f));
  const manifest = ALL.some((f) => /(site\.webmanifest|manifest\.(json|webmanifest))$/.test(f));
  const out = [...missing, og ? null : 'og image (favicons/og-image.jpg or public/og.png)', manifest ? null : 'site.webmanifest'].filter(Boolean);
  return out.length ? warn(`missing ${out.join(', ')}`) : pass('svg, 32, 48, 180, og image, manifest');
};

// page title case (AGENTS.md, Page titles): a copy of seo/meta-guide/title-case.mjs, inlined because this
// script is copied into app repos alone; title-case.test.mjs fails if the two copies drift.
function valuePropCase(title) {
  const at = String(title ?? '').indexOf(' | ');
  if (at < 0) return null;
  const words = title.slice(at + 3).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  // a lowercase first word reads like a typo in a link preview; iPhone, eBay, and a filename (robots.txt)
  // keep their own case
  const first = words[0].replace(/^[^A-Za-z0-9]+/, '');
  const filename = /^[a-z0-9_-]+\.[a-z]{2,}/.test(first);
  if (/^[a-z]/.test(first) && !/[A-Z]/.test(first) && !filename) return `value prop starts lowercase ("${first}"); capitalize its first word`;

  // title case: every word after the first opens with a capital, or three or more do and they outnumber the
  // lowercase ones. acronyms (AI, AQI) are all caps and do not count, and a two-word name beside ordinary
  // words (Google Takeout, Open Graph, Bryan J. Calabro) stays under the bar
  const rest = words.slice(1).map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')).filter(Boolean);
  const capped = rest.filter((w) => /^[A-Z][a-z]/.test(w)).length;
  const lower = rest.filter((w) => /^[a-z]/.test(w) && w.length > 3).length;
  if ((capped >= 2 && lower === 0) || (capped >= 3 && capped > lower)) return 'value prop looks like Title Case; use sentence case (only the first word, names, and initialisms capitalized)';
  return null;
}

checks['meta-head'] = () => {
  if (!headSource) return isApp ? warn('no index.html or layout.tsx to read a <head> from') : skip('not an app');
  const problems = [];
  const title = /\.html$/.test(headSource) ? /<title>([^<]*)<\/title>/.exec(head)?.[1] : metaField('title');
  if (!title) problems.push('no title');
  else {
    if (title.trim().length > 65) problems.push(`title is ${title.trim().length} chars (max 65)`);
    if (!/\s\|\s/.test(title)) problems.push('title is not "Name | Value prop"');
    const casing = valuePropCase(title.trim());
    if (casing) problems.push(`title ${casing}`);
  }
  const desc = /<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(head)?.[1] ?? /<meta[^>]*content="([^"]*)"[^>]*name="description"/.exec(head)?.[1] ?? metaField('description');
  if (!desc) problems.push('no meta description');
  // google sets no limit and truncates by pixel width, about 155 characters on desktop and 120 on mobile, and the
  // portfolio card clamps near 150; aim for 100 to 150 with the point in the first 120, warn only outside 90 to 155
  else {
    if (desc.length < 90 || desc.length > 155) problems.push(`description is ${desc.length} chars (house: aim for 100 to 150, point in the first 120)`);
    // the title already carries the name, so the description spends its opening words on what the app does
    const name = String(title ?? '').split('|')[0].trim().toLowerCase();
    const opens = name && desc.trim().toLowerCase().startsWith(name) && !/[a-z0-9]/.test(desc.trim().charAt(name.length).toLowerCase());
    if (opens) problems.push('description opens with the app name; lead with a verb (the title carries the name)');
  }
  if (!/theme-color|themeColor/.test(head)) problems.push('no theme-color');
  if (!/rel="canonical"|canonical:|alternates:/.test(head)) problems.push('no canonical');
  return problems.length ? warn(problems.join('; ')) : pass('title, description length, theme-color, canonical');
};

const usesStorage = grepFiles(CODE, /localStorage\.(getItem|setItem)|localStorage\[/);

checks['store-key'] = () => {
  if (!usesStorage.length) return skip('no localStorage');
  const keyed = grepFiles(CODE, /["'`]bc:[a-z0-9.-]+/);
  return keyed.length ? pass(`${keyed[0].text.match(/bc:[a-z0-9.-]+/)?.[0]}`) : warn(`localStorage used at ${usesStorage.length} site(s) but no "bc:<host>" key (house: one versioned JSON object under bc:<host>)`);
};

checks['audio-samples'] = () => {
  const s = ALL.filter((f) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f));
  // content audio (a spoken intro, a song) is legitimate; UI sound is not. the script cannot tell them apart, so this is a WARN to confirm by eye
  return s.length ? warn(`sampled audio shipped (${s.slice(0, 3).join(', ')}); house rule is Web Audio synthesis for UI sound, so confirm these are content, not clicks`) : pass('none');
};

checks['readme'] = () => (exists('README.md') ? pass('present') : warn('no README.md (what it is, how to run it, what is out of scope)'));

checks['data-source'] = () => {
  const data = ALL.filter((f) => /(^|\/)(data|datasets?)\/.*\.(json|csv|tsv|ndjson)$/i.test(f) && fs.statSync(path.join(ROOT, f)).size > 20000);
  if (!data.length) return skip('no bundled data sets over 20 KB');
  const src = ALL.some((f) => /(^|\/)SOURCE\.md$/.test(f));
  return src ? pass(`SOURCE.md covers ${data.length} data file(s)`) : warn(`${data.length} bundled data file(s) without a SOURCE.md (origin, license, date pulled)`);
};

checks['inventory-link'] = () => {
  if (!exists('AGENTS.md')) return skip('no AGENTS.md');
  const a = read('AGENTS.md');
  return /172Xa2DT2d09|app-inventory/i.test(a) ? pass('AGENTS.md points at the catalog') : warn('AGENTS.md does not point at the app inventory (specs/app-inventory.md in calabrodesign; house instructions say every repo does)');
};

// the checks below turn build gotchas that /new-app used to carry as prose into a gate, so a run
// that skims the skill still hears about them

checks['lockfile'] = () => {
  if (!pkg) return skip('no package.json');
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  if (!deps.length) return skip('no dependencies');
  const lock = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'].find(exists);
  return lock ? pass(lock) : fail(`${deps.length} dependencies and no lockfile; run npm install and commit package-lock.json (pairing and lockfile shipped without one)`);
};

checks['playwright-config'] = () => {
  const file = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'].find(exists);
  if (!file) return skip('no playwright config');
  // comments are not config: calabrodesign's own config names the preset it avoids
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  // playwright test reads executablePath only from use.launchOptions; a bare one falls through to an uninstalled browser (gambit)
  if (/executablePath/.test(src) && !/launchOptions/.test(src)) return fail(`${file} sets executablePath outside use.launchOptions, so playwright ignores it; copy calabrodesign's root playwright.config.ts`);
  // an isMobile or hasTouch device preset crashes chromium's mobile emulation in a cloud session's root container
  const mobile = /isMobile\s*:\s*true|hasTouch\s*:\s*true|devices\[\s*['"](iPhone|iPad|Pixel|Galaxy|Nexus|Moto|Kindle|Blackberry|Nokia|Microsoft Lumia|LG|Desktop Chrome HiDPI)/i.exec(src);
  const problems = [];
  if (mobile) problems.push(`uses a mobile device preset (${mobile[0]}), which crashes chromium in a cloud session; use a plain viewport override on a desktop device, as calabrodesign's root config does`);
  // a reused or shared preview tests another app or a stale build (hours, points, rate, reps on 4173; caffeine, p95, vigenere on a stale preview)
  const port = [];
  const reuse = /reuseExistingServer\s*:\s*([^,\n}]+)/.exec(src);
  if (reuse && reuse[1].trim() !== 'false') port.push(`reuseExistingServer is ${reuse[1].trim()}, not false`);
  if (/\b4173\b/.test(src)) port.push('port 4173 is the default every vite preview takes');
  if (/\b4310\b/.test(src) && pkg?.name !== 'calabro-design') port.push("port 4310 is calabrodesign's own, copied unchanged");
  if (/(vite\s+preview|run\s+preview)/.test(src) && !/--strictPort/.test(src)) port.push('the preview runs without --strictPort');
  if (port.length) problems.push(`${port.join(', ')}; give the webServer a port of its own with --strictPort and reuseExistingServer: false`);
  if (problems.length) return warn(`${file} ${problems.join('; ')}`);
  return pass(file);
};

checks['vitest-e2e'] = () => {
  const usesVitest = /vitest/.test(String(pkg?.scripts?.test ?? '')) || !!(pkg?.devDependencies?.vitest || pkg?.dependencies?.vitest);
  if (!usesVitest) return skip('no vitest');
  const specs = ALL.filter((f) => /^e2e\/.*\.spec\.[cm]?[jt]sx?$/.test(f));
  if (!specs.length) return skip('no e2e specs');
  const configs = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs'].filter(exists);
  // vitest's default include matches e2e/*.spec.ts, so npm test runs playwright specs and fails
  if (!configs.some((c) => /exclude[\s\S]{0,200}e2e/.test(read(c)))) return fail(`${specs.length} e2e spec(s) and no vitest exclude for e2e; add test.exclude: ['node_modules/**', 'e2e/**']`);
  // a test block in a config that imports defineConfig from 'vite' fails tsc -b on the unknown key
  const vite = configs.find((c) => /^vite\.config/.test(c));
  if (vite && /\btest\s*:\s*\{/.test(read(vite)) && /defineConfig[^;]*from\s*['"]vite['"]/.test(read(vite)) && !/reference types=["']vitest/.test(read(vite))) {
    return warn(`${vite} has a test block but imports defineConfig from 'vite'; import it from 'vitest/config' or tsc -b rejects the key`);
  }
  return pass('e2e excluded from vitest');
};

checks['e2e-layout'] = () => {
  const e2e = ALL.filter((f) => /^e2e\/.*\.[cm]?[jt]sx?$/.test(f));
  if (!e2e.length) return skip('no e2e/');
  // green unit and e2e suites shipped headers, tables and ids wider than 320px (exposure, maze, nomad, tokens, uuid)
  const measured = e2e.find((f) => /\bscrollWidth\b/.test(read(f)));
  return measured ? pass(`${measured} measures scrollWidth`) : warn('no e2e spec measures horizontal overflow; copy ops/new-app/templates/layout.spec.ts from calabrodesign into e2e/ and list every route');
};

// a check of a page timer that waits it out costs real minutes per browser project and flakes on a
// loaded machine; the page clock runs it in an instant (gambit spent a real minute per project, spin's
// timing specs flaked until they ran on the fake clock)
checks['e2e-clock'] = () => {
  const specs = ALL.filter((f) => /^e2e\/.*\.spec\.[cm]?[jt]sx?$/.test(f));
  if (!specs.length) return skip('no e2e specs');
  const ms = (raw) => Number(String(raw).replace(/_/g, ''));
  const hits = [];
  for (const f of specs) {
    const text = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (/\.clock\./.test(text)) continue;
    const long = [
      ...[...text.matchAll(/\btest\.setTimeout\(\s*([\d_]+)\s*\)/g)].filter((m) => ms(m[1]) > 30000),
      ...[...text.matchAll(/\bwaitForTimeout\(\s*([\d_]+)\s*\)/g)].filter((m) => ms(m[1]) > 5000),
      ...[...text.matchAll(/\bsetTimeout\(\s*\w+\s*,\s*([\d_]+)\s*\)/g)].filter((m) => ms(m[1]) > 5000),
    ];
    for (const m of long) hits.push(`${f}:${text.slice(0, m.index).split('\n').length}`);
  }
  if (!hits.length) return pass('no spec waits out a timer on the real clock');
  return warn(`${hits.length} long real wait(s) in a spec with no page.clock (${hits.slice(0, 3).join(', ')}); drive the page's timers with page.clock (install, pauseAt, fastForward)`);
};

checks['e2e-exact'] = () => {
  const e2e = ALL.filter((f) => /^e2e\/.*\.[cm]?[jt]sx?$/.test(f));
  if (!e2e.length) return skip('no e2e/');
  // getByText, getByLabel and getByRole's name match substrings unless exact is set, so 'To' also
  // finds 'Total' and a test passes or fails on the wrong element (easing, rewind, epoch)
  // read per line: a template literal name holds its own braces, so exact is looked for on the line
  const bare = /getBy(Text|Label|Placeholder|AltText|Title)\(\s*(['"`])[^'"`]*\2\s*\)|getByRole\(\s*['"][\w-]+['"]\s*,\s*\{[^\n]*?\bname\s*:\s*['"`]/;
  const hits = [];
  for (const f of e2e) {
    read(f).split(/\r?\n/).forEach((line, i) => {
      if (!bare.test(line)) return;
      if (/getBy(Text|Label|Placeholder|AltText|Title)\(\s*(['"`])[^'"`]*\2\s*\)/.test(line) || !/\bexact\s*:/.test(line)) hits.push({ file: f, line: i + 1 });
    });
  }
  if (!hits.length) return pass('every string locator is exact');
  return warn(`${hits.length} string locator(s) without exact: true, which match substrings: ${hits.slice(0, 3).map((h) => `${h.file}:${h.line}`).join(', ')}; add { exact: true }, or pass a RegExp when a partial match is meant`);
};

// a <label> that wraps a <select> puts every option's text into the select's accessible name, so
// getByLabel('Country', { exact: true }) finds nothing and a screen reader reads the option list
// (bingo, chessclock, coat, fit, keycode, loaned, postcard, promptlab, quake, reversi, footprint)
checks['label-select'] = () => {
  const src = CODE.filter((f) => /\.(tsx|jsx|html|vue|svelte|astro)$/.test(f) && !/^(e2e|\.claude)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f));
  const hits = [];
  for (const f of src) {
    const text = read(f);
    // a select that names itself (aria-label, aria-labelledby) keeps its own name inside a label
    for (const m of text.matchAll(/<label\b(?:(?!<\/label>)[\s\S])*?<select\b([\s\S]*?)(?:<option|<\/select>|\.map\()/g)) {
      if (!/\baria-label(ledby)?\s*=/.test(m[1])) hits.push(`${f}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  if (!hits.length) return pass('no label wraps a select');
  return warn(`${hits.length} label(s) wrap a select, which folds the options into its name (${hits.slice(0, 3).join(', ')}); give the label htmlFor and the select an id, as siblings`);
};

checks['drop-guard'] = () => {
  const src = CODE.filter((f) => !/^(e2e|\.claude)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f) && !/(^|\/)dropGuard\.[jt]s$/.test(f));
  // a drop zone that is the only drop target lets a file dropped beside it open in the tab and
  // replace the app (exposure's candidate rule, waiting on a second repo that lacks the guard)
  const zone = src.find((f) => /\bonDrop\s*=|\bondrop\s*=|addEventListener\(\s*['"]drop['"]/.test(read(f)));
  if (!zone) return skip('no drop zone');
  // the template's own usage comment names the call, so it never counts as calling it
  const guarded = src.some((f) => /installDropGuard\(|(window|document|globalThis)\.addEventListener\(\s*['"](dragover|drop)['"]/.test(read(f)));
  return guarded ? pass('window-level drop guard') : warn(`${zone} takes drops and nothing guards the window, so a file dropped beside the zone opens in the tab; copy ops/new-app/templates/dropGuard.ts and call installDropGuard() once from the entry`);
};

checks['favicon-glyph'] = () => {
  const svg = ALL.find((f) => /favicons\/favicon\.svg$/.test(f));
  if (!svg) return skip('no favicon.svg');
  // an svg favicon cannot load web fonts, so a <text> glyph draws in a fallback face in the tab
  return /<text[\s>]/.test(read(svg)) ? warn(`${svg} draws its letter with <text>, which renders in a fallback face; render the glyph to a path (resvg-js, see /new-app step 3)`) : pass('glyph is a path');
};

// two pieces of chrome the 2026-09-29 batch (signature, hours, rate, quota, points) kept shipping:
// an Auto/Light/Dark segmented theme control top-right, and dashed-outline buttons that read as
// disabled. warn only: each is a heuristic, and the house theme rule is one cycling icon button
const THEME_LABELS = [/(['"`>])\s*(Auto|System)\s*(['"`<])/g, /(['"`>])\s*Light\s*(['"`<])/g, /(['"`>])\s*Dark\s*(['"`<])/g];
const SEGMENT_SIGNAL = /role\s*=\s*\{?\s*["'](radiogroup|radio|group|tablist)["']|aria-(pressed|checked|selected)\b|type\s*=\s*\{?\s*["']radio["']|segment/i;
const BUTTON_SELECTOR = /(^|[\s,>+~(])(button|input\[type=["']?(button|submit)["']?\])\b|\.[\w-]*(btn|button)\b|\[role=["']?button/i;
const DASHED_DECL = /border(-style)?\s*:[^;{}]*\bdashed\b|@apply[^;{}]*\bborder-dashed\b/i;

function segmentedThemeControl(text) {
  if (!SEGMENT_SIGNAL.test(text)) return null;
  const firsts = THEME_LABELS.map((re) => [...text.matchAll(re)].map((m) => m.index));
  if (firsts.some((xs) => !xs.length)) return null;
  // the three labels sit together in one control, not scattered across a page
  for (const a of firsts[0]) {
    const near = firsts.slice(1).map((xs) => xs.find((x) => Math.abs(x - a) < 800));
    if (near.every((x) => x !== undefined)) return text.slice(0, Math.min(a, ...near)).split('\n').length;
  }
  return null;
}

function dashedButtons(file, text) {
  const hits = [];
  if (/\.(css|scss)$/.test(file)) {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decl = BUTTON_SELECTOR.test(m[1]) ? DASHED_DECL.exec(m[2]) : null;
      if (decl) hits.push(text.slice(0, m.index + m[1].length + 1 + decl.index).split('\n').length);
    }
    return hits;
  }
  for (const m of text.matchAll(/\bborder-dashed\b/g)) {
    const before = text.slice(Math.max(0, m.index - 800), m.index);
    const tag = [...before.matchAll(/<([A-Za-z][\w.]*)/g)].at(-1)?.[1] ?? '';
    if (/^button$|Button$/.test(tag) || /button/i.test(path.basename(file))) hits.push(text.slice(0, m.index).split('\n').length);
  }
  return hits;
}

// a phase gate nothing runs never stops a stamp, so the done-stamp guard silently does nothing (reps P0).
// git runs it for every agent and every person; an agent's own pre-edit hook (claude code's) only
// catches the edit sooner, so a gate wired into one agent alone gates nobody else
checks['hook-wired'] = () => {
  const gate = 'scripts/phase-gate.mjs';
  const legacy = '.claude/hooks/phase-gate.mjs';
  if (exists(gate)) {
    const missing = [
      !/phase-gate\.mjs\s+--staged/.test(read('.githooks/pre-commit')) && '.githooks/pre-commit running `node scripts/phase-gate.mjs --staged`',
      !/phase-gate\.mjs\s+--install/.test(pkg?.scripts?.prepare ?? '') && 'a package.json "prepare" script running `node scripts/phase-gate.mjs --install`',
    ].filter(Boolean);
    if (missing.length) return fail(`${gate} exists but git never runs it; add ${missing.join(' and ')} (blueprint templates)`);
    if (exists(legacy)) return warn(`${legacy} is a second copy of the gate; delete it and point .claude/settings.json at ${gate}`);
    return pass(`${gate} runs as the git pre-commit hook for every agent`);
  }
  if (!exists(legacy)) return skip('no phase gate');
  // a registered legacy hook still guards claude code, so it is debt the next /ship pays (migrate-gate.mjs);
  // one nothing registers guards no agent at all
  if (!/phase-gate/.test(read('.claude/settings.json'))) return fail(`${legacy} exists but nothing runs it; run migrate-gate.mjs from calabrodesign`);
  return warn(`${legacy} gates Claude Code only; the next /ship moves it to ${gate} with migrate-gate.mjs`);
};

// the house scripts ship whole: a loader that rebuilds them from encoded parts is the MCP payload
// workaround, and it drifts from the canonical script (reps P0 shipped scripts/binary-b64/)
checks['script-whole'] = () => {
  const parts = ALL.filter((f) => /(^|\/)binary-b64\//.test(f));
  const loaders = ['scripts/house-audit.mjs', 'scripts/verify-phase.mjs'].filter((f) => exists(f) && /Buffer\.from\([^)]*['"]base64['"]\s*\)/.test(read(f)));
  if (!parts.length && !loaders.length) return pass('house scripts are whole files');
  return fail(`house scripts rebuilt from encoded parts (${[...loaders, ...parts.slice(0, 2)].join(', ')}); copy the canonical house-audit.mjs and verify-phase.mjs whole and push with git`);
};

checks['template-chrome'] = () => {
  if (!isApp) return skip('not an app');
  const src = CODE.filter((f) => !/^(e2e|\.claude|scripts)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f) && /\.(tsx?|jsx?|html|css|scss|vue|svelte|astro)$/.test(f));
  const found = [];
  for (const f of src) {
    const text = read(f);
    if (!/\.(css|scss)$/.test(f)) {
      const line = segmentedThemeControl(text);
      if (line) found.push(`${f}:${line} renders an Auto/Light/Dark segmented theme control; the house control is one cycling icon button (house-rules.md, Theme toggle), designed for this app`);
    }
    for (const line of dashedButtons(f, text)) found.push(`${f}:${line} gives a button a dashed border, which reads as disabled; mark a locked or secondary button with a token or a shape change instead`);
  }
  if (!found.length) return pass('no segmented Auto/Light/Dark control, no dashed buttons');
  return warn(`${found.length} template chrome hit(s): ${found.slice(0, 4).join('; ')}${found.length > 4 ? `; and ${found.length - 4} more` : ''}`);
};

// ---------------------------------------------------------------- run

const results = {};
for (const [id, fn] of Object.entries(checks)) {
  try { results[id] = fn(); } catch (e) { results[id] = fail(`check crashed: ${e.message}`); }
}
const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
for (const r of Object.values(results)) counts[r.status]++;
const verdict = counts.FAIL ? 'FAIL' : 'PASS';

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ repo: path.basename(ROOT), verdict, counts, results }, null, 2) + '\n');
} else {
  const w = Math.max(...Object.keys(results).map((k) => k.length));
  console.log(`house-audit: ${path.basename(ROOT)}\n`);
  for (const [id, r] of Object.entries(results)) console.log(`${r.status.padEnd(4)} ${id.padEnd(w)}  ${r.detail}`);
  console.log(`\n${verdict}: ${counts.FAIL} fail, ${counts.WARN} warn, ${counts.PASS} pass, ${counts.SKIP} skip`);
}
process.exit(counts.FAIL ? 1 : 0);
