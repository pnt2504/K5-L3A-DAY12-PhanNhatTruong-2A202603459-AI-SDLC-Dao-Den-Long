export const TAU = Math.PI * 2;
export const EPSILON = 1e-8;
export const START = Object.freeze([0, 0, 0]);
export const RAMP_WIDTH = 3;
export const TOWER_RADIUS = 2;

export function distanceXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function directionXZ(from, to, fallback = [1, 0]) {
  const distance = distanceXZ(from, to);
  return distance > EPSILON
    ? [(to[0] - from[0]) / distance, (to[2] - from[2]) / distance] : fallback;
}

export function polar(radius, angle, y = 0, x = 0, z = 0) {
  return [x + radius * Math.cos(angle), y, z + radius * Math.sin(angle)];
}

function ring(radius, count, offset = 0, y = 0, x = 0) {
  return Array.from({ length: count }, (_, index) =>
    polar(radius, offset * Math.PI / 180 + TAU * index / count, y, x));
}

const ramps = [30, 150].map((degrees) => {
  const angle = degrees * Math.PI / 180;
  return { angle, cos: Math.cos(angle), sin: Math.sin(angle) };
});

const maps = {
  1: {
    name: 'Đảo Bến', islands: [{ x: 0, z: 0, radius: 40 }],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 8), ...ring(33, 16)],
    shadePoints: ring(37, 12, 15, 0.8), shadeInterval: 480, shadeCap: 6,
    charms: [], pads: [],
  },
  2: {
    name: 'Đảo Cau', islands: [{ x: 0, z: 0, radius: 28 }, { x: 70, z: 0, radius: 28 }],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    bridge: { minX: 26, maxX: 44, halfWidth: 2 },
    motePoints: [0, 70].flatMap((x) => [...ring(10, 4, 0, 0, x), ...ring(22, 8, 0, 0, x)]),
    shadePoints: [0, 70].flatMap((x) => ring(26, 8, 22.5, 0.8, x)), shadeInterval: 420, shadeCap: 8,
    charms: [[35, 0, 0]],
    pads: [
      { pos: [20, 0, 18], target: [70, 0, 0], speed: 24, lift: 14 },
      { pos: [50, 0, -18], target: [0, 0, 0], speed: 24, lift: 14 },
    ],
  },
  3: {
    name: 'Đảo Chuông', islands: [{ x: 0, z: 0, radius: 45 }],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 18), ...Array.from({ length: 8 }, (_, i) => polar(18, (i + 1) * Math.PI / 9, 3)),
      ...ring(5, 4, 45, 6)],
    shadePoints: ring(43, 16, 0, 0.8), shadeInterval: 360, shadeCap: 10,
    charms: [[30, 0, 25], [-30, 0, 25]],
    pads: [{ pos: [0, 3, 13], target: [0, 3, 0], speed: 8, lift: 12 }],
    ramps,
  },
};

export function nightMap(night) {
  return maps[night];
}

function elevatedAt(map, x, z) {
  const radiusSquared = x * x + z * z;
  if (radiusSquared <= 64 + EPSILON) return 6;
  if (z > 0 && radiusSquared >= 144 - EPSILON && radiusSquared <= 576 + EPSILON) return 3;
  for (const { cos, sin } of map.ramps) {
    const cross = -x * sin + z * cos;
    if (Math.abs(cross) > RAMP_WIDTH / 2 + EPSILON) continue;
    const along = x * cos + z * sin;
    if (along >= 23.9 && along <= 30 + EPSILON) return Math.min(3, (30 - along) / 2);
  }
  return 0;
}

export function topAt(map, x, z) {
  if (map.ramps && x * x + z * z <= 45 ** 2 + EPSILON) return elevatedAt(map, x, z);
  const bridge = map.bridge;
  if (bridge && x >= bridge.minX && x <= bridge.maxX && Math.abs(z) <= bridge.halfWidth) return 0;
  for (const island of map.islands) {
    if ((x - island.x) ** 2 + (z - island.z) ** 2 <= island.radius ** 2 + EPSILON) return 0;
  }
  return -Infinity;
}

export function floorAt(map, x, z, ceiling = Infinity) {
  const top = topAt(map, x, z);
  if (top <= ceiling + EPSILON) return top;
  return ceiling >= -EPSILON ? 0 : -Infinity;
}

export function blockedAcross(map, from, x, z, footY, stepUp = 0) {
  if (!map.ramps) return false;
  const oldTop = topAt(map, from[0], from[2]);
  const newTop = topAt(map, x, z);
  if (newTop > footY + stepUp + EPSILON && newTop > oldTop + EPSILON) return true;
  return footY >= 6 - EPSILON && footY < 14 && x * x + z * z < TOWER_RADIUS ** 2 - EPSILON
    && from[0] ** 2 + from[2] ** 2 >= TOWER_RADIUS ** 2 - EPSILON;
}

export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let bits = Math.imul(state ^ (state >>> 15), state | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}
