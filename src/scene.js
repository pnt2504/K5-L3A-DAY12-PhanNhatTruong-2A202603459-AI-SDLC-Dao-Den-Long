import * as THREE from 'three';
import { TICKS_PER_SECOND, tuning } from './rules.js';
import { hasSafeLight, isWeakLight, MAX_FUEL_UNITS } from './lanterns.js';
import { RAMP_WIDTH, TOWER_RADIUS } from './world.js';

const palette = {
  sky: '#0E1430',
  fog: '#1B2350',
  ground: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  cloud: '#12384A',
  rock: '#384052',
  gold: '#F2C14E',
  lanternOn: '#FFB347',
  lanternCore: '#FFE9B0',
  lanternOff: '#5B5F6E',
  moteCore: '#FFF6C2',
  moteGlow: '#FFE58A',
  shade: '#120A1A',
  purple: '#7A3CFF',
  accessibleShade: '#00B3FF',
  stunned: '#3A3450',
  player: '#E8E2D0',
  red: '#C8102E',
  drifter: '#8FA3B8',
};

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
const makeMesh = (parent, geometry, surface, x, y, z) => {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};
const sphere = new THREE.IcosahedronGeometry(1, 1);
const stem = new THREE.CylinderGeometry(0.15, 0.2, 1, 7);

function decorationRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeSky(scene) {
  const random = decorationRandom(832);
  const stars = [];
  for (let index = 0; index < 680; index += 1) {
    const yaw = random() * Math.PI * 2;
    const lift = 0.045 + random() * 1.48;
    stars.push(112 * Math.cos(yaw) * Math.cos(lift), 112 * Math.sin(lift),
      112 * Math.sin(yaw) * Math.cos(lift));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#eddfce', size: 0.26, opacity: 0.8, transparent: true, fog: false,
  })));

  const moon = new THREE.DirectionalLight('#b6c4fa', 1.45);
  moon.position.set(-16, 22, -12);
  scene.add(moon);
  const moonDisc = makeMesh(scene, new THREE.SphereGeometry(4.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#f5d9b4', fog: false }), -22, 8.8, 83);
  moonDisc.material.toneMapped = false;

  const cloud = new THREE.InstancedMesh(sphere, material(palette.cloud), 96);
  const cloudForm = new THREE.Object3D();
  for (let index = 0; index < cloud.count; index += 1) {
    const yaw = random() * Math.PI * 2;
    const radius = 37 + random() * 74;
    cloudForm.position.set(Math.cos(yaw) * radius, -5.7 + random() * 1.6, Math.sin(yaw) * radius);
    cloudForm.scale.set(3 + random() * 9, 0.8 + random() * 2, 3 + random() * 5);
    cloudForm.rotation.y = yaw;
    cloudForm.updateMatrix();
    cloud.setMatrixAt(index, cloudForm.matrix);
  }
  scene.add(cloud);
}

function makeIsland(scene, { x, z, radius }, night, decorativePath) {
  const tile = new THREE.Group();
  tile.position.set(x, 0, z);
  scene.add(tile);
  const random = decorationRandom(2516 + x);
  const rock = material(palette.rock);
  makeMesh(tile, new THREE.CylinderGeometry(radius, radius - 4, 6, 96),
    [rock, material(palette.ground), rock], 0, -3, 0);
  makeMesh(scene, new THREE.CylinderGeometry(radius - 4, 12, 9, 28),
    material('#313447'), x, -10, z);

  const sand = material(palette.sand);
  if (decorativePath) {
    const path = new THREE.Mesh(new THREE.RingGeometry(night === 1 ? 23.9 : radius - 7,
      night === 1 ? 26.2 : radius - 5.7, 64), sand);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.013;
    tile.add(path);
  }
  const clearing = makeMesh(tile, new THREE.CircleGeometry(4.1, 15), sand, 0, 0.02, 0);
  clearing.rotation.x = -Math.PI / 2;

  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.69, 3), material(palette.ground), 360);
  const blade = new THREE.Object3D();
  for (let index = 0; index < grass.count; index += 1) {
    const angle = random() * Math.PI * 2;
    let distance = 5 + Math.sqrt(random()) * (radius - 6);
    if (distance > 23 && distance < 26) distance -= 4;
    blade.position.set(Math.cos(angle) * distance, 0.12, Math.sin(angle) * distance);
    blade.scale.set(0.45 + random() * 0.8, 0.37 + random() * 0.64, 0.6);
    blade.rotation.set((random() - 0.5) * 0.75, angle, (random() - 0.5) * 0.7);
    blade.updateMatrix();
    grass.setMatrixAt(index, blade.matrix);
  }
  tile.add(grass);

  const trunks = new THREE.InstancedMesh(stem, material(palette.wood), 20);
  const leaves = new THREE.InstancedMesh(sphere, material('#587465'), trunks.count * 2);
  const tree = new THREE.Object3D();
  for (let index = 0; index < trunks.count; index += 1) {
    const angle = index * Math.PI * 2 / trunks.count + random() * 0.19;
    const distance = radius - 7 + random() * 5.6;
    const treeX = Math.cos(angle) * distance;
    const treeZ = Math.sin(angle) * distance;
    const height = 2.1 + random() * 2.9;
    tree.position.set(treeX, height / 2, treeZ);
    tree.scale.set(1, height, 1);
    tree.updateMatrix();
    trunks.setMatrixAt(index, tree.matrix);
    for (let branch = 0; branch < 2; branch += 1) {
      tree.position.set(treeX + (branch === 0 ? 0.34 : -0.63), height - branch * 0.65, treeZ + branch * 0.2);
      tree.scale.set(1.35 - branch * 0.4, 1.42 - branch * 0.32, 1.2 - branch * 0.2);
      tree.updateMatrix();
      leaves.setMatrixAt(index * 2 + branch, tree.matrix);
      leaves.setColorAt(index * 2 + branch, new THREE.Color(branch === 0 ? '#abc6b1' : '#909bab'));
    }
  }
  tile.add(trunks, leaves);
}

