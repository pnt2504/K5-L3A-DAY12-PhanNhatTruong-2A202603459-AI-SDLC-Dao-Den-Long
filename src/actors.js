import { carryCapacity, CHARM_RESPAWN_TICKS, CHARM_TICKS, STEP, TICKS_PER_SECOND, tuning } from './rules.js';
import { blockedAcross, directionXZ, distanceXZ, EPSILON, floorAt, polar, TAU, topAt } from './world.js';
import { clearDrain, DRAIN_RANGE, drainTarget, hasSafeLight, isWeakLight, nearestLantern,
  returnToWander } from './lanterns.js';

const DROP_TTL = 480;
const DRIFTER_INTERVAL = 1200;
const FIRST_SHADE_TICK = 300;
const SHADE_SPAWNING_TICKS = 30;
const SHADE_PUSH_TICKS = 15;
const SHADE_RECOIL_TICKS = 60;
const SAFE_EJECT_TICKS = 30;
const CENTER_Y = 0.8;

function nextId(game, type, prefix) {
  const counter = `next${type}Id`;
  const ids = game[`${type.toLowerCase()}Ids`];
  let id;
  do id = `${prefix}${game[counter]++}`; while (ids?.has(id));
  ids?.add(id);
  return id;
}

function sortById(a, b) {
  const first = /^([SD])(\d+)$/.exec(a.id);
  const second = /^([SD])(\d+)$/.exec(b.id);
  if (first && second && first[1] === second[1]) return Number(first[2]) - Number(second[2]);
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

export function addMote(game, pos, kind = 'random', expiresAt = null) {
  game.motes.push({ id: nextId(game, 'Mote', 'M'), pos: [...pos], kind, expiresAt });
}

function addShade(game, { pos, id, state = 'chase', state_ticks_left: ticks = 0, target_lantern_id: target = null }) {
  const shade = {
    id: id ?? nextId(game, 'Shade', 'S'), pos: [...pos], state,
    stateUntil: ticks + game.simTick, ejection: null, push: null,
    targetLanternId: target, drainTicks: 0, wanderSince: null,
    angle: Math.atan2(pos[2], pos[0]) + Math.PI / 2,
  };
  game.shades.push(shade);
  game.shades.sort(sortById);
  return shade.id;
}

function addDrifter(game, data) {
  const state = data.state ?? 'idle';
  const drifter = {
    id: data.id ?? nextId(game, 'Drifter', 'D'), pos: [...data.pos], state, stolen: data.stolen ?? 0,
    fleeUntil: game.simTick + (data.state_ticks_left ?? data.flee_ticks_left ?? (state === 'flee' ? 240 : 0)),
    angle: Math.atan2(data.pos[2], data.pos[0]) + Math.PI / 2,
  };
  game.drifters.push(drifter);
  game.drifters.sort(sortById);
}

export function initializeActors(game, scenario) {
  game.motes = [];
  game.shades = [];
  game.drifters = [];
  game.nextMoteId = 1;
  game.nextShadeId = 1;
  game.nextDrifterId = 1;
  game.shadeIds = new Set((scenario.shades ?? []).map(({ id }) => id).filter(Boolean));
  game.drifterIds = new Set((scenario.drifters ?? []).map(({ id }) => id).filter(Boolean));
  game.randomMotes = scenario.random_motes ?? true;
  game.randomShades = scenario.random_shades ?? true;
  game.randomDrifters = scenario.random_drifters ?? game.night > 1;
  if (scenario.motes !== undefined) {
    for (const pos of scenario.motes) addMote(game, pos);
  } else if (game.randomMotes) {
    const points = [...game.map.motePoints];
    for (let index = 0; index < 20; index += 1) {
      const chosen = index + Math.floor(game.random() * (points.length - index));
      [points[index], points[chosen]] = [points[chosen], points[index]];
      addMote(game, points[index]);
    }
  }
  for (const shade of scenario.shades ?? []) addShade(game, shade);
  for (const drifter of scenario.drifters ?? []) addDrifter(game, drifter);
  const standardCharms = game.map.charms.map((pos, index) => ({ id: `C${index + 1}`, pos }));
  game.charms = (scenario.charms ?? standardCharms).map((charm, index) => {
    const id = charm.id ?? `C${index + 1}`;
    const ticks = charm.respawn_ticks ?? charm.respawn_ticks_left
      ?? (charm.respawn_s === undefined ? CHARM_RESPAWN_TICKS : Math.round(charm.respawn_s * TICKS_PER_SECOND));
    const available = charm.available ?? !(charm.respawn_ticks > 0 || charm.respawn_ticks_left > 0 || charm.respawn_s > 0);
    return { id, pos: [...(charm.pos ?? standardCharms.find((entry) => entry.id === id)?.pos ?? [0, 0, 0])],
      available, respawnAt: available ? 0 : ticks };
  });
}

export function updateTimers(game) {
  game.motes = game.motes.filter(({ expiresAt }) => expiresAt === null || expiresAt > game.simTick);
  game.drifters = game.drifters.filter(({ state, fleeUntil }) =>
    state !== 'removed' && (state !== 'flee' || fleeUntil > game.simTick));
  for (const charm of game.charms) {
    if (game.simTick >= charm.respawnAt) charm.available = true;
  }
  for (const shade of game.shades) {
    if (game.simTick < shade.stateUntil || !['spawning', 'recoil', 'stunned'].includes(shade.state)) continue;
    if (shade.state === 'stunned') returnToWander(shade, game.simTick);
    else shade.state = 'wander';
    shade.push = null;
  }
}

function inPickupRange(a, b) {
  return distanceXZ(a, b) <= tuning.pickup_radius + EPSILON && Math.abs(a[1] - b[1]) <= 1.5 + EPSILON;
}

export function pickUp(game, emit) {
  const player = game.player;
  game.motes = game.motes.filter((mote) => {
    if (player.carried >= carryCapacity(player) || !inPickupRange(player.pos, mote.pos)) return true;
    player.carried += 1;
    emit('mote_picked', { carried: player.carried });
    return false;
  });
  for (const charm of game.charms) {
    if (!charm.available || !inPickupRange(player.pos, charm.pos)) continue;
    charm.available = false;
    charm.respawnAt = game.simTick + CHARM_RESPAWN_TICKS;
    player.charmUntil = game.simTick + CHARM_TICKS;
    player.dashReadyAt = game.simTick;
    emit('charm_picked', { charm_id: charm.id, charm_ticks: CHARM_TICKS });
  }
}

export function shadeSafeAt(game, pos) {
  return game.lanterns.some((lantern) =>
    hasSafeLight(lantern) && distanceXZ(lantern.pos, pos) < tuning.safe_radius - EPSILON);
}

function ejectionTarget(game, pos) {
  let target;
  let best = Infinity;
  for (const lantern of game.lanterns) {
    if (!hasSafeLight(lantern) || distanceXZ(lantern.pos, pos) >= tuning.safe_radius) continue;
    const outward = Math.atan2(pos[2] - lantern.pos[2], pos[0] - lantern.pos[0]);
    for (let index = 0; index < 32; index += 1) {
      const candidate = polar(tuning.safe_radius + 2 * EPSILON, outward + index * TAU / 32,
        pos[1], lantern.pos[0], lantern.pos[2]);
      if (shadeSafeAt(game, candidate)) continue;
      const distance = distanceXZ(pos, candidate)
        + (topAt(game.map, candidate[0], candidate[2]) === -Infinity ? 1000 : 0);
      if (distance < best - EPSILON) {
        best = distance;
        target = candidate;
      }
    }
  }
  return target;
}

export function updateSafeZones(game) {
  for (const shade of game.shades) {
    if (shade.state === 'drain' && !drainTarget(game, shade)) returnToWander(shade, game.simTick);
    if (shade.ejection && game.simTick <= shade.ejection.until && !shadeSafeAt(game, shade.ejection.target)) continue;
    if (!shadeSafeAt(game, shade.pos)) {
      shade.ejection = null;
      continue;
    }
    const target = ejectionTarget(game, shade.pos);
    if (target) shade.ejection = { target, until: game.simTick + SAFE_EJECT_TICKS - 1 };
  }
}

function shadeTravel(game, shade, dx, dz) {
  const [x, y, z] = shade.pos;
  const length = dx * dx + dz * dz;
  if (length === 0) return true;
  let travel = 1;
  for (const lantern of game.lanterns) {
    if (!hasSafeLight(lantern)) continue;
    const ax = x - lantern.pos[0];
    const az = z - lantern.pos[2];
    const projection = ax * dx + az * dz;
    const offset = ax * ax + az * az - tuning.safe_radius ** 2;
    const discriminant = projection ** 2 - length * Math.max(0, offset);
    if (projection < 0 && discriminant > 0) {
      travel = Math.min(travel, Math.max(0, (-projection - Math.sqrt(discriminant)) / length));
    }
  }
  const nextX = x + dx * travel;
  const nextZ = z + dz * travel;
  const footY = y - CENTER_Y;
  if (topAt(game.map, nextX, nextZ) === -Infinity
      || blockedAcross(game.map, shade.pos, nextX, nextZ, footY, 0.22)) return false;
  const oldFloor = floorAt(game.map, x, z, footY + EPSILON);
  const newFloor = floorAt(game.map, nextX, nextZ, footY + 0.22);
  if (Number.isFinite(newFloor) && Math.abs(footY - oldFloor) < 0.22 && Math.abs(newFloor - oldFloor) < 0.23) {
    shade.pos[1] = newFloor + CENTER_Y;
  }
  shade.pos[0] = nextX;
  shade.pos[2] = nextZ;
  return travel === 1;
}

function setPush(shade, origin, meters, ticks, firstTick) {
  const [x, z] = directionXZ(origin, shade.pos);
  shade.push = { dx: x * meters / ticks, dz: z * meters / ticks, until: firstTick + ticks,
    firstTick };
}

function pulseDistance(player, pos) {
  return Math.hypot(player.pos[0] - pos[0], player.pos[1] + CENTER_Y - pos[1], player.pos[2] - pos[2]);
}

export function doPulse(game, emit) {
  const { player, simTick } = game;
  if (player.carried < tuning.pulse_cost || simTick < player.pulseReadyAt) return;
  player.carried -= tuning.pulse_cost;
  player.pulseReadyAt = simTick + tuning.pulse_cooldown_s * TICKS_PER_SECOND;
  const stunnedIds = [];
  for (const shade of game.shades) {
    if (pulseDistance(player, shade.pos) > tuning.pulse_radius + EPSILON) continue;
    game.score += shade.state === 'drain' ? tuning.score.per_drain_stun : tuning.score.per_stun;
    clearDrain(shade);
    shade.state = 'stunned';
    shade.stateUntil = simTick + tuning.pulse_stun_s * TICKS_PER_SECOND;
    setPush(shade, player.pos, tuning.pulse_push_m, SHADE_PUSH_TICKS, simTick);
    stunnedIds.push(shade.id);
  }
  emit('pulse', { stunned_ids: stunnedIds });
  for (const drifter of game.drifters) {
    if (pulseDistance(player, drifter.pos) > tuning.pulse_radius + EPSILON) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.fleeUntil = simTick + 240;
    } else if (drifter.state === 'flee' && drifter.stolen > 0) {
      const amount = drifter.stolen;
      const [x, y, z] = drifter.pos;
      const floor = floorAt(game.map, x, z, y);
      for (let index = 0; index < amount; index += 1) {
        addMote(game, [x, Number.isFinite(floor) ? floor : y, z], 'dropped', simTick + DROP_TTL);
      }
      drifter.stolen = 0;
      drifter.fleeUntil = simTick + 120;
      emit('drifter_drop', { drifter_id: drifter.id, amount });
    }
  }
}

