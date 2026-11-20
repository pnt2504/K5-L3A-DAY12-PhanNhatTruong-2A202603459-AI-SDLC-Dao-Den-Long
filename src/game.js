import contract from '../game.contract.json' with { type: 'json' };

export const tuning = Object.freeze(contract.tuning);
export const TICKS_PER_SECOND = 60;
export const ISLAND_RADIUS = 36;
export const DEFAULT_INPUT = Object.freeze({
  move: Object.freeze([0, 0]),
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
});

const STEP = 1 / TICKS_PER_SECOND;
const EPSILON = 1e-9;
const START = [0, 0, 0];
const INITIAL_MOTES = 32;
const MAX_MOTES = 40;
const MAX_SHADES = 5;
const MOTE_INTERVAL = 3 * TICKS_PER_SECOND;
const SHADE_START = 12 * TICKS_PER_SECOND;
const SHADE_INTERVAL = 14 * TICKS_PER_SECOND;
const FALL_DEPTH = -10;
const JUMP_SPEED = 7;
const GRAVITY = 20;

function polar(radius, angle, y = 0) {
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
}

function horizontalDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let bits = Math.imul(value ^ (value >>> 15), value | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(seed, scenario = {}) {
  const game = {
    tick: 0,
    state: 'playing',
    reason: null,
    score: 0,
    duration: scenario.time_left_s ?? tuning.night1_duration_s,
    timeLeft: scenario.time_left_s ?? tuning.night1_duration_s,
    player: {
      pos: [...(scenario.player?.pos ?? START)],
      yaw: 0,
      verticalSpeed: 0,
      flames: scenario.player?.flames ?? tuning.flames,
      carried: scenario.player?.carried ?? 0,
      invulnerableUntil: 0,
      pulseReadyAt: 0,
    },
    previousInput: DEFAULT_INPUT,
    lanterns: Array.from({ length: tuning.lantern_count_night1 }, (_, index) => {
      const id = `L${index + 1}`;
      const change = scenario.lanterns?.find((lantern) => lantern.id === id);
      const deposited = change?.deposited ?? (change?.lit ? tuning.lantern_cost : 0);
      return {
        id,
        pos: [...(change?.pos ?? polar(22, Math.PI / 2 + index * Math.PI * 2 / 5))],
        deposited,
        lit: change?.lit ?? deposited >= tuning.lantern_cost,
      };
    }),
    motes: [],
    shades: [],
    nextMoteId: 1,
    nextShadeId: 1,
    shadeIds: new Set(scenario.shades?.flatMap(({ id }) => id === undefined ? [] : [id])),
    random: makeRandom(seed),
    randomMotes: scenario.random_motes ?? true,
    randomShades: scenario.random_shades ?? true,
  };

  if (scenario.motes !== undefined) {
    for (const pos of scenario.motes) addMote(game, pos);
  } else if (game.randomMotes) {
    for (let index = 0; index < INITIAL_MOTES; index += 1) {
      // Spread the opening supply around the island with seeded variation.
      const spoke = index % 8;
      const ring = Math.floor(index / 8);
      const radius = 5 + ring * 8 + (game.random() - 0.5) * 3.5;
      const angle = (spoke + ring / 4 + (game.random() - 0.5) * 0.54) * Math.PI / 4;
      addMote(game, polar(radius, angle));
    }
  }
  for (const { id, pos } of scenario.shades ?? []) addShade(game, pos, id);
  return game;
}

function addMote(game, pos) {
  game.motes.push({ id: `M${game.nextMoteId++}`, pos: [...pos] });
}

function addShade(game, pos, explicitId) {
  let id = explicitId;
  if (id === undefined) {
    do {
      id = `S${game.nextShadeId++}`;
    } while (game.shadeIds.has(id));
  }
  game.shadeIds.add(id);
  game.shades.push({ id, pos: [...pos], state: 'chase', stunnedUntil: 0 });
  return id;
}

function movePlayer(player, input, jump) {
  const [x, z] = input.move;
  const length = Math.max(1, Math.hypot(x, z));
  const yaw = (input.cam_yaw_deg % 360) * Math.PI / 180;
  const dx = (x * Math.cos(yaw) + z * Math.sin(yaw)) / length;
  const dz = (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length;
  const grounded = horizontalDistance(player.pos, START) <= ISLAND_RADIUS + EPSILON
    && player.pos[1] === 0 && player.verticalSpeed === 0;

  if (dx !== 0 || dz !== 0) player.yaw = Math.atan2(dx, dz);
  if (jump && grounded) player.verticalSpeed = JUMP_SPEED;
  player.pos[0] += dx * tuning.player_speed * STEP;
  player.pos[2] += dz * tuning.player_speed * STEP;

  const overIsland = horizontalDistance(player.pos, START) <= ISLAND_RADIUS + EPSILON;
  if (grounded && overIsland && player.verticalSpeed === 0) return;

  const priorHeight = player.pos[1];
  player.verticalSpeed -= GRAVITY * STEP;
  player.pos[1] += player.verticalSpeed * STEP;
  if (overIsland && priorHeight >= 0 && player.pos[1] <= 0) {
    player.pos[1] = 0;
    player.verticalSpeed = 0;
  }
}

function pickUpMotes(game, emit) {
  game.motes = game.motes.filter((mote) => {
    if (game.player.carried >= tuning.carry_capacity
      || horizontalDistance(game.player.pos, mote.pos) > tuning.pickup_radius + EPSILON) return true;
    game.player.carried += 1;
    game.score += tuning.score.per_mote;
    emit('mote_picked', { carried: game.player.carried });
    return false;
  });
}

export function nearbyLantern(game) {
  let target;
  let nearest = Infinity;
  for (const lantern of game.lanterns) {
    const distance = horizontalDistance(game.player.pos, lantern.pos);
    if (!lantern.lit && distance <= tuning.interact_radius + EPSILON && distance < nearest) {
      target = lantern;
      nearest = distance;
    }
  }
  return target;
}

function deposit(game, emit) {
  if (game.player.carried === 0) return;
  const target = nearbyLantern(game);
  if (!target) return;
  const amount = Math.min(game.player.carried, Math.max(0, tuning.lantern_cost - target.deposited));
  if (amount === 0) return;
  game.player.carried -= amount;
  target.deposited += amount;
  emit('deposit', { lantern_id: target.id, amount, deposited: target.deposited });
  if (target.deposited === tuning.lantern_cost) {
    target.lit = true;
    game.score += tuning.score.per_lantern;
    emit('lantern_lit', { lantern_id: target.id });
  }
}

function safeAt(game, pos) {
  return game.lanterns.some((lantern) =>
    lantern.lit && horizontalDistance(lantern.pos, pos) < tuning.safe_radius - EPSILON);
}

function moveShade(game, shade, dx, dz) {
  const [x, , z] = shade.pos;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return;
  let travel = 1;
  for (const lantern of game.lanterns) {
    if (!lantern.lit) continue;
    const relativeX = x - lantern.pos[0];
    const relativeZ = z - lantern.pos[2];
    const projection = relativeX * dx + relativeZ * dz;
    const offset = relativeX ** 2 + relativeZ ** 2 - tuning.safe_radius ** 2;
    const discriminant = projection ** 2 - lengthSquared * Math.max(0, offset);
    if (projection < 0 && discriminant > 0 && offset >= -EPSILON) {
      const entry = (-projection - Math.sqrt(discriminant)) / lengthSquared;
      travel = Math.min(travel, Math.max(0, entry));
    }
  }
  shade.pos[0] += dx * travel;
  shade.pos[2] += dz * travel;
}

function protectLanterns(game) {
  for (const shade of game.shades) {
    if (!safeAt(game, shade.pos)) continue;
    const [x, y, z] = shade.pos;
    // Several overridden lantern circles may overlap. Search outward for the nearest clear point.
    let nearestDistance = Infinity;
    let nearest;
    for (const lantern of game.lanterns) {
      if (!lantern.lit) continue;
      const outward = Math.atan2(z - lantern.pos[2], x - lantern.pos[0]);
      for (let angleIndex = 0; angleIndex < 32; angleIndex += 1) {
        const angle = outward + angleIndex * Math.PI / 16;
        const [dx, , dz] = polar(tuning.safe_radius + 1e-7, angle);
        const pos = [lantern.pos[0] + dx, y, lantern.pos[2] + dz];
        const distance = horizontalDistance(shade.pos, pos);
        if (distance < nearestDistance && !safeAt(game, pos)) {
          nearestDistance = distance;
          nearest = pos;
        }
      }
    }
    if (nearest) shade.pos = nearest;
  }
}

function pulse(game, emit) {
  const { player } = game;
  if (player.carried < tuning.pulse_cost || game.tick < player.pulseReadyAt) return;
  player.carried -= tuning.pulse_cost;
  player.pulseReadyAt = game.tick + tuning.pulse_cooldown_s * TICKS_PER_SECOND;
  const stunnedIds = [];
  for (const shade of game.shades) {
    const distance = horizontalDistance(player.pos, shade.pos);
    if (distance > tuning.pulse_radius + EPSILON) continue;
    shade.state = 'stunned';
    shade.stunnedUntil = game.tick + tuning.pulse_stun_s * TICKS_PER_SECOND;
    const dx = distance === 0 ? 1 : (shade.pos[0] - player.pos[0]) / distance;
    const dz = distance === 0 ? 0 : (shade.pos[2] - player.pos[2]) / distance;
    moveShade(game, shade, dx * tuning.pulse_push_m, dz * tuning.pulse_push_m);
    stunnedIds.push(shade.id);
  }
  game.score += stunnedIds.length * tuning.score.per_stun;
  emit('pulse', { stunned_ids: stunnedIds });
}

function hit(game, by, emit) {
  const { player } = game;
  const dropped = by === 'fall'
    ? player.carried : Math.floor(player.carried * tuning.hit_drop_ratio);
  player.flames = Math.max(0, player.flames - 1);
  player.carried -= dropped;
  player.invulnerableUntil = game.tick + tuning.invuln_s * TICKS_PER_SECOND;
  if (by === 'fall') {
    player.pos = [...START];
    player.verticalSpeed = 0;
  } else {
    for (let index = 0; index < dropped; index += 1) {
      const [dx, , dz] = polar(1.7, game.random() * Math.PI * 2);
      const pos = [player.pos[0] + dx, 0, player.pos[2] + dz];
      const radius = horizontalDistance(START, pos);
      if (radius > ISLAND_RADIUS) {
        pos[0] *= (ISLAND_RADIUS - 0.1) / radius;
        pos[2] *= (ISLAND_RADIUS - 0.1) / radius;
      }
      addMote(game, pos);
    }
  }
  emit('player_hit', { by, flames: player.flames, dropped });
}

function updateShades(game, emit) {
  const { player } = game;
  for (const shade of game.shades) {
    if (game.tick < shade.stunnedUntil) continue;
    shade.state = 'chase';
    const distance = horizontalDistance(player.pos, shade.pos);
    if (distance > 0) {
      const fraction = Math.min(1, tuning.shade_speed * STEP / distance);
      moveShade(game, shade, (player.pos[0] - shade.pos[0]) * fraction,
        (player.pos[2] - shade.pos[2]) * fraction);
    }
    if (player.flames > 0 && game.tick >= player.invulnerableUntil
      && !safeAt(game, player.pos)
      && horizontalDistance(player.pos, shade.pos) <= tuning.shade_hit_radius + EPSILON) {
      hit(game, 'shade', emit);
    }
  }
}

function spawn(game, emit) {
  if (game.randomMotes && game.tick % MOTE_INTERVAL === 0 && game.motes.length < MAX_MOTES) {
    addMote(game, polar(4 + 29 * Math.sqrt(game.random()), game.random() * Math.PI * 2));
  }
  if (!game.randomShades || game.tick < SHADE_START || game.shades.length >= MAX_SHADES
    || (game.tick - SHADE_START) % SHADE_INTERVAL !== 0) return;
  const angle = game.random() * Math.PI * 2;
  for (let index = 0; index < 12; index += 1) {
    const pos = polar(ISLAND_RADIUS - 2, angle + index * Math.PI / 6, 0.8);
    if (!safeAt(game, pos) && horizontalDistance(game.player.pos, pos) >= 9) {
      emit('shade_spawned', { id: addShade(game, pos) });
      return;
    }
  }
}

export function stepGame(game, input = DEFAULT_INPUT) {
  if (game.state !== 'playing') return [];
  game.tick += 1;
  game.timeLeft = Math.max(0, game.duration - game.tick / TICKS_PER_SECOND);
  const events = [];
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data });
  const pressed = (key) => input[key] && !game.previousInput[key];
  if (game.player.flames > 0) {
    movePlayer(game.player, input, pressed('jump'));
    const fell = tuning.fall_enabled && game.player.pos[1] < FALL_DEPTH;
    if (fell) hit(game, 'fall', emit);
    if (!fell) {
      pickUpMotes(game, emit);
      if (pressed('interact')) deposit(game, emit);
      protectLanterns(game);
      if (pressed('pulse')) pulse(game, emit);
      updateShades(game, emit);
      spawn(game, emit);
    }
  }
  game.previousInput = { ...input };

  if (game.player.flames === 0) {
    game.state = 'lost';
    game.reason = 'no_flames';
  } else if (game.lanterns.every(({ lit }) => lit)) {
    game.state = 'won';
    game.reason = 'all_lit';
    game.score += Math.floor(game.timeLeft + EPSILON) * tuning.score.per_second_left;
    game.score += game.player.flames * tuning.score.per_flame_left;
  } else if (game.timeLeft <= 0) {
    game.state = 'lost';
    game.reason = 'dawn';
  }
  if (game.reason) emit('game_over', { result: game.state, reason: game.reason });
  return events;
}

function roundedPosition(pos) {
  return pos.map((value) => Number(value.toFixed(3)) || 0);
}

export function snapshot(game) {
  const { player } = game;
  return {
    type: 'snapshot',
    tick: game.tick,
    sim_tick: game.tick,
    state: game.state,
    time_left_s: game.timeLeft,
    score: game.score,
    player: { pos: roundedPosition(player.pos), flames: player.flames, carried: player.carried },
    lanterns: game.lanterns.map(({ id, pos, lit, deposited }) =>
      ({ id, pos: roundedPosition(pos), lit, deposited })),
    shades: game.shades.map(({ id, pos, state }) => ({ id, pos: roundedPosition(pos), state })),
    motes_active: game.motes.length,
    motes: game.motes.map(({ id, pos }) => ({ id, pos: roundedPosition(pos) })),
  };
}
