import * as THREE from 'three';
import { ISLAND_RADIUS, tuning } from './game.js';

const palette = {
  fog: '#30375b',
  ground: '#354b43',
  rock: '#384052',
  gold: '#ffd389',
  purple: '#a785eb',
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

  const cloud = new THREE.InstancedMesh(sphere, material('#747a9c'), 128);
  const cloudForm = new THREE.Object3D();
  for (let index = 0; index < 128; index += 1) {
    const yaw = random() * Math.PI * 2;
    const radius = 37 + random() * 74;
    cloudForm.position.set(Math.cos(yaw) * radius, -5.7 + random() * 1.6, Math.sin(yaw) * radius);
    cloudForm.scale.set(3 + random() * 9, 0.8 + random() * 2, 3 + random() * 5);
    cloudForm.rotation.y = yaw;
    cloudForm.updateMatrix();
    cloud.setMatrixAt(index, cloudForm.matrix);
    cloud.setColorAt(index, new THREE.Color().setHSL(0.61, 0.19, 0.38 + random() * 0.17));
  }
  scene.add(cloud);
}

function makeIsland(scene) {
  const random = decorationRandom(2516);
  const radius = ISLAND_RADIUS;
  makeMesh(scene, new THREE.CylinderGeometry(radius, radius - 4, 6, 64),
    [material(palette.rock), material(palette.ground), material(palette.rock)], 0, -3, 0);
  makeMesh(scene, new THREE.CylinderGeometry(radius - 4, 12, 9, 28),
    material('#313447'), 0, -10, 0);

  const path = new THREE.Mesh(new THREE.RingGeometry(20.3, 23.3, 64),
    material('#695e52'));
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.013;
  scene.add(path);
  const clearing = makeMesh(scene, new THREE.CircleGeometry(4.1, 15),
    material('#716658'), 0, 0.02, 0);
  clearing.rotation.x = -Math.PI / 2;

  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.69, 3), material('#809777'), 760);
  const blade = new THREE.Object3D();
  for (let index = 0; index < grass.count; index += 1) {
    const angle = random() * Math.PI * 2;
    let distance = 5 + Math.sqrt(random()) * 30.2;
    if (distance > 20 && distance < 24) distance -= 4;
    blade.position.set(Math.cos(angle) * distance, 0.12, Math.sin(angle) * distance);
    blade.scale.set(0.45 + random() * 0.8, 0.37 + random() * 0.64, 0.6);
    blade.rotation.set((random() - 0.5) * 0.75, angle, (random() - 0.5) * 0.7);
    blade.updateMatrix();
    grass.setMatrixAt(index, blade.matrix);
    grass.setColorAt(index, new THREE.Color().setHSL(0.29 + random() * 0.12, 0.23, 0.36 + random() * 0.28));
  }
  scene.add(grass);

  const bark = material('#675649');
  const leaves = [material('#587465'), material('#546974'), material('#88816d')];
  for (let index = 0; index < 28; index += 1) {
    const angle = index * Math.PI * 2 / 28 + random() * 0.19;
    const distance = 28 + random() * 6.8;
    const group = new THREE.Group();
    group.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    const height = 2.1 + random() * 2.9;
    makeMesh(group, stem, bark, 0, height / 2, 0).scale.y = height;
    makeMesh(group, sphere, leaves[index % leaves.length], 0.34, height, 0).scale.set(1.35, 1.42, 1.2);
    makeMesh(group, sphere, leaves[index % leaves.length], -0.63, height - 0.65, 0.2).scale.set(0.94, 1.1, 1);
    scene.add(group);
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
  const cream = material('#efe2bf');
  const red = material('#bd5060');
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
  const warm = new THREE.MeshBasicMaterial({ color: '#ffd981' });
  const handle = makeMesh(body, stem, dark, 0.45, 1.43, -0.04);
  handle.scale.set(0.14, 0.44, 0.14);
  makeMesh(body, new THREE.CylinderGeometry(0.105, 0.13, 0.23, 6), warm, 0.45, 1.14, -0.04);
  const light = glowSprite(glow, palette.gold, 1.5, 0.8);
  light.position.set(0.45, 1.14, -0.04);
  body.add(light);
  return { body, shoes };
}

function makeLantern(scene, glow) {
  const group = new THREE.Group();
  scene.add(group);
  const wood = material('#99775b');
  makeMesh(group, new THREE.CylinderGeometry(0.8, 1.14, 0.39, 8), material('#777476'), 0, 0.19, 0);
  makeMesh(group, stem, wood, 0, 1.08, 0).scale.set(1.4, 1.83, 1.4);
  makeMesh(group, new THREE.CylinderGeometry(0.64, 0.48, 0.15, 6), wood, 0, 1.98, 0);
  const paper = material('#8f7394');
  makeMesh(group, new THREE.CylinderGeometry(0.53, 0.53, 0.82, 6), paper, 0, 2.42, 0);
  makeMesh(group, new THREE.ConeGeometry(0.75, 0.56, 6), wood, 0, 3.07, 0);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    makeMesh(group, new THREE.BoxGeometry(0.055, 0.83, 0.055), wood,
      Math.sin(angle) * 0.53, 2.42, Math.cos(angle) * 0.53);
  }
  const halo = glowSprite(glow, palette.gold, 5.1, 0.9);
  halo.position.y = 2.42;
  group.add(halo);
  const flame = new THREE.PointLight('#ffc47b', 52, 14, 2);
  flame.position.y = 2.4;
  group.add(flame);
  const circle = new THREE.Mesh(new THREE.CircleGeometry(tuning.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: '#f0a74a', transparent: true, opacity: 0.12, depthWrite: false }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.023;
  group.add(circle);
  return { group, paper, halo, flame, circle };
}

