import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { createGame, DEFAULT_INPUT, snapshot, stepGame } from './game.js';
import { DRIFTER_STATES, SHADE_STATES } from './rules.js';
import { nightMap } from './world.js';

const OPTIONS = ['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every'];
const REQUIRED = ['seed', 'night', 'ticks', 'out'];
const ACTIONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

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
  if (!nightMap(values.night)) throw new Error('--night phải là 1, 2 hoặc 3');
  if (values.ticks < 0 || values['snapshot-every'] < 1) {
    throw new Error('Cần --ticks >= 0 và --snapshot-every >= 1');
  }
  return values;
}

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const nonnegativeNumber = (value) => Number.isFinite(value) && value >= 0;
const boolean = (value) => typeof value === 'boolean';
const entityId = (value) => typeof value === 'string' && value.length > 0;
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

function validateEntities(entries, name, rules, needsPosition) {
  const ids = new Set();
  for (const [index, entity] of entries.entries()) {
    const path = `scenario.${name}[${index}]`;
    validateFields(entity, { id: entityId, pos: position, ...rules }, path);
    if (needsPosition) requireFormat(position(entity.pos), `${path}.pos`);
    if (entity.id === undefined) continue;
    requireFormat(!ids.has(entity.id), `${path}.id`);
    ids.add(entity.id);
  }
}

function validateScenario(value, night) {
  validateFields(value, {
    player: object,
    time_left_s: nonnegativeNumber,
    random_motes: boolean,
    random_shades: boolean,
    random_drifters: boolean,
    wind_enabled: boolean,
    motes: (motes) => Array.isArray(motes) && motes.every(position),
    shades: Array.isArray,
    drifters: Array.isArray,
    charms: Array.isArray,
    lanterns: Array.isArray,
  }, 'scenario');
  if (value.player !== undefined) {
    validateFields(value.player, {
      pos: position, carried: nonnegativeInteger, flames: nonnegativeInteger,
      invuln_ticks: nonnegativeInteger, dash_cd_ticks: nonnegativeInteger,
      pulse_cd_ticks: nonnegativeInteger, charm_ticks: nonnegativeInteger,
    }, 'scenario.player');
  }

  validateEntities(value.shades ?? [], 'shades', {
    state: (state) => SHADE_STATES.includes(state), state_ticks_left: nonnegativeInteger,
  }, true);
  validateEntities(value.drifters ?? [], 'drifters', {
    state: (state) => DRIFTER_STATES.includes(state), state_ticks_left: nonnegativeInteger,
    flee_ticks_left: nonnegativeInteger, stolen: nonnegativeInteger,
  }, true);
  validateEntities(value.charms ?? [], 'charms', {
    available: boolean, respawn_ticks: nonnegativeInteger, respawn_ticks_left: nonnegativeInteger,
    respawn_s: nonnegativeNumber,
  }, false);

  const validLanternIds = new Set(nightMap(night).lanterns.map((_, i) => `L${i + 1}`));
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
  const scenario = args.scenario ? loadJson(args.scenario, (value) => validateScenario(value, args.night)) : {};
  const frames = args.inputs ? loadJson(args.inputs, validateInputs) : [];
  const game = createGame(args.seed, scenario, args.night);
  const input = { ...DEFAULT_INPUT };
  let frameIndex = 0;
  const output = openSync(args.out, 'w');
  const write = (record) => writeSync(output, `${JSON.stringify(record)}\n`);

  try {
    write(snapshot(game));
    write({ type: 'event', tick: 0, name: 'night_start', data: { night: args.night } });
    while (game.tick < args.ticks && (game.state === 'playing' || game.state === 'paused')) {
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
