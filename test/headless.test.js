import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tuning } from '../src/game.js';
import { completeNight, createCampaign, nextNight } from '../src/campaign.js';

const cli = fileURLToPath(new URL('../src/headless.js', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

function run(t, { scenario, frames, inputs, ticks = 3, every = 1, extraArgs = [], night = 1, seed = 12 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'island-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'out.jsonl');
  const args = [cli, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks),
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
    events: records.filter(({ type, name }) => type === 'event' && name !== 'night_start'),
  };
}

const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const at = (game, tick) => game.snapshots.find((record) => record.tick === tick);

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
  assert.deepEqual(game.events[3].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.deepEqual(game.events.at(-1).data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(game.end, { type: 'end', ticks: 1, state: 'won', score: 468 });
});

test('nạp một phần; giữ E không nạp lại; lần nhấn kế tiếp thắp đèn', (t) => {
  const game = run(t, {
    scenario: { ...empty, player: { carried: 2 }, motes: [[0, 0, 1.15], [0, 0, 1.15], [0, 0, 1.15]],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 5 }] },
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
  assert.deepEqual(game.snapshots[1].shades[0], { id: 'ink', pos: [1.267, 0.8, 0], state: 'stunned' });
  assert.deepEqual(game.snapshots[15].shades[0].pos, [5, 0.8, 0]);
  assert.equal(game.snapshots[1].player.carried, 3);
  assert.equal(game.events.filter(({ name }) => name === 'pulse').length, 1);
  assert.deepEqual(game.events.at(-2).data, { by: 'shade', flames: 0, dropped: 1 });
  assert.deepEqual(game.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(game.end.score, 5);
  assert.equal(game.end.ticks, 180);
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
  const safe = run(t, { scenario: { ...empty, shades: [{ pos: [7, 0.8, 0] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] }, ticks: 60 });
  const danger = run(t, { scenario: { ...empty, shades: [{ pos: [0, 0.8, 0] }, { pos: [0, 1, 0] }] },
    ticks: 92 });
  assert.equal(safe.status, 0, safe.stderr);
  assert.equal(danger.status, 0, danger.stderr);
  assert.deepEqual(safe.snapshots.at(-1).shades[0].pos, [6, 0.8, 0]);
  assert.equal(safe.events.length, 0);
  assert.deepEqual(danger.events.map(({ tick }) => tick), [1, 91]);
});

test('rơi khỏi đảo mất một lửa và trở về điểm xuất phát; hết giờ thì thua', (t) => {
  const fall = run(t, { scenario: { ...empty, player: { pos: [39.5, 0, 0], carried: 4, invuln_ticks: 400 } },
    frames: [{ tick: 0, move: [1, 0] }, { tick: 6, move: [0, 0] }], ticks: 140 });
  const dawn = run(t, { scenario: { ...empty, time_left_s: 2 / 60 }, every: 10 });
  assert.equal(fall.status, 0, fall.stderr);
  assert.equal(dawn.status, 0, dawn.stderr);
  assert.deepEqual(fall.events.map(({ name, data }) => [name, data]),
    [['player_hit', { by: 'fall', flames: 2, dropped: 0, lost: 4 }]]);
  const hitTick = fall.events[0].tick;
  assert.ok(at(fall, hitTick + 59).player.pos[1] < -10);
  assert.deepEqual(at(fall, hitTick + 60).player.vel, [0, 0, 0]);
  assert.equal(at(fall, hitTick + 60).player.invuln, true);
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
  assert.equal(game.records.length, 3);
  assert.deepEqual(game.records[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(game.snapshots[0].shades.map(({ id }) => id), ['S1', 'S2']);
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
    { frames: [{ tick: 0, pause: 1 }] },
    { scenario: { random_motes: 'false' } },
    { scenario: { player: { pos: [0, 1] } } },
    { scenario: { shades: [{ pos: [0, 0.8, 1], state: 'idle' }] } },
    { scenario: { drifters: [{ pos: [0, 0, 0], stolen: -1 }] } },
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

test('tuning v1.1: bản đồ, số đèn, đồng hồ và vị trí sinh theo từng Đêm', (t) => {
  for (const [night, duration, count, last, charms] of [
    [1, 300, 5, [-23.8, 0, 7.7], 0], [2, 330, 6, [53, 0, -10], 1],
    [3, 360, 7, [-20, 0, -35], 2],
  ]) {
    const game = run(t, { night, ticks: 300, every: 60 });
    assert.equal(game.status, 0, game.stderr);
    const start = game.snapshots[0];
    assert.equal(start.night, night);
    assert.equal(start.time_left_s, duration);
    assert.equal(start.lanterns.length, count);
    assert.deepEqual(start.lanterns.at(-1).pos, last);
    assert.equal(start.motes_active, 20);
    assert.equal(new Set(start.motes.map(({ pos }) => pos.join())).size, 20);
    assert.equal(start.charms.length, charms);
    assert.ok(start.motes.every((mote) => mote.kind === 'random' && mote.ttl_s === null));
    assert.equal(at(game, 240).motes_active, 21);
    assert.deepEqual(at(game, 300).shades.map(({ state }) => state), ['spawning', 'spawning']);
    assert.deepEqual(game.events.map(({ tick, name, data }) => [tick, name, data.id]),
      [[300, 'shade_spawned', 'S1'], [300, 'shade_spawned', 'S2']]);
  }
});

test('Lướt 12 tick, giữ độ cao, bỏ lần nhấn khi đang Lướt và chờ đúng 90 tick', (t) => {
  const game = run(t, {
    scenario: { ...empty, player: { pos: [0, 4, 0] } }, ticks: 93,
    frames: [{ tick: 0, dash: true }, { tick: 2, dash: false }, { tick: 4, dash: true },
      { tick: 12, dash: false }, { tick: 13, dash: true }, { tick: 33, dash: false }, { tick: 90, dash: true }],
  });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.events.map(({ name, tick }) => [name, tick]), [['dash', 1], ['dash', 91]]);
  assert.deepEqual(at(game, 1).player.vel, [0, 0, 14]);
  assert.deepEqual(at(game, 12).player.pos, [0, 4, 2.8]);
  assert.ok(at(game, 13).player.pos[1] < 4);
  assert.equal(at(game, 1).player.dash_cd_s, 1.5);
  const contact = run(t, { scenario: { ...empty, shades: [{ pos: [0, 0.8, 0.8] }] },
    frames: [{ tick: 0, dash: true }], ticks: 1 });
  assert.equal(contact.status, 0, contact.stderr);
  assert.deepEqual(contact.events.map(({ name }) => name), ['dash', 'player_hit']);
});

test('tạm dừng làm đứng yên gameplay, spawn, hồi chiêu, bất tử và TTL', (t) => {
  const game = run(t, {
    night: 3, scenario: { ...empty, player: { carried: 6 }, shades: [{ pos: [0, 0.8, 0] }],
      drifters: [{ pos: [15, 0.8, 0], state: 'flee', state_ticks_left: 25 }], charms: [] },
    frames: [{ tick: 2, pause: true }, { tick: 3, pause: false }, { tick: 502, pause: true }], ticks: 505,
  });
  assert.equal(game.status, 0, game.stderr);
  const initial = at(game, 2);
  const freeze = at(game, 502);
  assert.equal(freeze.state, 'paused');
  for (const key of ['sim_tick', 'time_left_s', 'player', 'motes', 'shades', 'drifters']) {
    assert.deepEqual(freeze[key], initial[key]);
  }
  assert.equal(freeze.motes[0].kind, 'dropped');
  assert.deepEqual(game.events.filter(({ name }) => name === 'paused' || name === 'resumed')
    .map(({ name, tick }) => [name, tick]), [['paused', 3], ['resumed', 503]]);
  assert.equal(at(game, 503).sim_tick, 3);
  assert.equal(at(game, 503).player.invuln, true);
  assert.ok(at(game, 503).motes[0].ttl_s < freeze.motes[0].ttl_s);
});

test('Bùa Gió tăng tốc, Lướt liên tiếp và hồi sinh đồng bộ theo tick', (t) => {
  const game = run(t, {
    night: 2, scenario: { ...empty, player: { dash_cd_ticks: 90 },
      charms: [{ id: 'C1', pos: [0, 0, 0] }] }, ticks: 2702,
    frames: [{ tick: 0, move: [0, 1] }, { tick: 3, dash: true }, { tick: 4, dash: false },
      { tick: 15, dash: true }, { tick: 16, dash: false }, { tick: 27, move: [0, 0] }],
  });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.events[0], { type: 'event', tick: 1, name: 'charm_picked',
    data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(at(game, 2).player.vel[2], 7.2);
  assert.deepEqual(game.events.filter(({ name }) => name === 'dash').map(({ tick }) => tick), [4, 16]);
  assert.equal(at(game, 16).player.dash_cd_s, 0);
  assert.equal(at(game, 600).player.charm_s, 1 / 60);
  assert.equal(at(game, 601).player.charm_s, 0);
  assert.equal(at(game, 2700).charms[0].available, false);
  assert.equal(at(game, 2701).charms[0].available, true);
});

test('Gió Lạc cướp trong vùng sáng và lúc bất tử, Tỏa Sáng lấy lại được đom đóm', (t) => {
  const game = run(t, {
    night: 2, scenario: { ...empty, player: { carried: 8, invuln_ticks: 90 },
      lanterns: [{ id: 'L1', lit: true, pos: [0, 0, 0] }], charms: [],
      drifters: [{ id: 'D1', pos: [1.2, 0.8, 0], state: 'idle' }] },
    frames: [{ tick: 1, pulse: true }], ticks: 122,
  });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.events.map(({ name }) => name), ['drifter_steal', 'pulse', 'drifter_drop']);
  assert.deepEqual(game.events[0].data, { drifter_id: 'D1', amount: 3, carried: 5 });
  assert.deepEqual(game.events[2].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(at(game, 2).player.flames, 3);
  assert.equal(at(game, 2).motes.length, 3);
  assert.ok(at(game, 2).motes.every(({ kind, ttl_s }) => kind === 'dropped' && ttl_s === 8));
  assert.equal(at(game, 121).drifters[0].state, 'flee');
  assert.equal(at(game, 122).drifters.length, 0);
  const deter = run(t, { night: 2, scenario: { ...empty, player: { carried: 8 },
    drifters: [{ pos: [0.4, 0.8, 0], state: 'chase' }] }, frames: [{ tick: 0, pulse: true }] });
  assert.equal(deter.status, 0, deter.stderr);
  assert.equal(deter.snapshots[1].drifters[0].state, 'flee');
  assert.deepEqual(deter.events.map(({ name }) => name), ['pulse']);
});

test('Gió Lạc sinh theo lịch, tối đa hai ở Đêm 2–3 và không tự sinh ở Đêm 1', (t) => {
  for (const night of [1, 2, 3]) {
    const game = run(t, { night, scenario: { ...empty, random_drifters: true }, ticks: 3600, every: 600 });
    assert.equal(game.status, 0, game.stderr);
    assert.equal(at(game, 600).drifters.length, 0);
    assert.equal(at(game, 1200).drifters.length, night === 1 ? 0 : 1);
    assert.equal(at(game, 3600).drifters.length, night === 1 ? 0 : 2);
  }
});

test('Đảo Cau đi qua cầu và bật đúng hướng, bỏ qua phím di chuyển khi đang bay', (t) => {
  const bridge = run(t, { night: 2, scenario: { ...empty, player: { pos: [25, 0, 0] }, charms: [] },
    frames: [{ tick: 0, move: [1, 0] }], ticks: 470, every: 10 });
  assert.equal(bridge.status, 0, bridge.stderr);
  assert.deepEqual(bridge.snapshots.at(-1).player.pos, [72, 0, 0]);
  assert.equal(bridge.events.length, 0);
  const pad = run(t, { night: 2, scenario: { ...empty, player: { pos: [20, 0, 18] } },
    frames: [{ tick: 0, move: [-1, 0] }, { tick: 80, move: [0, 0] }], ticks: 90 });
  assert.equal(pad.status, 0, pad.stderr);
  assert.ok(Math.abs(Math.hypot(at(pad, 1).player.vel[0], at(pad, 1).player.vel[2]) - 24) < 0.001);
  assert.ok(at(pad, 40).player.pos[1] > 4.8);
  assert.ok(at(pad, 84).player.pos[0] > 50);
  assert.equal(at(pad, 84).player.grounded, true);
});

test('Đảo Chuông có vách, dốc, bục lên tầng 2 và tháp đứng chắn đường', (t) => {
  const wall = run(t, { night: 3, scenario: { ...empty, player: { pos: [0, 0, -10] } },
    frames: [{ tick: 0, move: [0, 1] }], ticks: 45 });
  assert.equal(wall.status, 0, wall.stderr);
  assert.equal(wall.snapshots.at(-1).player.pos[1], 0);
  assert.ok(wall.snapshots.at(-1).player.pos[2] <= -8);
  const ramp = run(t, { night: 3,
    scenario: { ...empty, player: { pos: [30 * Math.cos(Math.PI / 6), 0, 15] } },
    frames: [{ tick: 0, move: [-Math.cos(Math.PI / 6), -0.5] }], ticks: 70 });
  assert.equal(ramp.status, 0, ramp.stderr);
  assert.ok(at(ramp, 30).player.pos[1] > 1.4);
  assert.equal(at(ramp, 70).player.pos[1], 3);
  const pad = run(t, { night: 3, scenario: { ...empty, player: { pos: [0, 3, 13] } }, ticks: 100,
    frames: [{ tick: 0, move: [0, 1] }, { tick: 45, move: [0, -1] }] });
  assert.equal(pad.status, 0, pad.stderr);
  assert.deepEqual(at(pad, 1).player.vel, [0, 11.667, -8]);
  assert.equal(at(pad, 60).player.pos[1], 6);
  assert.equal(at(pad, 100).player.pos[2], 2);
});

test('Gió mạnh Đêm 3 bật ở tick 1800, đủ 300 tick, đẩy đúng 2 m/s và tắt được', (t) => {
  const game = run(t, { night: 3, scenario: { ...empty, wind_enabled: true }, ticks: 2101 });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(at(game, 1799).wind.active, false);
  assert.equal(at(game, 1800).wind.active, true);
  assert.equal(at(game, 2099).wind.active, true);
  assert.equal(at(game, 2100).wind.active, false);
  const [x, , z] = at(game, 2099).player.pos;
  assert.ok(Math.abs(Math.hypot(x, z) - 10) < 0.002);
  assert.deepEqual(at(game, 2101).player.pos, at(game, 2099).player.pos);
});

test('nhặt và chạm kiểm tra độ cao; pulse kiểm tra bán kính 3D từ chân cộng 0.8 m', (t) => {
  const game = run(t, { scenario: { ...empty, player: { carried: 3 },
    motes: [[0, 1.5001, 0], [1, 1.5, 0]], shades: [
      { id: 'S1', pos: [0, 5.8, 0] }, { id: 'S2', pos: [0, 5.801, 0] },
    ] }, frames: [{ tick: 0, pulse: true }], ticks: 15 });
  assert.equal(game.status, 0, game.stderr);
  assert.deepEqual(game.events.map(({ name }) => name), ['mote_picked', 'pulse']);
  assert.deepEqual(game.events[1].data.stunned_ids, ['S1']);
  assert.deepEqual(at(game, 15).shades[0].pos, [4, 5.8, 0]);
  assert.equal(at(game, 15).player.flames, 3);
});

test('khóa vùng sáng đẩy Bóng Mực đang đứng trong vùng ra trong tối đa 30 tick', (t) => {
  const game = run(t, { scenario: { ...empty, player: { carried: 10 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ pos: [0, 0.8, 0] }] },
    frames: [{ tick: 0, interact: true }], ticks: 45 });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(at(game, 1).player.flames, 3);
  assert.ok(at(game, 30).shades[0].pos[0] >= 6);
  assert.equal(at(game, 45).player.flames, 3);
});

test('mô phỏng chuỗi ba Đêm: điểm thua không cộng, thắng đúng hạn mở Đêm kế tiếp', (t) => {
  const campaign = createCampaign();
  const loss = run(t, { scenario: { ...empty, time_left_s: 1 / 60 }, ticks: 1 });
  assert.equal(loss.status, 0, loss.stderr);
  assert.equal(completeNight(campaign, loss.end.state, loss.end.score), 0);
  assert.equal(nextNight(campaign), false);
  for (const [night, count] of [[1, 5], [2, 6], [3, 7]]) {
    const game = run(t, { night, scenario: { ...empty, player: { carried: 10 }, time_left_s: 1 / 60,
      lanterns: Array.from({ length: count }, (_, i) => i === 0 ? { id: 'L1', pos: [0, 0, 0] }
        : { id: `L${i + 1}`, lit: true }) }, frames: [{ tick: 0, interact: true }] });
    assert.equal(game.status, 0, game.stderr);
    assert.deepEqual(game.end, { type: 'end', ticks: 1, state: 'won', score: 350 });
    assert.equal(completeNight(campaign, game.end.state, game.end.score), 350 * night);
    assert.equal(nextNight(campaign), night < 3);
  }
});

test('thắng Đảo Bến và Đảo Cau từ cấu hình mặc định bằng đầu vào đã lưu', (t) => {
  for (const [night, seed, name, ticks, score, count] of [
    [1, 12, 'full-night.inputs.json', 12691, 1366, 5],
    [2, 2, 'night-2.inputs.json', 15434, 1524, 6],
  ]) {
    const game = run(t, { night, seed, inputs: fixture(name), ticks: 21600, every: 600 });
    assert.equal(game.status, 0, game.stderr);
    assert.ok(game.snapshots[0].lanterns.every(({ lit }) => !lit));
    assert.equal(game.events.filter(({ name }) => name === 'lantern_lit').length, count);
    assert.deepEqual(game.end, { type: 'end', ticks, state: 'won', score });
  }
});

test('bật bục Đảo Chuông, đáp tầng 2 và nạp đèn cuối theo scenario v1.1', (t) => {
  const game = run(t, { night: 3, ticks: 100, scenario: fixture('phase-2/night-3-final.scenario.json'),
    inputs: fixture('phase-2/night-3-final.inputs.json') });
  assert.equal(game.status, 0, game.stderr);
  assert.equal(at(game, 54).player.pos[1], 6);
  assert.deepEqual(game.events.map(({ name }) => name), ['deposit', 'lantern_lit', 'game_over']);
  assert.equal(game.events[0].data.lantern_id, 'L1');
  assert.equal(game.end.state, 'won');
});