export function createView(container, game) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
  renderer.domElement.setAttribute('aria-label', 'Cảnh 3D Đảo Bến');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#242b4a');
  scene.fog = new THREE.FogExp2(palette.fog, 0.018);
  const ambient = new THREE.HemisphereLight('#adbfff', '#675746', 1.6);
  scene.add(ambient);
  const camera = new THREE.PerspectiveCamera(51, 1, 0.2, 160);
  makeSky(scene);
  makeIsland(scene);

  const glow = makeGlow();
  const player = makePlayer(scene, glow);
  const lanterns = game.lanterns.map(() => makeLantern(scene, glow));
  const motes = new Map();
  const shades = new Map();
  const moteCore = new THREE.MeshBasicMaterial({ color: '#fff2ad', toneMapped: false });
  const shadeCore = material('#25213c');
  const shadeStunned = material('#7a6997');
  const shadeEye = new THREE.SphereGeometry(0.062, 8, 6);
  const shadeEyes = new THREE.MeshBasicMaterial({ color: '#c5a7ff' });
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.89, 1, 48), new THREE.MeshBasicMaterial({
    color: '#ffe1a0', side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  wave.rotation.x = -Math.PI / 2;
  wave.visible = false;
  scene.add(wave);
  let waveAge = Infinity;

  function fit() {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }
  window.addEventListener('resize', fit);
  fit();

  function draw(gameState, yaw, seconds, delta) {
    const { pos, yaw: facing, invulnerableUntil } = gameState.player;
    const [x, y, z] = pos;
    const blink = gameState.tick < invulnerableUntil && Math.floor(gameState.tick / 5) % 2 === 0;
    player.body.position.set(x, y, z);
    player.body.rotation.y = facing;
    player.body.visible = !blink;
    const walking = gameState.previousInput.move.some((value) => value !== 0);
    player.shoes.forEach((shoe, index) => { shoe.rotation.x = walking ? Math.sin(seconds * 13 + index * Math.PI) * 0.55 : 0; });
    camera.position.set(x - Math.sin(yaw) * 8.8, Math.max(-3.5, y) + 4.7, z - Math.cos(yaw) * 8.8);
    camera.lookAt(x + Math.sin(yaw) * 2.1, Math.max(-4, y) + 1.03, z + Math.cos(yaw) * 2.1);

    ambient.intensity = 1.58 + gameState.lanterns.filter(({ lit }) => lit).length * 0.23;
    gameState.lanterns.forEach(({ pos: location, lit }, index) => {
      const model = lanterns[index];
      model.group.position.fromArray(location);
      model.paper.color.set(lit ? '#ffc572' : '#856c90');
      model.paper.emissive.set(lit ? '#ff9a39' : '#49405a');
      model.paper.emissiveIntensity = lit ? 0.85 : 0.25;
      model.halo.visible = lit;
      model.flame.visible = lit;
      model.circle.visible = lit;
    });

    syncModels(motes, gameState.motes, () => {
      const group = new THREE.Group();
      const core = new THREE.Mesh(sphere, moteCore);
      core.scale.setScalar(0.15);
      group.add(core, glowSprite(glow, palette.gold, 1.65, 1));
      scene.add(group);
      return group;
    }, (model, mote, index) => {
      model.position.fromArray(mote.pos);
      model.position.y += 0.76 + Math.sin(seconds * 3 + index * 1.57) * 0.21;
      model.scale.setScalar(0.86 + Math.sin(seconds * 5 + index * 2.4) * 0.12);
    });

    syncModels(shades, gameState.shades, () => {
      const group = new THREE.Group();
      const halo = glowSprite(glow, palette.purple, 3.65, 0.8);
      group.add(halo);
      const core = makeMesh(group, sphere, shadeCore, 0, 0, 0);
      core.scale.set(0.57, 0.93, 0.53);
      for (const side of [-1, 1]) {
        makeMesh(group, shadeEye, shadeEyes, side * 0.16, 0.14, 0.49);
      }
      scene.add(group);
      return group;
    }, (model, shade, index) => {
      model.position.fromArray(shade.pos);
      model.position.y += Math.sin(seconds * 3 + index) * 0.13;
      model.rotation.y = Math.atan2(x - shade.pos[0], z - shade.pos[2]);
      model.children[1].material = shade.state === 'stunned' ? shadeStunned : shadeCore;
    });

    waveAge += delta;
    wave.visible = waveAge < 0.48;
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
      });
      scene.remove(model);
      models.delete(id);
    }
  }

  return {
    draw,
    pulse(pos) {
      waveAge = 0;
      wave.position.set(pos[0], pos[1] + 0.22, pos[2]);
    },
    reset() {
      waveAge = Infinity;
    },
  };
}
