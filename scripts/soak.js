import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { createGame, stepGame, TICKS_PER_SECOND } from '../src/game.js';
import { makeRandom, TAU } from '../src/world.js';

const MEGABYTE = 1024 ** 2;

function integer(value, expected) {
  const number = Number(value);
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(number)) {
    throw new Error(`Cần ${expected} là số nguyên`);
  }
  return number;
}

function playNight(game, seed) {
  const random = makeRandom(seed);
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false,
    pulse: false, interact: false, pause: false };
  const limit = game.duration * TICKS_PER_SECOND;
  for (let step = 0; step < limit && game.state === 'playing'; step += 1) {
    if (step % 30 === 0) {
      const angle = random() * TAU;
      input.move = [Math.cos(angle), Math.sin(angle)];
    }
    input.jump = random() < 0.05;
    input.dash = random() < 0.03;
    input.pulse = random() < 0.02;
    input.interact = random() < 0.10;
    stepGame(game, input);
  }
  return game.state;
}

function sampleRSS() {
  globalThis.gc?.();
  return process.memoryUsage.rss() / MEGABYTE;
}

function run() {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, nights: { type: 'string' }, out: { type: 'string' } } });
  const seed = integer(values.seed, '--seed');
  const nights = integer(values.nights, '--nights');
  if (nights < 1 || !values.out || !Number.isSafeInteger(seed + nights - 1)) {
    throw new Error('Cần --nights dương, seed hợp lệ và --out.');
  }
  const start = performance.now();
  let game = createGame(seed);
  const memStart = sampleRSS();
  const results = [];
  let crashes = 0;
  for (let index = 0; index < nights; index += 1) {
    try {
      game ??= createGame(seed + index, {}, index % 3 + 1);
      results.push(playNight(game, seed + index));
    } catch (error) {
      process.stderr.write(`Đêm thử ${index + 1}: ${error.message}\n`);
      results.push('crashed');
      crashes += 1;
    } finally {
      game = null;
    }
  }
  const memEnd = sampleRSS();
  const output = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd,
    duration_s: (performance.now() - start) / 1000 };
  writeFileSync(values.out, `${JSON.stringify(output, null, 2)}\n`);
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