function approachShade(game, shade, target, speed) {
  const [dx, dz] = directionXZ(shade.pos, target, [0, 0]);
  const travel = Math.min(distanceXZ(shade.pos, target), speed * STEP);
  shadeTravel(game, shade, dx * travel, dz * travel);
}

function moveWanderingShade(game, shade, speed) {
  const lamp = nearestLantern(game.lanterns, shade.pos, isWeakLight)
    ?? nearestLantern(game.lanterns, shade.pos, (lantern) => !lantern.lit);
  if (lamp) {
    const weak = isWeakLight(lamp);
    if (!weak || distanceXZ(shade.pos, lamp.pos) > DRAIN_RANGE + EPSILON) {
      approachShade(game, shade, lamp.pos, speed);
    }
    if (weak && distanceXZ(shade.pos, lamp.pos) <= DRAIN_RANGE + EPSILON) {
      shade.state = 'drain';
      shade.targetLanternId = lamp.id;
      shade.drainTicks = 0;
    }
  } else if (!shadeTravel(game, shade, Math.cos(shade.angle) * speed * STEP, Math.sin(shade.angle) * speed * STEP)) {
    shade.angle += Math.PI * 0.74;
  }
}

export function moveActors(game, reachable = game.player.respawnAt === null) {
  const { player, simTick } = game;
  for (const shade of game.shades) {
    if (shade.ejection) {
      const { target, until } = shade.ejection;
      const remaining = Math.max(1, until - simTick + 1);
      shade.pos[0] += (target[0] - shade.pos[0]) / remaining;
      shade.pos[2] += (target[2] - shade.pos[2]) / remaining;
      continue;
    }
    if (shade.state === 'spawning') continue;
    if (shade.state === 'recoil' || shade.state === 'stunned') {
      const push = shade.push;
      if (push && simTick >= push.firstTick && simTick < push.until
          && !shadeTravel(game, shade, push.dx, push.dz)) shade.push = null;
      continue;
    }
    const distance = distanceXZ(player.pos, shade.pos);
    const speed = game.night === 3 ? 4.5 : tuning.shade_speed;
    if (shade.state === 'drain') {
      if (!reachable || distance > 6 + EPSILON) continue;
      clearDrain(shade);
      shade.state = 'chase';
    } else {
      if (shade.wanderSince === simTick) continue;
      if (!reachable || distance > 18 + EPSILON) shade.state = 'wander';
      else if (distance <= 12 + EPSILON) shade.state = 'chase';
    }
    if (shade.state === 'chase') approachShade(game, shade, player.pos, speed);
    else moveWanderingShade(game, shade, speed);
  }
  for (const drifter of game.drifters) {
    if (drifter.state === 'flee') {
      const [dx, dz] = directionXZ(player.pos, drifter.pos);
      drifter.pos[0] += dx * 7 * STEP;
      drifter.pos[2] += dz * 7 * STEP;
      continue;
    }
    const distance = distanceXZ(player.pos, drifter.pos);
    drifter.state = reachable && player.carried >= 5 && distance <= 15 + EPSILON ? 'chase' : 'idle';
    if (drifter.state === 'chase') {
      const [dx, dz] = directionXZ(drifter.pos, player.pos, [0, 0]);
      const travel = Math.min(distance, 7 * STEP);
      drifter.pos[0] += dx * travel;
      drifter.pos[2] += dz * travel;
    } else {
      drifter.angle += STEP * 0.35;
      drifter.pos[0] += Math.cos(drifter.angle) * 2 * STEP;
      drifter.pos[2] += Math.sin(drifter.angle) * 2 * STEP;
    }
  }
}

