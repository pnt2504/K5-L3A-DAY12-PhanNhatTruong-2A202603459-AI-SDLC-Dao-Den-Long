import { DEFAULT_INPUT, STEP, TICKS_PER_SECOND, tuning } from './rules.js';
import { blockedAcross, directionXZ, distanceXZ, EPSILON, floorAt, makeRandom, nightMap, START } from './world.js';
import { doPulse, initializeActors, moveActors, pickUp, resolveContact, spawnActors, updateSafeZones,
  updateTimers } from './actors.js';

export { DEFAULT_INPUT, TICKS_PER_SECOND, tuning } from './rules.js';

const GRAVITY = 20;
const JUMP_SPEED = 7;
const WALK_STEP = 0.22;
const FALL_DEPTH = -10;
const RESPAWN_TICKS = 60;
const WIND_INTERVAL = 1800;
const WIND_START_WARNING = 120;
const WIND_ACTIVE_TICKS = 300;

export function createGame(seed, scenario = {}, night = 1) {
  const map = nightMap(night);
  const pos = [...(scenario.player?.pos ?? START)];
  const duration = scenario.time_left_s ?? tuning[`night${night}_duration_s`];
  const game = {
    night, map, tick: 0, simTick: 0, state: 'playing', reason: null, score: 0,
    duration, timeLeft: duration, random: makeRandom(seed),
    wind: { enabled: night === 3 && (scenario.wind_enabled ?? true), active: false, warning: false, dirDeg: 0 },
    windRandom: makeRandom((seed ^ 0x47ae227d) >>> 0),
    previousInput: DEFAULT_INPUT,
    jumped: false,
    player: {
      pos, vel: [0, 0, 0], verticalSpeed: 0, yaw: 0,
      grounded: floorAt(map, pos[0], pos[2], pos[1]) === pos[1],
      flames: scenario.player?.flames ?? tuning.flames, carried: scenario.player?.carried ?? 0,
      invulnerableUntil: scenario.player?.invuln_ticks ?? 0,
      pulseReadyAt: scenario.player?.pulse_cd_ticks ?? 0,
      dashReadyAt: scenario.player?.dash_cd_ticks ?? 0,
      charmUntil: scenario.player?.charm_ticks ?? 0,
      dash: null, launch: null, respawnAt: null,
    },
    lanterns: map.lanterns.map((position, index) => {
      const id = `L${index + 1}`;
      const change = scenario.lanterns?.find((lantern) => lantern.id === id);
      const deposited = change?.deposited ?? (change?.lit ? tuning.lantern_cost : 0);
      return { id, pos: [...(change?.pos ?? position)], deposited,
        lit: change?.lit ?? deposited >= tuning.lantern_cost };
    }),
  };
  initializeActors(game, scenario);
  return game;
}

function updateWind(game) {
  if (!game.wind.enabled) return;
  const { wind, simTick } = game;
  const cycle = simTick % WIND_INTERVAL;
  wind.warning = cycle >= WIND_INTERVAL - WIND_START_WARNING;
  wind.active = simTick >= WIND_INTERVAL && cycle < WIND_ACTIVE_TICKS;
  if (cycle === WIND_INTERVAL - WIND_START_WARNING) wind.dirDeg = game.windRandom() * 360;
}

function movementInput(input) {
  const [x, z] = input.move;
  const scale = Math.max(1, Math.hypot(x, z));
  const yaw = (input.cam_yaw_deg % 360) * Math.PI / 180;
  return [(x * Math.cos(yaw) + z * Math.sin(yaw)) / scale,
    (-x * Math.sin(yaw) + z * Math.cos(yaw)) / scale];
}

function launchFromPad(game) {
  const { player } = game;
  if (!player.grounded) return false;
  const pad = game.map.pads.find(({ pos }) => Math.abs(pos[1] - player.pos[1]) < EPSILON
    && distanceXZ(pos, player.pos) <= 1 + EPSILON);
  if (!pad) return false;
  const [dx, dz] = directionXZ(pad.pos, pad.target);
  player.launch = [dx * pad.speed, dz * pad.speed];
  player.verticalSpeed = pad.lift;
  player.grounded = false;
  player.vel = [player.launch[0], pad.lift, player.launch[1]];
  player.yaw = Math.atan2(dx, dz);
  game.jumped = true;
  return true;
}

