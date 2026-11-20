import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import contract from '../game.contract.json' with { type: 'json' };

assert.equal(contract.contract_version, '1.1', 'Chạy script này từ checkout của tag phase-2');

const root = fileURLToPath(new URL('../', import.meta.url));
const proof = join(root, 'docs', 'proof', 'phase-2');
const temp = mkdtempSync(join(tmpdir(), 'lantern-phase2-'));

function runNode(args) {
  const before = performance.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  const seconds = (performance.now() - before) / 1000;
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { seconds, stdout: result.stdout };
}

function replay(path, { night, seed = 12, ticks, every, inputs, scenario }) {
  const args = ['src/headless.js', '--night', String(night), '--seed', String(seed), '--ticks', String(ticks),
    '--snapshot-every', String(every), '--out', path];
  if (scenario) args.push('--scenario', scenario);
  if (inputs) args.push('--inputs', inputs);
  const { seconds } = runNode(args);
  const data = readFileSync(path);
  const end = JSON.parse(data.toString().trimEnd().split('\n').at(-1));
  return { data, end, seconds };
}

try {
  const tests = runNode(['--test', '--test-reporter=tap']);
  mkdirSync(proof, { recursive: true });
  writeFileSync(join(proof, 'tests.tap'), tests.stdout.replaceAll('\r\n', '\n'));
  const results = [];
  for (const [night, seed, ticks, inputs] of [
    [1, 12, 18000, 'test/fixtures/full-night.inputs.json'],
    [2, 2, 19800, 'test/fixtures/night-2.inputs.json'],
    [3, 12, 100, 'test/fixtures/phase-2/night-3-final.inputs.json'],
  ]) {
    const scenario = night === 3 ? 'test/fixtures/phase-2/night-3-final.scenario.json' : undefined;
    const output = join(proof, `night-${night}-win.jsonl`);
    const { end } = replay(output, { night, seed, ticks, inputs, scenario, every: night === 3 ? 10 : 600 });
    assert.equal(end.state, 'won');
    results.push({ night, seed, ...end });
  }
  const stress = { night: 3, ticks: 21600, every: 10, scenario: 'test/fixtures/phase-2/stress.scenario.json' };
  const first = replay(join(temp, 'first.jsonl'), stress);
  const second = replay(join(temp, 'second.jsonl'), stress);
  assert.equal(first.end.ticks, 21600);
  assert.ok(first.seconds <= 30 && second.seconds <= 30, 'Chạy headless vượt 30 giây');
  assert.ok(first.data.equals(second.data), 'JSONL khác nhau giữa hai lượt cùng đầu vào');
  const report = {
    node: process.version, platform: platform(), arch: arch(), night: stress.night, seed: 12,
    scenario: stress.scenario, ticks: first.end.ticks, snapshotEvery: stress.every,
    seconds: [first.seconds, second.seconds], identical: first.data.equals(second.data), bytes: first.data.length,
    sha256: createHash('sha256').update(first.data).digest('hex'), end: first.end, wins: results,
  };
  writeFileSync(join(proof, 'headless-performance.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${tests.stdout}\n${JSON.stringify(report, null, 2)}\n`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