export function resolveContact(game, emit) {
  const { player, simTick } = game;
  for (const drifter of game.drifters) {
    if (drifter.state !== 'chase' || distanceXZ(player.pos, drifter.pos) > 1.2 + EPSILON) continue;
    const amount = Math.min(3, player.carried);
    player.carried -= amount;
    drifter.stolen = amount;
    drifter.state = 'flee';
    drifter.fleeUntil = simTick + 240;
    emit('drifter_steal', { drifter_id: drifter.id, amount, carried: player.carried });
  }
  if (simTick < player.invulnerableUntil || shadeSafeAt(game, player.pos)) return;
  for (const shade of game.shades) {
    if (shade.ejection || (shade.state !== 'chase' && shade.state !== 'wander')
      || distanceXZ(player.pos, shade.pos) > tuning.shade_hit_radius + EPSILON
      || Math.abs(player.pos[1] - shade.pos[1]) > 1.5 + EPSILON) continue;
    player.flames -= 1;
    player.invulnerableUntil = simTick + tuning.invuln_s * TICKS_PER_SECOND;
    const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
    player.carried -= dropped;
    for (let index = 0; index < dropped; index += 1) {
      const [x, , z] = polar(1.5 + game.random(), game.random() * TAU, 0, player.pos[0], player.pos[2]);
      const floor = floorAt(game.map, x, z, player.pos[1] + 0.22);
      const y = Number.isFinite(floor) ? floor : player.pos[1];
      addMote(game, [x, y, z], 'dropped', simTick + DROP_TTL);
    }
    shade.state = 'recoil';
    shade.stateUntil = simTick + SHADE_RECOIL_TICKS + 1;
    setPush(shade, player.pos, 2, SHADE_RECOIL_TICKS, simTick + 1);
    emit('player_hit', { by: 'shade', flames: player.flames, dropped });
    break;
  }
}