function movePlayer(game, input, pressed, emit) {
  const { player, simTick, map } = game;
  if (player.dash && simTick >= player.dash.until) player.dash = null;
  const [x, y, z] = player.pos;
  const [inputX, inputZ] = movementInput(input);
  const facing = [Math.sin(player.yaw), Math.cos(player.yaw)];
  const intended = player.launch ?? [inputX, inputZ];
  const moving = Math.hypot(...intended) > EPSILON;
  if (moving && !player.dash) player.yaw = Math.atan2(...intended);
  if (pressed('dash') && !player.dash && (simTick < player.charmUntil || simTick >= player.dashReadyAt)) {
    const direction = moving ? directionXZ(START, [intended[0], 0, intended[1]]) : facing;
    player.dash = { direction, until: simTick + tuning.dash_duration_s * TICKS_PER_SECOND };
    player.dashReadyAt = simTick < player.charmUntil ? simTick : simTick + tuning.dash_cooldown_s * TICKS_PER_SECOND;
    emit('dash', {});
  }

  if (!launchFromPad(game) && pressed('jump') && player.grounded && !player.dash) {
    player.grounded = false;
    player.verticalSpeed = JUMP_SPEED;
    game.jumped = true;
  }
  const speed = simTick < player.charmUntil ? 7.2 : tuning.player_speed;
  let [vx, vz] = player.dash ? player.dash.direction.map((value) => value * tuning.dash_speed)
    : player.launch ?? [inputX * speed, inputZ * speed];
  if (game.wind.active) {
    const direction = game.wind.dirDeg * Math.PI / 180;
    vx += 2 * Math.cos(direction);
    vz += 2 * Math.sin(direction);
  }

  const wasGrounded = player.grounded;
  const tentativeY = !wasGrounded && !player.dash
    ? y + player.verticalSpeed * STEP - GRAVITY * STEP ** 2 / 2 : y;
  const stepUp = wasGrounded ? WALK_STEP : 0;
  let nx = x + vx * STEP;
  let nz = z + vz * STEP;
  if (blockedAcross(map, player.pos, nx, nz, tentativeY, stepUp)) {
    if (!blockedAcross(map, player.pos, nx, z, tentativeY, stepUp)) nz = z;
    else if (!blockedAcross(map, player.pos, x, nz, tentativeY, stepUp)) nx = x;
    else {
      nx = x;
      nz = z;
    }
  }
  player.pos[0] = nx;
  player.pos[2] = nz;
  const nearbyFloor = floorAt(map, nx, nz, y + stepUp);
  if (wasGrounded && Math.abs(y - nearbyFloor) <= WALK_STEP + EPSILON) {
    player.pos[1] = nearbyFloor;
    player.verticalSpeed = 0;
  } else if (player.dash) {
    player.grounded = false;
  } else {
    const vertical = wasGrounded ? y - GRAVITY * STEP ** 2 / 2 : tentativeY;
    const landingFloor = floorAt(map, nx, nz, Math.max(y, vertical));
    player.verticalSpeed -= GRAVITY * STEP;
    player.grounded = player.verticalSpeed <= 0 && Number.isFinite(landingFloor)
      && landingFloor >= vertical - EPSILON;
    player.pos[1] = player.grounded ? landingFloor : vertical;
    if (player.grounded) {
      player.verticalSpeed = 0;
      player.launch = null;
    }
  }
  player.vel = [(nx - x) * TICKS_PER_SECOND, player.dash ? 0 : player.verticalSpeed, (nz - z) * TICKS_PER_SECOND];
  if (player.grounded) launchFromPad(game);
}

function moveOrRespawn(game, input, pressed, emit) {
  const { player, simTick } = game;
  if (player.respawnAt !== null) {
    if (simTick >= player.respawnAt) {
      player.pos = [...START];
      player.vel = [0, 0, 0];
      player.grounded = true;
      player.verticalSpeed = 0;
      player.yaw = 0;
      player.invulnerableUntil = simTick + tuning.invuln_s * TICKS_PER_SECOND;
      player.respawnAt = null;
    }
    return false;
  }
  movePlayer(game, input, pressed, emit);
  if (player.pos[1] >= FALL_DEPTH - EPSILON || !tuning.fall_enabled) return true;
  const lost = player.carried;
  player.flames -= 1;
  player.carried = 0;
  player.vel = [0, 0, 0];
  player.dash = null;
  player.launch = null;
  if (player.flames > 0) player.respawnAt = simTick + RESPAWN_TICKS;
  emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
  return false;
}

