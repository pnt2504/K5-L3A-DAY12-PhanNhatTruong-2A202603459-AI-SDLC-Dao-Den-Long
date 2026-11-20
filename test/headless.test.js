import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tuning } from '../src/game.js';

const cli = fileURLToPath(new URL('../src/headless.js', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

function run(t, { scenario, frames, inputs, ticks = 3, every = 1, extraArgs = [] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'island-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'out.jsonl');
  const args = [cli, '--seed', '12', '--night', '1', '--ticks', String(ticks),
    '--snapshot-every', String(every), '--out', output];
  for (const [name, input] of [['scenario', scenario], ['inputs', inputs ?? (frames ? { frames } : undefined)]]) {
    if (input === undefined) continue;
    const path = typeof input === 'string' ? input : join(directory, `${name}.json`);
    if (typeof input !== 'string') writeFileSync(path, JSON.stringify(input));
    args.push(`--${name}`, path);
  }
  const result = spawnSync(process.execPath, args.concat(extraArgs), { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) return result;
  const raw = readFileSync(output, 'utf8');
  const records = raw.trimEnd().split('\n').map((line) => JSON.parse(line));
  return {
    ...result, raw, records, end: records.at(-1),
    snapshots: records.filter(({ type }) => type === 'snapshot'),
    events: records.filter(({ type }) => type === 'event'),
  };
}

const empty = { random_motes: false, random_shades: false };

test('input giữ trạng thái, xoay theo yaw và chuẩn hóa di chuyển chéo', (t) => {
  const game = run(t, {
    scenario: empty,
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 90 },
      { tick: 1, jump: true },
      { tick: 2, move: [1, 1], cam_yaw_deg: 0 },
    ],
  });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.snapshots[0].player.pos, [0, 0, 0]);
  assert.deepEqual(game.snapshots[1].player.pos, [0.1, 0, 0]);
  assert.equal(game.snapshots[2].player.pos[0], 0.2);
  assert.ok(game.snapshots[2].player.pos[1] > 0);
  assert.equal(game.snapshots[3].player.pos[0], 0.271);
  assert.equal(game.snapshots[3].player.pos[2], 0.071);
  assert.equal(game.snapshots[3].sim_tick, 3);
  assert.equal(game.snapshots[3].time_left_s, tuning.night1_duration_s - 3 / 60);
});

test('giữ jump không tự bật lại khi đã tiếp đất', (t) => {
  const game = run(t, { scenario: empty, frames: [{ tick: 0, jump: true }], ticks: 50 });
  assert.equal(game.status, 0, game.stderr);
  assert.ok(game.snapshots[15].player.pos[1] > 1);
  assert.equal(game.snapshots[45].player.pos[1], 0);
  assert.equal(game.snapshots[50].player.pos[1], 0);
});

test('nhặt đom đóm, thắp đèn cuối, cộng điểm và dừng đúng tick', (t) => {
  const game = run(t, { scenario: fixture('win.scenario.json'), inputs: fixture('win.inputs.json') });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(game.snapshots[0].score, 0);
  assert.equal(game.snapshots[0].lanterns.filter(({ lit }) => lit).length, 4);
  assert.equal(game.snapshots[0].motes_active, 3);
  assert.deepEqual(game.events.map(({ name, tick }) => [name, tick]),
    ['mote_picked', 'mote_picked', 'mote_picked', 'deposit', 'lantern_lit', 'game_over']
      .map((name) => [name, 1]));
  assert.deepEqual(game.events[3].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(game.events.at(-1).data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(game.end, { type: 'end', ticks: 1, state: 'won', score: 398 });
});

test('đi hết Đêm 1 từ bản đồ mặc định, gom đom đóm và thắp cả năm đèn', (t) => {
  const game = run(t, { inputs: fixture('full-night.inputs.json'), ticks: 7200, every: 10 });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(game.snapshots[0].lanterns.filter(({ lit }) => lit).length, 0);
  assert.equal(game.snapshots[0].player.carried, 0);
  assert.equal(game.events.filter(({ name }) => name === 'lantern_lit').length, 5);
  assert.ok(game.events.some(({ name }) => name === 'shade_spawned'));
  assert.deepEqual(game.end, { type: 'end', ticks: 2284, state: 'won', score: 1302 });
});

test('nạp một phần; giữ E không nạp lại; lần nhấn kế tiếp thắp đèn', (t) => {
  const game = run(t, {
    scenario: { ...empty, player: { carried: 2 }, motes: [[0, 0, 1.15], [0, 0, 1.15], [0, 0, 1.15]],
      lanterns: [{ id: 'L1', pos: [0, 0, 0] }] },
    frames: [
      { tick: 0, interact: true },
      { tick: 1, move: [0, 1] },
      { tick: 3, interact: false },
      { tick: 4, interact: true },
    ],
    ticks: 5,
  });
  assert.equal(game.status, 0, game.stderr);
  const deposits = game.events.filter(({ name }) => name === 'deposit');
  assert.deepEqual(deposits.map(({ tick, data }) => [tick, data.amount]), [[1, 2], [5, 3]]);
  assert.equal(game.snapshots.at(-1).lanterns[0].lit, true);
});

test('Tỏa Sáng đẩy, choáng, tiêu hao; khi hết choáng Bóng Mực quay lại gây thua', (t) => {
  const game = run(t, { scenario: fixture('pulse-loss.scenario.json'),
    inputs: fixture('pulse-loss.inputs.json'), ticks: 300 });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.events[0].data, { stunned_ids: ['ink'] });
  assert.deepEqual(game.snapshots[1].shades[0], { id: 'ink', pos: [5, 0.8, 0], state: 'stunned' });
  assert.equal(game.snapshots[1].player.carried, 3);
  assert.equal(game.events.filter(({ name }) => name === 'pulse').length, 1);
  assert.deepEqual(game.events.at(-2).data, { by: 'shade', flames: 0, dropped: 1 });
  assert.deepEqual(game.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(game.end.score, 5);
  assert.equal(game.end.ticks, 202);
});

test('Tỏa Sáng thiếu tài nguyên và đang hồi chiêu đều không kích hoạt', (t) => {
  const game = run(t, { scenario: { ...empty, player: { carried: 6 } }, ticks: 5,
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }] });
  const broke = run(t, { scenario: empty, frames: [{ tick: 0, pulse: true }] });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(broke.status, 0, broke.stderr);
  assert.deepEqual(game.events.map(({ name }) => name), ['pulse']);
  assert.equal(game.snapshots.at(-1).player.carried, 3);
  assert.equal(broke.events.length, 0);
});

test('vùng sáng chặn Bóng Mực, bất tử chặn sát thương lặp lại', (t) => {
  const safe = run(t, { scenario: { ...empty, shades: [{ pos: [6, 0.8, 0] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] }, ticks: 60 });
  const danger = run(t, { scenario: { ...empty, shades: [{ pos: [0, 0.8, 0] }, { pos: [0, 1, 0] }] },
    ticks: 92 });
  assert.equal(safe.status, 0, safe.stderr);
  assert.equal(danger.status, 0, danger.stderr);
  assert.deepEqual(safe.snapshots.at(-1).shades[0].pos, [5, 0.8, 0]);
  assert.equal(safe.events.length, 0);
  assert.deepEqual(danger.events.map(({ tick }) => tick), [1, 91]);
});

test('rơi khỏi đảo mất một lửa và trở về điểm xuất phát; hết giờ thì thua', (t) => {
  const fall = run(t, { scenario: { ...empty, player: { pos: [35.5, 0, 0], carried: 4 } },
    frames: [{ tick: 0, move: [1, 0] }, { tick: 6, move: [0, 0] }], ticks: 90 });
  const dawn = run(t, { scenario: { ...empty, time_left_s: 2 / 60 }, every: 10 });
  assert.equal(fall.status, 0, fall.stderr);
  assert.equal(dawn.status, 0, dawn.stderr);
  assert.deepEqual(fall.events.map(({ name, data }) => [name, data]),
    [['player_hit', { by: 'fall', flames: 2, dropped: 4 }]]);
  assert.deepEqual(fall.snapshots.at(-1).player.pos, [0, 0, 0]);
  assert.equal(dawn.snapshots.length, 1);
  assert.deepEqual(dawn.events[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(dawn.end.ticks, 2);
});

test('snapshot cách 10 tick và đầu ra khớp từng byte khi dùng cùng seed', (t) => {
  const first = run(t, { ticks: 1400, every: 10 });
  const second = run(t, { ticks: 1400, every: 10 });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.raw, second.raw);
  assert.equal(first.stdout, '');
  assert.equal(first.snapshots[1].tick, 10);
  assert.ok(first.events.some(({ name }) => name === 'shade_spawned'));
  assert.equal(first.end.ticks, 1400);
});

test('override một phần scenario, ID mặc định không đụng ID đặt sẵn và --ticks 0', (t) => {
  const game = run(t, { ticks: 0, scenario: { ...empty, shades: [{ pos: [1, 0, 0] },
    { id: 'S1', pos: [2, 0, 0] }], lanterns: [{ id: 'L2', pos: [6, 0, 3], lit: true }] } });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(game.records.length, 2);
  assert.deepEqual(game.snapshots[0].shades.map(({ id }) => id), ['S2', 'S1']);
  assert.equal(game.snapshots[0].lanterns.length, tuning.lantern_count_night1);
  assert.equal(game.snapshots[0].lanterns[1].lit, true);
  assert.equal(game.snapshots[0].motes_active, 0);
  assert.equal(game.end.ticks, 0);
});

test('inputs hoặc scenario sai cấu trúc → 2 và stderr; tham số sai → 1', (t) => {
  for (const options of [
    { frames: [{ tick: 0 }, { tick: 0 }] },
    { frames: [{ tick: 0, move: [1.01, 0] }] },
    { frames: [{ tick: 0, pulse: 1 }] },
    { scenario: { random_motes: 'false' } },
    { scenario: { player: { pos: [0, 1] } } },
  ]) {
    const result = run(t, options);
    assert.equal(result.status, 2);
    assert.ok(result.stderr);
    assert.equal(result.stdout, '');
  }
  const flag = run(t, { extraArgs: ['--extra', '4'] });
  assert.equal(flag.status, 1);
  assert.match(flag.stderr, /Tham số không hợp lệ/);
});