function solid(points, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function raisedRing(scene) {
  const positions = [];
  const triangles = [];
  for (let i = 0; i <= 48; i += 1) {
    const angle = i * Math.PI / 48;
    for (const [r, y] of [[12, 0], [12, 3], [24, 3], [24, 0]]) {
      positions.push([r * Math.cos(angle), y, r * Math.sin(angle)]);
    }
    if (i === 0) continue;
    for (let edge = 0; edge < 3; edge += 1) {
      const a = (i - 1) * 4 + edge;
      triangles.push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
    }
  }
  triangles.push(0, 2, 1, 0, 3, 2, 192, 193, 194, 192, 194, 195);
  const surface = material(palette.ground);
  surface.side = THREE.DoubleSide;
  makeMesh(scene, solid(positions, triangles), surface, 0, 0, 0);
}

function decorateWorld(scene, game) {
  const { map, night } = game;
  scene.userData.terraceWall = null;
  for (const island of map.islands) makeIsland(scene, island, night, !game.standardBenchmark);
  if (map.bridge) {
    const { minX, maxX, halfWidth } = map.bridge;
    const plank = new THREE.BoxGeometry(0.46, 0.26, halfWidth * 2);
    const planks = new THREE.InstancedMesh(plank, material(palette.wood), 36);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < planks.count; index += 1) {
      planks.setMatrixAt(index, matrix.makeTranslation(minX + (maxX - minX) * (index + 0.5) / planks.count, -0.13, 0));
    }
    scene.add(planks);
  }
  if (map.ramps) {
    raisedRing(scene);
    const wall = material(palette.rock);
    scene.userData.terraceWall = wall;
    makeMesh(scene, new THREE.CylinderGeometry(8, 8, 6, 64),
      [wall, material(palette.ground), wall], 0, 3, 0);
    const timber = material(palette.wood);
    makeMesh(scene, new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, 6.7, 12), timber, 0, 9.35, 0);
    makeMesh(scene, new THREE.ConeGeometry(TOWER_RADIUS, 1.3, 12), material(palette.red), 0, 13.35, 0);
    for (const { cos, sin } of map.ramps) {
      const points = [[24, 3, -1], [24, 3, 1], [30, 0, -1], [30, 0, 1], [24, 0, -1], [24, 0, 1]]
        .map(([along, y, side]) => [along * cos - side * RAMP_WIDTH / 2 * sin, y,
          along * sin + side * RAMP_WIDTH / 2 * cos]);
      const surface = material(palette.sand);
      surface.side = THREE.DoubleSide;
      makeMesh(scene, solid(points, [0, 1, 2, 2, 1, 3, 0, 2, 4, 1, 5, 3]), surface, 0, 0, 0);
    }
  }
  for (const pad of map.pads) {
    const [x, y, z] = pad.pos;
    makeMesh(scene, new THREE.CylinderGeometry(1, 1, 0.12, 24), material(palette.wood), x, y + 0.02, z);
    const mark = makeMesh(scene, new THREE.RingGeometry(0.65, 0.87, 24),
      new THREE.MeshBasicMaterial({ color: palette.gold }), x, y + 0.09, z);
    mark.rotation.x = -Math.PI / 2;
  }
}

