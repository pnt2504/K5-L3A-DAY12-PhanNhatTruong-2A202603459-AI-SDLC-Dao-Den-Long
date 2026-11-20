import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import contract from '../game.contract.json' with { type: 'json' };

assert.equal(contract.contract_version, '1.2');
const root = fileURLToPath(new URL('../', import.meta.url));
const proof = join(root, 'docs', 'proof', 'phase-3');
const temp = mkdtempSync(join(tmpdir(), 'lantern-phase3-'));

function runNode(args) {
  const before = performance.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  const seconds = (performance.now() - before) / 1000;
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { seconds, stdout: result.stdout };
}

function headless(path, args) {
  const { seconds } = runNode(['src/headless.js', '--seed', '12', '--out', path, ...args]);
  const data = readFileSync(path);
  const lines = data.toString().trimEnd().split('\n');
  return { data, lines, end: JSON.parse(lines.at(-1)), seconds };
}

try {
  const tests = runNode(['--test', '--test-reporter=tap']);
  mkdirSync(proof, { recursive: true });
  writeFileSync(join(proof, 'tests.tap'), tests.stdout.replaceAll('\r\n', '\n'));

  const example = headless(join(proof, 'maintenance.jsonl'), [
    '--night', '1', '--ticks', '180', '--snapshot-every', '30',
    '--scenario', 'test/fixtures/phase-3/maintenance.scenario.json',
    '--inputs', 'test/fixtures/phase-3/maintenance.inputs.json',
  ]);
  assert.deepEqual(example.end, { type: 'end', ticks: 180, state: 'won', score: 684 });
  const events = example.lines.map((line) => JSON.parse(line)).filter(({ type }) => type === 'event');
  for (const name of ['lantern_out', 'lantern_lit', 'refuel', 'fuel_drain']) {
    assert.ok(events.some((event) => event.name === name), name);
  }
  assert.equal(events.at(-1).data.reason, 'dawn_survived');

  const stress = ['--night', '3', '--ticks', '18000', '--snapshot-every', '10',
    '--scenario', 'test/fixtures/phase-2/stress.scenario.json'];
  const first = headless(join(temp, 'first.jsonl'), stress);
  const second = headless(join(temp, 'second.jsonl'), stress);
  assert.equal(first.end.ticks, 18000);
  assert.ok(first.seconds <= 30 && second.seconds <= 30);
  assert.ok(first.data.equals(second.data));
  const report = {
    node: process.version, platform: platform(), arch: arch(),
    stressArgs: stress, seed: 12, seconds: [first.seconds, second.seconds],
    identical: first.data.equals(second.data), bytes: first.data.length,
    sha256: createHash('sha256').update(first.data).digest('hex'), dawn: example.end,
  };
  writeFileSync(join(proof, 'headless-performance.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${tests.stdout}\n${JSON.stringify(report, null, 2)}\n`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
