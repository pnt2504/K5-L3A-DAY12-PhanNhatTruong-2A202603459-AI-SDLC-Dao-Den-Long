import { TICKS_PER_SECOND, tuning } from './rules.js';
import { distanceXZ, EPSILON } from './world.js';

export const MAX_FUEL_UNITS = tuning.fuel_max * TICKS_PER_SECOND;
export const SAFE_FUEL_UNITS = tuning.low_fuel_threshold * TICKS_PER_SECOND;
const FUEL_UNITS_PER_MOTE = tuning.fuel_per_mote * TICKS_PER_SECOND;
export const DRAIN_RANGE = 2;

export function createLantern(id, position, change) {
  const cost = change?.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
  const deposited = change?.deposited ?? (change?.lit ? cost : 0);
  const lit = change?.lit ?? deposited >= cost;
  return { id, pos: [...(change?.pos ?? position)], deposited, lit, everLit: lit || (change?.ever_lit ?? false),
    fuelUnits: lit ? Math.round((change?.fuel ?? tuning.fuel_max) * TICKS_PER_SECOND) : 0, relitCount: 0 };
}

export function lightCost(lantern) {
  return lantern.everLit ? tuning.relight_cost : tuning.lantern_cost;
}

export function hasSafeLight(lantern) {
  return lantern.lit && lantern.fuelUnits >= SAFE_FUEL_UNITS;
}

export function isWeakLight(lantern) {
  return lantern.lit && lantern.fuelUnits < SAFE_FUEL_UNITS;
}

export function fuelValue(lantern) {
  return Math.round(lantern.fuelUnits * 10 / TICKS_PER_SECOND) / 10;
}

export function nearestLantern(lanterns, from, eligible, limit = Infinity) {
  let target;
  let nearest = Infinity;
  // Lanterns are stored in ascending ID order.
  for (const lantern of lanterns) {
    if (!eligible(lantern)) continue;
    const distance = distanceXZ(from, lantern.pos);
    if (distance <= limit + EPSILON && distance < nearest - EPSILON) {
      nearest = distance;
      target = lantern;
    }
  }
  return target;
}

export function nearbyLantern(game) {
  return nearestLantern(game.lanterns, game.player.pos, (lantern) =>
    lantern.lit ? lantern.fuelUnits < MAX_FUEL_UNITS : lantern.deposited < lightCost(lantern),
  tuning.interact_radius);
}

export function interactWithLantern(game, emit) {
  if (game.player.carried === 0) return;
  const lantern = nearbyLantern(game);
  if (!lantern) return;
  const lit = lantern.lit;
  const cost = lightCost(lantern);
  const needed = lit ? Math.ceil((MAX_FUEL_UNITS - lantern.fuelUnits) / FUEL_UNITS_PER_MOTE)
    : cost - lantern.deposited;
  const used = Math.min(game.player.carried, needed);
  game.player.carried -= used;
  game.score += used * tuning.score.per_mote;

  if (lit) {
    lantern.fuelUnits = Math.min(MAX_FUEL_UNITS, lantern.fuelUnits + used * FUEL_UNITS_PER_MOTE);
    emit('refuel', { lantern_id: lantern.id, amount: used, fuel: fuelValue(lantern) });
    return;
  }
  lantern.deposited += used;
  emit('deposit', { lantern_id: lantern.id, amount: used, deposited: lantern.deposited });
  if (lantern.deposited < cost) return;

  const relight = lantern.everLit;
  lantern.lit = true;
  lantern.everLit = true;
  lantern.fuelUnits = MAX_FUEL_UNITS;
  if (relight) lantern.relitCount += 1;
  game.player.successfulLights += 1;
  game.score += relight ? tuning.score.per_relight : tuning.score.per_lantern;
  emit('lantern_lit', { lantern_id: lantern.id, relight });
}

export function drainTarget(game, shade) {
  return game.lanterns.find((lantern) => lantern.id === shade.targetLanternId && isWeakLight(lantern)
    && distanceXZ(lantern.pos, shade.pos) <= DRAIN_RANGE + EPSILON);
}

export function clearDrain(shade) {
  shade.targetLanternId = null;
  shade.drainTicks = 0;
}

export function returnToWander(shade, simTick) {
  clearDrain(shade);
  shade.state = 'wander';
  shade.wanderSince = simTick;
}

export function burnFuel(game, emit) {
  const reports = [];
  for (const shade of game.shades) {
    if (shade.state !== 'drain') continue;
    const lantern = drainTarget(game, shade);
    if (!lantern) {
      returnToWander(shade, game.simTick);
      continue;
    }
    shade.drainTicks += 1;
    lantern.fuelUnits -= tuning.drain_per_s;
    if (shade.drainTicks % TICKS_PER_SECOND === 0) reports.push([lantern, shade.id]);
  }
  for (const lantern of game.lanterns) {
    if (lantern.lit) lantern.fuelUnits = Math.max(0, lantern.fuelUnits - tuning.fuel_decay_per_s);
  }
  for (const [lantern, id] of reports) {
    emit('fuel_drain', { lantern_id: lantern.id, shade_id: id, fuel: fuelValue(lantern) });
  }
  for (const lantern of game.lanterns) {
    if (!lantern.lit || lantern.fuelUnits > 0) continue;
    lantern.lit = false;
    lantern.deposited = 0;
    emit('lantern_out', { lantern_id: lantern.id });
  }
}

export function lanternSnapshots(game, roundPosition) {
  return game.lanterns.map((lantern) => ({
    id: lantern.id, pos: lantern.pos.map(roundPosition), lit: lantern.lit, deposited: lantern.deposited,
    fuel: fuelValue(lantern), ever_lit: lantern.everLit, relit_count: lantern.relitCount,
  }));
}

export function dawnThreshold(game) {
  return Math.ceil(game.lanterns.length * tuning.win_ratio);
}
