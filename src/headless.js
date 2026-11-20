import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { createGame, DEFAULT_INPUT, snapshot, stepGame, tuning } from './game.js';

const OPTIONS = ['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every'];
const REQUIRED = ['seed', 'night', 'ticks', 'out'];
const ACTIONS = ['jump', 'interact', 'pulse', 'dash'];

class FormatError extends Error {}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const name = flag.slice(2);
    const value = args[index + 1];
    if (!flag.startsWith('--') || !OPTIONS.includes(name) || Object.hasOwn(values, name)
      || !value || value.startsWith('--')) throw new Error(`Tham số không hợp lệ: ${flag}`);
    values[name] = value;
  }
  for (const name of REQUIRED) {
    if (values[name] === undefined) throw new Error(`Thiếu --${name}`);
  }
  for (const name of ['seed', 'night', 'ticks', 'snapshot-every']) {
    if (values[name] === undefined) continue;
    const value = Number(values[name]);
    if (!/^[+-]?\d+$/.test(values[name]) || !Number.isSafeInteger(value)) {
      throw new Error(`--${name} phải là số nguyên`);
    }
    values[name] = value;
  }
  values['snapshot-every'] ??= 10;
  if (values.night !== 1) throw new Error('Phase 1 chỉ hỗ trợ --night 1');
  if (values.ticks < 0 || values['snapshot-every'] < 1) {
    throw new Error('Cần --ticks >= 0 và --snapshot-every >= 1');
  }
  return values;
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const boolean = (value) => typeof value === 'boolean';
const position = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const movement = (value) => Array.isArray(value) && value.length === 2
  && value.every((component) => Number.isFinite(component) && Math.abs(component) <= 1);

function requireFormat(valid, field) {
  if (!valid) throw new FormatError(`Giá trị không hợp lệ tại ${field}`);
}

function validateFields(value, rules, path) {
  requireFormat(object(value), path);
  for (const [key, validate] of Object.entries(rules)) {
    if (Object.hasOwn(value, key)) requireFormat(validate(value[key]), `${path}.${key}`);
  }
}

function validateInputs(value) {
  requireFormat(object(value) && Array.isArray(value.frames), 'inputs.frames');
  let previousTick = -1;
  for (const [index, frame] of value.frames.entries()) {
    const path = `inputs.frames[${index}]`;
    validateFields(frame, { move: movement, cam_yaw_deg: Number.isFinite }, path);
    requireFormat(nonnegativeInteger(frame.tick) && frame.tick > previousTick, `${path}.tick`);
    for (const key of ACTIONS) {
      if (Object.hasOwn(frame, key)) requireFormat(boolean(frame[key]), `${path}.${key}`);
    }
    previousTick = frame.tick;
  }
  return value.frames;
}

function validateScenario(value) {
  validateFields(value, {
    player: object,
    time_left_s: (time) => Number.isFinite(time) && time >= 0,
    random_motes: boolean,
    random_shades: boolean,
    motes: (motes) => Array.isArray(motes) && motes.every(position),
    shades: Array.isArray,
    lanterns: Array.isArray,
  }, 'scenario');
  if (value.player !== undefined) {
    validateFields(value.player, { pos: position, carried: nonnegativeInteger, flames: nonnegativeInteger },
      'scenario.player');
  }

  const shadeIds = new Set();
  for (const [index, shade] of (value.shades ?? []).entries()) {
    const path = `scenario.shades[${index}]`;
    validateFields(shade, { id: (id) => typeof id === 'string' && id.length > 0 }, path);
    requireFormat(position(shade.pos), `${path}.pos`);
    if (shade.id !== undefined) {
      requireFormat(!shadeIds.has(shade.id), `${path}.id`);
      shadeIds.add(shade.id);
    }
  }

  const validLanternIds = new Set(Array.from({ length: tuning.lantern_count_night1 }, (_, i) => `L${i + 1}`));
  for (const [index, lantern] of (value.lanterns ?? []).entries()) {
    const path = `scenario.lanterns[${index}]`;
    validateFields(lantern, { pos: position, lit: boolean, deposited: nonnegativeInteger }, path);
    requireFormat(validLanternIds.delete(lantern.id), `${path}.id`);
  }
  return value;
}

function loadJson(path, validate) {
  const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  try {
    return validate(JSON.parse(content));
  } catch (error) {
    throw new FormatError(`${path}: ${error.message}`);
  }
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const scenario = args.scenario ? loadJson(args.scenario, validateScenario) : {};
  const frames = args.inputs ? loadJson(args.inputs, validateInputs) : [];
  const game = createGame(args.seed, scenario);
  const input = { ...DEFAULT_INPUT };
  let frameIndex = 0;
  const output = openSync(args.out, 'w');
  const write = (record) => writeSync(output, `${JSON.stringify(record)}\n`);

  try {
    write(snapshot(game));
    while (game.tick < args.ticks && game.state === 'playing') {
      if (frames[frameIndex]?.tick === game.tick) {
        const frame = frames[frameIndex++];
        if (frame.move !== undefined) input.move = frame.move;
        if (frame.cam_yaw_deg !== undefined) input.cam_yaw_deg = frame.cam_yaw_deg;
        for (const key of ACTIONS) {
          if (frame[key] !== undefined) input[key] = frame[key];
        }
      }
      for (const event of stepGame(game, input)) write(event);
      if (game.tick % args['snapshot-every'] === 0) write(snapshot(game));
    }
    write({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  } finally {
    closeSync(output);
  }
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error instanceof FormatError ? 2 : 1;
}
