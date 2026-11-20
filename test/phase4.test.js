import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { benchCamera, createBenchWorld, stepBenchWorld } from '../src/bench-world.js';
import { summarizeFrames } from '../src/bench-metrics.js';
import { actionForCode, bindingConflict, defaultBindings, normalizeBindings } from '../src/controls.js';
import { addEntry, isScore, rankEntries } from '../src/leaderboard.js';
import { startGameServer } from '../scripts/game-server.js';

const base = { name: 'May_7', score: 120, nights_won: 1, seed: 7 };

test('benchmark đặt đúng thực thể, oil, camera và khóa các luật sinh hoặc kết thúc', () => {
  const first = createBenchWorld(42);
  const second = createBenchWorld(42);
  const positions = first.shades.map(({ pos }) => [...pos]);
  assert.deepEqual(positions, second.shades.map(({ pos }) => pos));
  assert.equal(first.shades.length, 200);
  assert.equal(first.motes.length, 100);
  assert.deepEqual(first.lanterns.map(({ fuelUnits }) => fuelUnits / 60), [100, 100, 100, 0, 0]);
  for (let tick = 0; tick < 480; tick += 1) stepBenchWorld(first);
  assert.deepEqual(first.player.pos, [0, 0, 0]);
  assert.equal(first.player.flames, 3);
  assert.equal(first.player.carried, 0);
  assert.equal(first.state, 'playing');
  assert.equal(first.shades.length, 200);
  assert.equal(first.motes.length, 100);
  assert.ok(first.shades.every(({ state }) => state === 'wander'));
  assert.notDeepEqual(first.shades.map(({ pos }) => pos), positions);
  assert.deepEqual(first.lanterns.map(({ fuelUnits }) => fuelUnits / 60), [100, 100, 100, 0, 0]);
  assert.deepEqual(benchCamera(0), [30, 15, 0]);
  assert.ok(Math.abs(benchCamera(3.75)[0]) < 1e-10);
  assert.equal(benchCamera(3.75)[2], 30);
  assert.deepEqual(benchCamera(15), [30, 15, 0]);
});

test('fps trung bình, 1% low và p95 dùng đúng các khoảng khung hình', () => {
  const input = [...Array(95).fill(10), 18, 20, 25, 40, 100];
  const stats = summarizeFrames(input);
  assert.equal(stats.avg_fps, 1000 * 100 / 1153);
  assert.equal(stats.p1_low_fps, 10);
  assert.equal(stats.frame_ms_p95, 10);
  assert.equal(stats.frames, 100);
  assert.equal(summarizeFrames([...input, 200]).p1_low_fps, 1000 / 150);
});

test('đổi phím đủ chín hành động, nhận biết trùng và giữ phím mặc định cũ', () => {
  assert.equal(Object.keys(defaultBindings).length, 9);
  assert.equal(actionForCode(defaultBindings, 'Escape'), 'pause');
  assert.equal(actionForCode(defaultBindings, 'ArrowUp'), 'up');
  assert.equal(bindingConflict(defaultBindings, 'jump', 'KeyW'), 'Đi lên');
  assert.equal(bindingConflict(defaultBindings, 'up', 'KeyW'), undefined);
  const bindings = normalizeBindings({ ...defaultBindings, jump: 'KeyJ', pause: 'KeyO' });
  assert.equal(actionForCode(bindings, 'KeyJ'), 'jump');
  assert.equal(actionForCode(bindings, 'Space'), undefined);
  assert.equal(actionForCode(bindings, 'Escape'), undefined);
  assert.deepEqual(normalizeBindings({ ...defaultBindings, dash: 'KeyW' }), defaultBindings);
});

test('bảng xếp hạng giới hạn 10, ưu tiên thành tích có thời điểm sớm hơn', () => {
  for (const name of ['a', 'a-b', '<script>', 'abcdefghijklmnop']) assert.equal(isScore({ ...base, name }), false);
  assert.equal(isScore(base), true);
  const early = { ...base, name: 'Som', achieved_at: '2026-01-05T17:00:00+07:00' };
  const late = { ...base, name: 'Muon', achieved_at: '2026-01-05T11:00:00Z' };
  const latest = addEntry([late, early], { ...base, name: 'ThuBa' }, new Date('2026-01-05T12:00:00Z'));
  assert.deepEqual(latest.map(({ name }) => name), ['Som', 'Muon', 'ThuBa']);
  const many = Array.from({ length: 16 }, (_, i) => ({ ...early, score: 100 - i }));
  assert.equal(rankEntries([early, ...many]).length, 10);
  assert.equal(rankEntries([early, ...many])[9].score, 92);
});

test('máy chủ lưu điểm riêng trên đĩa, giữ sau khởi động lại và xuất qua lệnh run', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'lantern-ranking-'));
  const data = join(folder, 'data');
  const prior = process.env.DAO_DEN_LONG_DATA_DIR;
  process.env.DAO_DEN_LONG_DATA_DIR = data;
  t.after(() => {
    if (prior === undefined) delete process.env.DAO_DEN_LONG_DATA_DIR;
    else process.env.DAO_DEN_LONG_DATA_DIR = prior;
    rmSync(folder, { recursive: true, force: true });
  });
  writeFileSync(join(folder, 'index.html'), '<main>Đảo Đèn Lồng</main>');
  const first = await startGameServer({ directory: folder });
  let entries;
  try {
    const url = `${first.url}/api/leaderboard`;
    assert.equal((await fetch(first.url)).status, 200);
    const post = (value, extra) => fetch(url, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...extra }, body: JSON.stringify(value) });
    assert.equal((await post(base, { Origin: 'https://example.com' })).status, 403);
    assert.equal((await post({ ...base, name: '??' })).status, 400);
    await post(base);
    const latest = await post({ ...base, name: 'Bong', score: 200, nights_won: 3 });
    assert.equal(latest.status, 200);
    ({ entries } = await latest.json());
    assert.deepEqual(entries.map(({ name }) => name), ['Bong', 'May_7']);
    assert.match(entries[0].achieved_at, /Z$/);
  } finally {
    await first.close();
  }
  const restarted = await startGameServer({ directory: folder });
  try {
    assert.deepEqual((await (await fetch(`${restarted.url}/api/leaderboard`)).json()).entries, entries);
    const out = join(folder, 'out.json');
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/run.js', import.meta.url)),
      '--export-leaderboard', out]);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), { entries });
  } finally {
    await restarted.close();
  }
});

test('soak chạy 10 đêm một tiến trình và báo bộ nhớ thật', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'lantern-soak-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const out = join(folder, 'soak.json');
  execFileSync(process.execPath, ['--jitless', '--expose-gc',
    fileURLToPath(new URL('../scripts/soak.js', import.meta.url)),
    '--seed', '7', '--nights', '10', '--out', out]);
  const report = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(report.nights, 10);
  assert.equal(report.crashes, 0);
  assert.equal(report.results.length, 10);
  assert.ok(report.results.every((result) => result === 'lost' || result === 'won'));
  assert.ok(report.mem_start_mb > 0 && report.mem_end_mb > 0 && report.duration_s > 0);
  assert.ok(report.mem_end_mb <= report.mem_start_mb * 1.2, 'RSS tăng quá 20%');
});
