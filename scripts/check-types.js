/**
 * TypeScript checkJs quality gate with a fixed, reviewable legacy baseline.
 * Run full TypeScript; fail on every new diagnostic or increased known error.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function signature(item) {
  return JSON.stringify([item.file, item.code, item.message]);
}

export function parseDiagnostics(output) {
  const diagnostics = [];
  const lines = String(output || '').replace(/\r/g, '').split('\n');
  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/);
    if (match) {
      diagnostics.push({
        file: match[1].replaceAll('\\', '/').replace(/^\.\//, ''),
        code: Number(match[4]),
        message: match[5].trim(),
      });
      continue;
    }
    // Global/configuration errors must also fail.
    const global = line.match(/^error TS(\d+): (.*)$/);
    if (global) diagnostics.push({ file: '<config>', code: Number(global[1]), message: global[2].trim() });
  }
  return diagnostics;
}

export function findNewDiagnostics(actual, allowed) {
  const limits = new Map();
  for (const item of allowed) {
    const key = signature(item);
    limits.set(key, (limits.get(key) || 0) + item.count);
  }
  const used = new Map();
  const newErrors = [];
  for (const item of actual) {
    const key = signature(item);
    const next = (used.get(key) || 0) + 1;
    used.set(key, next);
    if (next > (limits.get(key) || 0)) newErrors.push(item);
  }
  return newErrors;
}

export function runTypeGate() {
  const baseline = JSON.parse(readFileSync(new URL('./tsc-baseline.json', import.meta.url), 'utf8'));
  if (baseline.version !== 1 || !Array.isArray(baseline.diagnostics)) {
    throw new Error('Invalid TypeScript diagnostic baseline');
  }
  const tscPath = process.platform === 'win32'
    ? resolve(projectRoot, 'node_modules/.bin/tsc.cmd')
    : resolve(projectRoot, 'node_modules/.bin/tsc');
  const run = spawnSync(tscPath, ['--project', 'tsconfig.json', '--noEmit', '--pretty', 'false'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

  if (run.error) throw run.error;
  const output = (run.stdout || '') + (run.stderr || '');
  const actual = parseDiagnostics(output);
  const newErrors = findNewDiagnostics(actual, baseline.diagnostics);
  if (run.status !== 0 && actual.length === 0) {
    console.error(output || 'TypeScript failed without parseable diagnostics');
    return 1;
  }
  if (newErrors.length) {
    console.error('[check:types] New TypeScript diagnostics detected:');
    for (const item of newErrors) console.error('  ' + item.file + ': TS' + item.code + ': ' + item.message);
    console.error('[check:types] Fix new errors; legacy errors are tracked in scripts/tsc-baseline.json.');
    return 1;
  }
  if (run.status !== 0 && run.status !== 2) {
    console.error(output || 'Unexpected tsc exit status ' + run.status);
    return 1;
  }

  const existing = baseline.diagnostics.reduce((total, item) => total + item.count, 0);
  console.log('[check:types] PASS: 0 new errors; ' + actual.length +
    ' legacy diagnostics (baseline ceiling ' + existing + ').');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runTypeGate();
}