function choose(game, points) {
  return points.length > 0 ? points[Math.floor(game.random() * points.length)] : null;
}

export function spawnActors(game, emit) {
  const { map, simTick } = game;
  if (game.randomMotes && simTick % 240 === 0 && game.motes.length < 30) {
    const point = choose(game, map.motePoints.filter((position) =>
      !game.motes.some((mote) => distanceXZ(position, mote.pos) < EPSILON
        && Math.abs(position[1] - mote.pos[1]) < EPSILON)));
    if (point) addMote(game, point);
  }
  if (game.randomShades && simTick >= FIRST_SHADE_TICK
      && (simTick - FIRST_SHADE_TICK) % map.shadeInterval === 0) {
    const count = simTick === FIRST_SHADE_TICK ? 2 : 1;
    for (let index = 0; index < count && game.shades.length < map.shadeCap; index += 1) {
      const point = choose(game, map.shadePoints.filter((position) =>
        distanceXZ(position, game.player.pos) >= 15 - EPSILON && !shadeSafeAt(game, position)
        && !game.shades.some((shade) => distanceXZ(position, shade.pos) < 1)));
      if (!point) break;
      const id = addShade(game, { pos: point, state: 'spawning', state_ticks_left: SHADE_SPAWNING_TICKS });
      emit('shade_spawned', { id });
    }
  }
  if (game.night > 1 && game.randomDrifters && simTick % DRIFTER_INTERVAL === 0 && game.drifters.length < 2) {
    const point = choose(game, map.shadePoints.filter((pos) =>
      !game.drifters.some((drifter) => distanceXZ(pos, drifter.pos) < 1)));
    if (point) addDrifter(game, { pos: point });
  }
}
