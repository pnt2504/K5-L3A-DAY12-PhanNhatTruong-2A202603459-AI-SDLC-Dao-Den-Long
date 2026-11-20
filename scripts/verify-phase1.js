import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const proof = join(root, 'docs', 'proof', 'phase-1');
const scratch = mkdtempSync(join(tmpdir(), 'lantern-proof-'));

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function headless(path, ...args) {
  runNode(['src/headless.js', '--seed', '12', '--night', '1', '--out', path, ...args]);
  return readFileSync(path);
}

try {
  const testReport = runNode(['--test', '--test-reporter=tap']);
  mkdirSync(proof, { recursive: true });
  for (const name of ['win', 'pulse-loss']) {
    headless(join(proof, `${name}.jsonl`), '--ticks', '300', '--snapshot-every', '50',
      '--scenario', `test/fixtures/${name}.scenario.json`,
      '--inputs', `test/fixtures/${name}.inputs.json`);
  }
  headless(join(proof, 'full-night.jsonl'), '--ticks', '7200', '--snapshot-every', '240',
    '--inputs', 'test/fixtures/full-night.inputs.json');
  const first = headless(join(scratch, 'first.jsonl'), '--ticks', '1400', '--snapshot-every', '10');
  const second = headless(join(scratch, 'second.jsonl'), '--ticks', '1400', '--snapshot-every', '10');
  assert.ok(first.equals(second), 'Hai lần chạy cùng đầu vào có kết quả khác nhau');
  const hash = createHash('sha256').update(first).digest('hex');
  const determinism = [
    'node src/headless.js --seed 12 --night 1 --ticks 1400 --snapshot-every 10 --out <file>',
    `Run 1 SHA-256: ${hash}`,
    `Run 2 SHA-256: ${hash}`,
    `So sánh từng byte: khớp (${first.length} byte)`,
  ].join('\n');
  writeFileSync(join(proof, 'determinism.txt'), `${determinism}\n`);
  writeFileSync(join(proof, 'tests.tap'), testReport.replaceAll('\r\n', '\n'));
  process.stdout.write(`${testReport}\n${determinism}\n`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