function makeGlow() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const index = (x + y * size) * 4;
      pixels.fill(255, index, index + 3);
      pixels[index + 3] = Math.round(Math.max(0, 1 - distance) ** 2 * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function glowSprite(texture, color, size, intensity) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    color, map: texture, transparent: true, opacity: intensity,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

function makePlayer(scene, glow) {
  const body = new THREE.Group();
  scene.add(body);
  const cream = material(palette.player);
  const red = material(palette.red);
  const dark = material('#2a2a45');
  makeMesh(body, new THREE.CylinderGeometry(0.29, 0.5, 0.83, 7), cream, 0, 0.83, 0);
  makeMesh(body, sphere, material('#c58f65'), 0, 1.41, 0).scale.setScalar(0.29);
  makeMesh(body, new THREE.ConeGeometry(0.61, 0.41, 12), material('#d8a965'),
    0, 1.74, 0.02).rotation.z = -0.09;
  makeMesh(body, new THREE.CylinderGeometry(0.325, 0.32, 0.12, 8), red, 0, 1.17, 0);
  makeMesh(body, new THREE.BoxGeometry(0.22, 0.52, 0.04), red, -0.14, 0.98, -0.32)
    .rotation.z = -0.24;
  const shoes = [-0.2, 0.2].map((x) =>
    makeMesh(body, new THREE.BoxGeometry(0.23, 0.28, 0.33), dark, x, 0.16, 0.08));
  const warm = new THREE.MeshBasicMaterial({ color: palette.lanternCore });
  const handle = makeMesh(body, stem, dark, 0.45, 1.43, -0.04);
  handle.scale.set(0.14, 0.44, 0.14);
  makeMesh(body, new THREE.CylinderGeometry(0.105, 0.13, 0.23, 6), warm, 0.45, 1.14, -0.04);
  const light = glowSprite(glow, palette.gold, 1.5, 0.8);
  light.position.set(0.45, 1.14, -0.04);
  body.add(light);
  return { body, shoes };
}

function tornPaperGeometry() {
  const paper = new THREE.Shape();
  const outline = [[-0.266, -0.41], [0.266, -0.41], [0.266, 0.41], [0.10, 0.41],
    [0.035, 0.23], [0.13, 0.27], [-0.045, -0.25], [-0.022, 0.05], [-0.13, -0.02],
    [-0.092, 0.41], [-0.266, 0.41]];
  paper.moveTo(...outline[0]);
  for (const point of outline.slice(1)) paper.lineTo(...point);
  const face = new THREE.ShapeGeometry(paper);
  const geometry = face.toNonIndexed();
  const points = geometry.getAttribute('position');
  const positions = [];
  for (let side = 0; side < 6; side += 1) {
    const angle = (side + 0.5) * Math.PI / 3;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const radius = 0.53 * Math.cos(Math.PI / 6);
    for (let i = 0; i < points.count; i += 1) {
      const x = points.getX(i);
      positions.push(x * cos + radius * sin, points.getY(i), radius * cos - x * sin);
    }
  }
  face.dispose();
  geometry.dispose();
  const torn = new THREE.BufferGeometry();
  torn.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  torn.computeVertexNormals();
  return torn;
}

function makeLantern(scene, glow) {
  const group = new THREE.Group();
  scene.add(group);
  const body = new THREE.Group();
  group.add(body);
  const wood = material(palette.wood);
  makeMesh(body, new THREE.CylinderGeometry(0.8, 1.14, 0.39, 8), material('#777476'), 0, 0.19, 0);
  makeMesh(body, stem, wood, 0, 1.08, 0).scale.set(1.4, 1.83, 1.4);
  makeMesh(body, new THREE.CylinderGeometry(0.64, 0.48, 0.15, 6), wood, 0, 1.98, 0);
  const paper = material(palette.lanternOff);
  paper.side = THREE.DoubleSide;
  const intact = makeMesh(body, new THREE.CylinderGeometry(0.53, 0.53, 0.82, 6), paper, 0, 2.42, 0);
  const torn = makeMesh(body, tornPaperGeometry(), paper, 0, 2.42, 0);
  makeMesh(body, new THREE.ConeGeometry(0.75, 0.56, 6), wood, 0, 3.07, 0);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    makeMesh(body, new THREE.BoxGeometry(0.055, 0.83, 0.055), wood,
      Math.sin(angle) * 0.53, 2.42, Math.cos(angle) * 0.53);
  }
  const halo = glowSprite(glow, palette.lanternCore, 5.1, 1);
  halo.position.y = 2.42;
  group.add(halo);
  const circle = new THREE.Mesh(new THREE.CircleGeometry(tuning.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: palette.lanternOn, transparent: true, opacity: 0.18, depthWrite: false }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.023;
  group.add(circle);
  const gauge = new THREE.Group();
  gauge.position.y = 3.76;
  group.add(gauge);
  const backing = new THREE.MeshBasicMaterial({ color: '#0E1430', transparent: true, opacity: 0.92 });
  makeMesh(gauge, new THREE.PlaneGeometry(1.65, 0.22), backing, 0, 0, 0);
  const fill = new THREE.MeshBasicMaterial({ color: palette.lanternCore, transparent: true, toneMapped: false });
  const gaugeFill = makeMesh(gauge, new THREE.PlaneGeometry(1.5, 0.115), fill, 0, 0, 0.015);
  return { group, body, intact, torn, paper, halo, circle, gauge, gaugeFill };
}

function renderShades(scene, glow) {
  const max = 200;
  const bodies = new THREE.InstancedMesh(sphere, material('#FFFFFF'), max);
  const eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.062, 8, 6),
    new THREE.MeshBasicMaterial({ color: palette.purple, toneMapped: false }), max * 2);
  const haloGeometry = new THREE.BufferGeometry();
  const halos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
  haloGeometry.setAttribute('position', halos);
  const glowMaterial = new THREE.PointsMaterial({ color: palette.purple, size: 3.65, map: glow, opacity: 0.8,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const haloPoints = new THREE.Points(haloGeometry, glowMaterial);
  for (const item of [bodies, eyes, haloPoints]) item.frustumCulled = false;
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bodies, eyes, haloPoints);
  const dark = new THREE.Color(palette.shade);
  const stunned = new THREE.Color(palette.stunned);
  const body = new THREE.Object3D();
  const eye = new THREE.Object3D();
  return {
    draw(shades, seconds, playerX, playerZ) {
      const count = Math.min(max, shades.length);
      bodies.count = count;
      eyes.count = count * 2;
      haloGeometry.setDrawRange(0, count);
      for (let index = 0; index < count; index += 1) {
        const shade = shades[index];
        const [x, baseY, z] = shade.pos;
        const y = baseY + 0.13 * Math.sin(seconds * 3 + index);
        const scale = shade.state === 'spawning' ? 0.7 + 0.15 * Math.sin(seconds * 20) : 1;
        const angle = Math.atan2(playerX - x, playerZ - z);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        body.position.set(x, y, z);
        body.rotation.y = angle;
        body.scale.set(0.57 * scale, 0.93 * scale, 0.53 * scale);
        body.updateMatrix();
        bodies.setMatrixAt(index, body.matrix);
        bodies.setColorAt(index, shade.state === 'stunned' ? stunned : dark);
        for (let side = 0; side < 2; side += 1) {
          const dx = (side * 2 - 1) * 0.16 * scale;
          const dz = 0.49 * scale;
          eye.position.set(x + dx * cos + dz * sin, y + 0.14 * scale, z - dx * sin + dz * cos);
          eye.scale.setScalar(scale);
          eye.updateMatrix();
          eyes.setMatrixAt(index * 2 + side, eye.matrix);
        }
        halos.setXYZ(index, x, y, z);
      }
      if (count > 0) {
        bodies.instanceMatrix.needsUpdate = true;
        bodies.instanceColor.needsUpdate = true;
        eyes.instanceMatrix.needsUpdate = true;
        halos.needsUpdate = true;
      }
    },
    setDistinctColors(enabled) {
      const accent = enabled ? palette.accessibleShade : palette.purple;
      eyes.material.color.set(accent);
      glowMaterial.color.set(accent);
    },
  };
}

