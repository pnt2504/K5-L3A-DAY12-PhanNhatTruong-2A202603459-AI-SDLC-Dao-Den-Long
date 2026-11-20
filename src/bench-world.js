import { createGame } from './game.js';
import { moveActors, updateSafeZones } from './actors.js';
import { makeRandom, polar, TAU } from './world.js';

function distributedPoints(count, random, height) {
  const rotation = random() * TAU;
  return Array.from({ length: count }, (_, index) => {
    const radius = 39.5 * Math.sqrt((index + 0.25 + random() * 0.5) / count);
    const angle = rotation + index * Math.PI * (3 - Math.sqrt(5)) + (random() - 0.5) * 0.22;
    return polar(radius, angle, height);
  });
}

export function createBenchWorld(seed) {
  const random = makeRandom(seed);
  const shades = distributedPoints(200, random, 0.8).map((pos) => ({ pos, state: 'wander' }));
  const motes = distributedPoints(100, random, 0);
  const lanterns = [1, 2, 3].map((index) => ({ id: `L${index}`, lit: true, fuel: 100 }));
  const game = createGame(seed, { shades, motes, lanterns, random_motes: false, random_shades: false,
    random_drifters: false, wind_enabled: false });
  game.standardBenchmark = true;
  return game;
}

export function stepBenchWorld(game) {
  game.tick += 1;
  game.simTick += 1;
  updateSafeZones(game);
  moveActors(game, false);
}

export function benchCamera(seconds) {
  const angle = TAU * (seconds % 15) / 15;
  return [30 * Math.cos(angle), 15, 30 * Math.sin(angle)];
}
