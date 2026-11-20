import { createGame, nearbyLantern, stepGame, TICKS_PER_SECOND, tuning } from './game.js';
import { createView } from './scene.js';

const find = (id) => document.getElementById(id);
const elements = Object.fromEntries([
  'game', 'view', 'hud', 'flames', 'time', 'lanterns', 'score', 'feedback', 'reticle', 'controls',
  'action', 'carry', 'slots', 'pulse-status', 'overlay', 'chapter', 'title', 'description', 'start',
].map((id) => [id, find(id)]));

const actions = new Map([['Space', 'jump'], ['KeyE', 'interact'], ['KeyQ', 'pulse']]);
const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const keys = new Set();
const pendingActions = new Set();
const slots = Array.from({ length: tuning.carry_capacity }, () =>
  elements.slots.appendChild(document.createElement('span')));
const inputSeed = new URLSearchParams(location.search).get('seed');
const seed = inputSeed !== null && /^-?\d+$/.test(inputSeed) && Number.isSafeInteger(Number(inputSeed))
  ? Number(inputSeed) : crypto.getRandomValues(new Uint32Array(1))[0];
let game = createGame(seed);
let cameraYaw = 0;
let started = false;
let previousTime = 0;
let accumulator = 0;
let dragX;
let feedbackUntil = 0;
let lastFlames = -1;
const tickLength = 1 / TICKS_PER_SECOND;

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function drawHud() {
  const { player, lanterns } = game;
  if (lastFlames !== player.flames) {
    elements.flames.replaceChildren();
    for (let index = 0; index < tuning.flames; index += 1) {
      const symbol = document.createElement('i');
      symbol.textContent = index < player.flames ? '◆' : '◇';
      if (index < player.flames) symbol.style.color = 'inherit';
      elements.flames.append(symbol);
    }
    elements.flames.setAttribute('aria-label', `${player.flames} / ${tuning.flames} Ngọn Lửa`);
    lastFlames = player.flames;
  }
  const seconds = Math.ceil(game.timeLeft);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  setText(elements.time, time);
  elements.time.classList.toggle('urgent', seconds <= 30);
  setText(elements.lanterns, `${lanterns.filter(({ lit }) => lit).length} / ${lanterns.length}`);
  setText(elements.score, `${game.score} điểm`);
  setText(elements.carry, `${player.carried} / ${tuning.carry_capacity}`);
  slots.forEach((slot, index) => slot.classList.toggle('charged', index < player.carried));
  const cooldown = Math.max(0, player.pulseReadyAt - game.tick) / TICKS_PER_SECOND;
  const pulseStatus = cooldown > 0 ? `Tỏa Sáng hồi sau ${cooldown.toFixed(1)} giây`
    : player.carried >= tuning.pulse_cost ? 'Tỏa Sáng sẵn sàng' : `Tỏa Sáng cần ${tuning.pulse_cost} đom đóm`;
  setText(elements['pulse-status'], pulseStatus);

  const nearby = nearbyLantern(game);
  elements.action.hidden = !nearby;
  if (nearby) {
    setText(elements.action, `E · Nạp ánh sáng (${nearby.deposited}/${tuning.lantern_cost})`);
  }
  elements.feedback.hidden = game.tick >= feedbackUntil;
}

function run(view) {
  function restart() {
    game = createGame(seed);
    started = true;
    cameraYaw = 0;
    accumulator = 0;
    previousTime = 0;
    feedbackUntil = 0;
    keys.clear();
    pendingActions.clear();
    elements.overlay.hidden = true;
    elements.hud.hidden = false;
    elements.controls.hidden = false;
    elements.reticle.hidden = false;
    elements.game.dataset.state = 'playing';
    view.reset();
    drawHud();
  }

  function showResult() {
    started = false;
    drawHud();
    elements.game.dataset.state = game.state;
    elements.controls.hidden = true;
    elements.reticle.hidden = true;
    elements.feedback.hidden = true;
    elements.overlay.hidden = false;
    const won = game.state === 'won';
    setText(elements.chapter, won ? 'Đảo Bến đã sáng' : 'Đêm 1 · Đảo Bến');
    setText(elements.title, won ? 'Bình minh' : 'Đèn đã tắt');
    const reason = won ? 'Mây đã thắp sáng cả năm chiếc đèn.'
      : game.reason === 'dawn' ? 'Trời đã sáng trước khi Mây thắp hết đèn.' : 'Mây đã hết Ngọn Lửa.';
    setText(elements.description, `${reason} Điểm của bạn: ${game.score}.`);
    setText(elements.start, 'Chơi lại');
    elements.start.focus({ preventScroll: true });
  }

  function notice(message) {
    setText(elements.feedback, message);
    feedbackUntil = game.tick + 100;
  }

  function takeAction(action) {
    return !game.previousInput[action] && pendingActions.delete(action);
  }

  function step() {
    if (keys.has('ArrowLeft')) cameraYaw += 1.75 * tickLength;
    if (keys.has('ArrowRight')) cameraYaw -= 1.75 * tickLength;
    // With the camera looking toward +Z, +X lies on the left side of the screen.
    const input = {
      move: [
        Number(keys.has('KeyA')) - Number(keys.has('KeyD')),
        Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
      ],
      cam_yaw_deg: cameraYaw * 180 / Math.PI,
      jump: takeAction('jump'),
      interact: takeAction('interact'),
      pulse: takeAction('pulse'),
    };
    for (const { name, data } of stepGame(game, input)) {
      if (name === 'pulse') view.pulse(game.player.pos);
      if (name === 'lantern_lit') notice('Một ngọn đèn đã sáng');
      if (name === 'player_hit') notice(data.by === 'fall' ? 'Mây vừa rơi khỏi đảo' : 'Bóng Mực chạm vào Mây');
      if (name === 'game_over') showResult();
    }
  }

  elements.start.addEventListener('click', restart);
  window.addEventListener('keydown', (event) => {
    if (!started || (!movement.has(event.code) && !actions.has(event.code))) return;
    event.preventDefault();
    if (movement.has(event.code)) keys.add(event.code);
    if (!event.repeat && actions.has(event.code)) pendingActions.add(actions.get(event.code));
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pendingActions.clear();
    dragX = undefined;
  });

  elements.view.addEventListener('pointerdown', (event) => {
    if (!started || event.button !== 0) return;
    dragX = event.clientX;
    elements.view.setPointerCapture(event.pointerId);
  });
  elements.view.addEventListener('pointermove', (event) => {
    if (dragX === undefined) return;
    cameraYaw -= (event.clientX - dragX) * 0.009;
    dragX = event.clientX;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    elements.view.addEventListener(event, () => { dragX = undefined; });
  }

  function frame(timestamp) {
    const delta = previousTime === 0 ? 0 : Math.min((timestamp - previousTime) / 1000, 0.2);
    previousTime = timestamp;
    if (started) {
      accumulator += delta;
      while (accumulator + 1e-9 >= tickLength && started) {
        step();
        accumulator -= tickLength;
      }
      if (started) drawHud();
    }
    view.draw(game, cameraYaw, timestamp / 1000, delta);
    requestAnimationFrame(frame);
  }

  view.draw(game, cameraYaw, 0, 0);
  requestAnimationFrame(frame);
}

try {
  run(createView(elements.view, game));
} catch (error) {
  console.error(error);
  setText(elements.description, 'Không mở được cảnh 3D. Hãy dùng trình duyệt có hỗ trợ WebGL 2.');
  elements.start.disabled = true;
}