export function createView(container, game) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.FogExp2(palette.fog, 0.012);
  const ambient = new THREE.HemisphereLight('#d9e0ff', '#958d80', 0.15);
  scene.add(ambient);
  const camera = new THREE.PerspectiveCamera(51, 1, 0.2, 160);
  makeSky(scene);

  const glow = makeGlow();
  const shadeView = renderShades(scene, glow);
  const player = makePlayer(scene, glow);
  const terrain = new THREE.Group();
  scene.add(terrain);
  let night = 0;
  let lanterns = [];
  const drifters = new Map();
  const charms = new Map();
  const moteGeometry = new THREE.BufferGeometry();
  const motePositions = new THREE.BufferAttribute(new Float32Array(128 * 3), 3);
  motePositions.setUsage(THREE.DynamicDrawUsage);
  moteGeometry.setAttribute('position', motePositions);
  for (const [color, size, opacity] of [[palette.moteGlow, 1.45, 0.86], [palette.moteCore, 0.36, 1]]) {
    const points = new THREE.Points(moteGeometry, new THREE.PointsMaterial({
      color, size, map: glow, opacity, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    points.frustumCulled = false;
    scene.add(points);
  }
  const drifterBody = new THREE.PlaneGeometry(1.32, 0.74, 6, 2);
  const drifterMaterial = new THREE.MeshBasicMaterial({ color: palette.drifter, side: THREE.DoubleSide,
    transparent: true, opacity: 0.9 });
  const charmShape = new THREE.PlaneGeometry(0.69, 0.94);
  const charmMaterial = new THREE.MeshBasicMaterial({ color: palette.red, side: THREE.DoubleSide, toneMapped: false });
  const trimMaterial = new THREE.MeshBasicMaterial({ color: palette.gold, side: THREE.DoubleSide, toneMapped: false });
  const windGeometry = new THREE.BufferGeometry();
  const windPositions = new THREE.BufferAttribute(new Float32Array(24 * 3), 3);
  windGeometry.setAttribute('position', windPositions);
  const leaves = new THREE.Points(windGeometry, new THREE.PointsMaterial({ color: '#d4c493', size: 0.14 }));
  leaves.frustumCulled = false;
  scene.add(leaves);
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.89, 1, 48), new THREE.MeshBasicMaterial({
    color: '#ffe1a0', side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  wave.rotation.x = -Math.PI / 2;
  wave.visible = false;
  scene.add(wave);
  let waveAge = Infinity;
  let reducedMotion = false;
  const hintPoint = new THREE.Vector3();
  const localPoint = new THREE.Vector3();

  function fit() {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }
  window.addEventListener('resize', fit);
  fit();

  function load(gameState) {
    if (gameState.night === night) return;
    const resources = new Set();
    terrain.traverse((object) => {
      if (object.geometry && object.geometry !== sphere && object.geometry !== stem) resources.add(object.geometry);
      for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
        if (surface) resources.add(surface);
      }
      if (object.isInstancedMesh) object.dispose();
    });
    for (const resource of resources) resource.dispose();
    terrain.clear();
    decorateWorld(terrain, gameState);
    lanterns = gameState.lanterns.map(() => makeLantern(terrain, glow));
    night = gameState.night;
    renderer.domElement.setAttribute('aria-label', `Cảnh 3D ${gameState.map.name}`);
  }
  load(game);

  function draw(gameState, yaw, seconds, delta, orbit) {
    load(gameState);
    const { pos, yaw: facing, invulnerableUntil } = gameState.player;
    const [x, y, z] = pos;
    const terraceWall = terrain.userData.terraceWall;
    if (terraceWall) {
      const belowTerrace = y < 5.4 && x * x + z * z < 64;
      terraceWall.transparent = belowTerrace;
      terraceWall.opacity = belowTerrace ? 0.14 : 1;
      terraceWall.depthWrite = !belowTerrace;
    }
    const blink = !reducedMotion && gameState.simTick < invulnerableUntil && Math.floor(gameState.simTick / 5) % 2 === 0;
    player.body.position.set(x, y, z);
    player.body.rotation.y = facing;
    player.body.visible = !blink && gameState.player.respawnAt === null;
    const walking = gameState.player.grounded && Math.hypot(gameState.player.vel[0], gameState.player.vel[2]) > 0.01;
    player.shoes.forEach((shoe, index) => { shoe.rotation.x = walking ? Math.sin(seconds * 13 + index * Math.PI) * 0.55 : 0; });
    if (orbit) {
      camera.position.fromArray(orbit);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(x - Math.sin(yaw) * 8.8, Math.max(-3.5, y) + 4.7, z - Math.cos(yaw) * 8.8);
      camera.lookAt(x + Math.sin(yaw) * 2.1, Math.max(-4, y) + 1.03, z + Math.cos(yaw) * 2.1);
    }

    ambient.intensity = 0.15 + 0.55 * gameState.lanterns.filter(({ lit }) => lit).length / gameState.lanterns.length;
    gameState.lanterns.forEach((lantern, index) => {
      const { pos: location, lit, fuelUnits } = lantern;
      const model = lanterns[index];
      model.group.position.fromArray(location);
      model.body.scale.y = lit ? 1 : 0.8;
      model.intact.visible = lit;
      model.torn.visible = !lit;
      const dim = isWeakLight(lantern) && gameState.simTick % TICKS_PER_SECOND >= TICKS_PER_SECOND / 2;
      model.paper.color.set(lit ? palette.lanternOn : palette.lanternOff);
      model.paper.emissive.set(lit ? palette.lanternOn : palette.lanternOff);
      model.paper.emissiveIntensity = lit && !dim ? 0.72 : 0.12;
      model.halo.visible = lit;
      model.halo.material.opacity = dim ? 0.24 : 1;
      model.circle.visible = hasSafeLight(lantern);
      model.gauge.visible = lit;
      if (lit) {
        const fraction = fuelUnits / MAX_FUEL_UNITS;
        model.gauge.lookAt(camera.position);
        model.gaugeFill.scale.x = fraction;
        model.gaugeFill.position.x = -0.75 * (1 - fraction);
        model.gaugeFill.material.opacity = dim ? 0.3 : 1;
      }
    });

    const visibleMotes = Math.min(gameState.motes.length, motePositions.count);
    for (let index = 0; index < visibleMotes; index += 1) {
      const [mx, my, mz] = gameState.motes[index].pos;
      motePositions.setXYZ(index, mx, my + 0.76 + Math.sin(seconds * 3 + index * 1.57) * 0.21, mz);
    }
    moteGeometry.setDrawRange(0, visibleMotes);
    motePositions.needsUpdate = true;

    shadeView.draw(gameState.shades, seconds, x, z);

    syncModels(drifters, gameState.drifters, () => {
      const ribbon = new THREE.Mesh(drifterBody.clone(), drifterMaterial);
      ribbon.userData.ownsGeometry = true;
      scene.add(ribbon);
      return ribbon;
    }, (ribbon, drifter, index) => {
      ribbon.position.fromArray(drifter.pos);
      ribbon.position.y += 0.42 + Math.sin(seconds * 4 + index) * 0.28;
      ribbon.rotation.set(Math.sin(seconds * 6 + index) * 0.47, yaw + seconds * 0.85, Math.sin(seconds * 3) * 0.22);
      const points = ribbon.geometry.attributes.position;
      for (let i = 0; i < points.count; i += 1) points.setZ(i, Math.sin(points.getX(i) * 5 - seconds * 10) * 0.16);
      points.needsUpdate = true;
    });

    syncModels(charms, gameState.charms, () => {
      const card = new THREE.Group();
      makeMesh(card, charmShape, trimMaterial, 0, 0, 0);
      const red = makeMesh(card, charmShape, charmMaterial, 0, 0, 0.02);
      red.scale.set(0.77, 0.84, 1);
      makeMesh(card, charmShape, charmMaterial, 0, 0, -0.02).scale.copy(red.scale);
      scene.add(card);
      return card;
    }, (card, charm) => {
      card.position.fromArray(charm.pos);
      card.position.y += 0.85 + 0.13 * Math.sin(seconds * 4);
      card.rotation.y = seconds * 1.7;
      card.visible = charm.available;
    });

    leaves.visible = gameState.wind.active || gameState.wind.warning;
    if (leaves.visible) {
      const angle = gameState.wind.dirDeg * Math.PI / 180;
      for (let index = 0; index < windPositions.count; index += 1) {
        const d = (seconds * 7 + index * 1.71) % 24 - 12;
        const cross = Math.sin(index * 12.13) * 13;
        windPositions.setXYZ(index, x + d * Math.cos(angle) - cross * Math.sin(angle),
          Math.max(0, y) + 1 + (index % 6) * 0.45 + Math.sin(seconds * 5 + index) * 0.21,
          z + d * Math.sin(angle) + cross * Math.cos(angle));
      }
      windPositions.needsUpdate = true;
    }

    waveAge += delta;
    wave.visible = waveAge < 0.48 && !reducedMotion;
    if (wave.visible) {
      wave.scale.setScalar(0.4 + waveAge / 0.48 * (tuning.pulse_radius - 0.4));
      wave.material.opacity = 0.83 * (1 - waveAge / 0.48);
    }
    renderer.render(scene, camera);
  }

  function syncModels(models, objects, make, update) {
    const present = new Set();
    objects.forEach((object, index) => {
      present.add(object.id);
      if (!models.has(object.id)) models.set(object.id, make(object, index));
      update(models.get(object.id), object, index);
    });
    for (const [id, model] of models) {
      if (present.has(id)) continue;
      model.traverse((child) => {
        if (child.isSprite) child.material.dispose();
        if (child.userData.ownsGeometry) child.geometry.dispose();
      });
      scene.remove(model);
      models.delete(id);
    }
  }

  return {
    draw,
    setDistinctColors: shadeView.setDistinctColors,
    setReducedMotion(enabled) {
      reducedMotion = enabled;
    },
    rendererName() {
      const context = renderer.getContext();
      const extension = context.getExtension('WEBGL_debug_renderer_info');
      const device = extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER);
      return `Three.js r${THREE.REVISION} · WebGL 2 · ${device}`;
    },
    hint(target, forceEdge = false, lift = 2.4) {
      if (!target) return null;
      hintPoint.fromArray(target.pos);
      hintPoint.y += lift;
      localPoint.copy(hintPoint).applyMatrix4(camera.matrixWorldInverse);
      hintPoint.project(camera);
      if (!forceEdge && localPoint.z < 0 && Math.abs(hintPoint.x) < 0.92 && Math.abs(hintPoint.y) < 0.86) return null;
      const dx = localPoint.z < 0 ? hintPoint.x : localPoint.x;
      let dy = localPoint.z < 0 ? hintPoint.y : -Math.abs(localPoint.y) - 2;
      if (forceEdge && Math.max(Math.abs(dx), Math.abs(dy)) < 0.02) dy = 1;
      const scale = 1 / Math.max(0.01, Math.abs(dx), Math.abs(dy));
      return { x: 50 + dx * scale * 42, y: 49 - dy * scale * 33,
        angle: Math.atan2(dx, dy) * 180 / Math.PI };
    },
    pulse(pos) {
      waveAge = 0;
      wave.position.set(pos[0], pos[1] + 0.22, pos[2]);
    },
    reset() {
      waveAge = Infinity;
    },
  };
}