export function nearbyLantern(game, from = game.player.pos, limit = tuning.interact_radius) {
  let target;
  let nearest = Infinity;
  for (const lantern of game.lanterns) {
    const distance = distanceXZ(from, lantern.pos);
    if (!lantern.lit && distance <= limit + EPSILON && distance < nearest - EPSILON) {
      target = lantern;
      nearest = distance;
    }
  }
  return target;
}

function deposit(game, emit) {
  const target = nearbyLantern(game);
  if (!target) return;
  const amount = Math.min(game.player.carried, Math.max(0, tuning.lantern_cost - target.deposited));
  if (amount === 0) return;
  game.player.carried -= amount;
  target.deposited += amount;
  game.score += amount * tuning.score.per_mote;
  emit('deposit', { lantern_id: target.id, amount, deposited: target.deposited });
  if (target.deposited === tuning.lantern_cost) {
    target.lit = true;
    game.score += tuning.score.per_lantern;
    emit('lantern_lit', { lantern_id: target.id });
  }
}

function resolveEnd(game, emit) {
  if (game.player.flames <= 0) {
    game.state = 'lost';
    game.reason = 'no_flames';
  } else if (game.lanterns.every(({ lit }) => lit)) {
    game.state = 'won';
    game.reason = 'all_lit';
    game.score += Math.floor(game.timeLeft + EPSILON) * tuning.score.per_second_left
      + game.player.flames * tuning.score.per_flame_left;
  } else if (game.timeLeft <= 0) {
    game.state = 'lost';
    game.reason = 'dawn';
  }
  if (game.reason) emit('game_over', { result: game.state, reason: game.reason });
}

export function stepGame(game, input = DEFAULT_INPUT) {
  if (game.state === 'won' || game.state === 'lost') return [];
  game.tick += 1;
  game.jumped = false;
  const previous = game.previousInput;
  const pressed = (key) => input[key] && !previous[key];
  const events = [];
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data });
  game.previousInput = { ...input };
  if (pressed('pause')) {
    game.state = game.state === 'paused' ? 'playing' : 'paused';
    emit(game.state === 'paused' ? 'paused' : 'resumed', {});
  }
  if (game.state === 'paused') return events;

  game.simTick += 1;
  game.timeLeft = Math.max(0, game.duration - game.simTick / TICKS_PER_SECOND);
  updateWind(game);
  updateTimers(game);
  const present = game.player.flames > 0 && moveOrRespawn(game, input, pressed, emit);
  if (present) {
    pickUp(game, emit);
    if (pressed('interact')) deposit(game, emit);
  }
  updateSafeZones(game);
  if (present && pressed('pulse')) doPulse(game, emit);
  moveActors(game);
  if (present) resolveContact(game, emit);
  spawnActors(game, emit);
  resolveEnd(game, emit);
  return events;
}

function rounded(value) {
  return Number(value.toFixed(3)) || 0;
}

function remaining(until, now) {
  return Math.max(0, until - now) / TICKS_PER_SECOND;
}

export function snapshot(game) {
  const { player, simTick } = game;
  return {
    type: 'snapshot', tick: game.tick, sim_tick: simTick, state: game.state, night: game.night,
    time_left_s: game.timeLeft, score: game.score,
    wind: { active: game.wind.active, dir_deg: game.wind.dirDeg },
    player: { pos: player.pos.map(rounded), vel: player.vel.map(rounded), flames: player.flames,
      carried: player.carried, grounded: player.grounded, invuln: simTick < player.invulnerableUntil,
      dash_cd_s: simTick < player.charmUntil ? 0 : remaining(player.dashReadyAt, simTick),
      pulse_cd_s: remaining(player.pulseReadyAt, simTick),
      charm_s: remaining(player.charmUntil, simTick) },
    lanterns: game.lanterns.map(({ id, pos, lit, deposited }) => ({ id, pos: pos.map(rounded), lit, deposited })),
    shades: game.shades.map(({ id, pos, state }) => ({ id, pos: pos.map(rounded), state })),
    motes_active: game.motes.length,
    motes: game.motes.map(({ id, pos, kind, expiresAt }) =>
      ({ id, pos: pos.map(rounded), kind, ttl_s: expiresAt === null ? null : remaining(expiresAt, simTick) })),
    drifters: game.drifters.map(({ id, pos, state, stolen }) => ({ id, pos: pos.map(rounded), state, stolen })),
    charms: game.charms.map(({ id, available, respawnAt }) =>
      ({ id, available, respawn_s: available ? 0 : remaining(respawnAt, simTick) })),
  };
}
