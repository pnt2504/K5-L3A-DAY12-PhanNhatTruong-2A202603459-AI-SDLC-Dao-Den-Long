import { createGame, DEFAULT_INPUT, nearbyLantern, stepGame, TICKS_PER_SECOND, tuning } from './game.js';
import { completeNight, createCampaign, nextNight, TOTAL_NIGHTS } from './campaign.js';
import { createSound } from './audio.js';
import { createView } from './scene.js';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((node) => [node.id, node]));
const buttons = ['start', 'secondary', 'tertiary', 'quaternary'].map((id) => elements[id]);
const actions = new Map([['Space', 'jump'], ['KeyE', 'interact'], ['KeyQ', 'pulse'],
  ['ShiftLeft', 'dash'], ['ShiftRight', 'dash']]);
const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const narration = [
  'Mây ơi, hãy lần theo con đường quanh bến. Ngọn đèn đầu tiên sẽ soi lối cho con.',
  'Qua cầu tre để sang đảo bên kia. Bục nhảy đưa con qua biển mây, còn bùa đỏ sẽ tiếp sức cho đôi chân.',
  'Hãy tìm dốc lên tầng giữa rồi dùng bục nhảy để lên tháp. Khi lá bắt đầu bay, gió mạnh sắp tới.',
];
const SETTINGS_KEY = 'dao-den-long.settings';
const query = new URLSearchParams(location.search);
const querySeed = query.get('seed');
const seed = querySeed !== null && /^-?\d+$/.test(querySeed) && Number.isSafeInteger(Number(querySeed))
  ? Number(querySeed) : crypto.getRandomValues(new Uint32Array(1))[0];
const measureFPS = query.get('fps') === '1';
const tickLength = 1 / TICKS_PER_SECOND;
const slots = Array.from({ length: tuning.carry_capacity }, () =>
  elements.slots.appendChild(document.createElement('span')));
const keys = new Set();
const pending = new Set();
const sound = createSound();

function bounded(value, minimum, maximum, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
    return { volume: bounded(stored.volume, 0, 100, 55), sensitivity: bounded(stored.sensitivity, 25, 200, 100) };
  } catch {
    return { volume: 55, sensitivity: 100 };
  }
}

const settings = readSettings();
let campaign = createCampaign();
let game = createGame(seed);
let cameraYaw = 0;
let mode = 'menu';
let previousTime;
let accumulator = 0;
let dragX;
let feedbackUntil = 0;
let lastFlames = -1;
let lastSeconds;
let settingsBack;
let benchmark;

function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function nightTitle() {
  return `Đêm ${campaign.night} · ${game.map.name}`;
}

function drawHud() {
  const { player, lanterns, simTick } = game;
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
  text(elements.time, time);
  elements.time.classList.toggle('urgent', seconds <= 30);
  if (seconds > 0 && seconds <= 10 && seconds !== lastSeconds) sound.cue('countdown');
  lastSeconds = seconds;
  text(elements['night-name'], nightTitle());
  text(elements.lanterns, `${lanterns.filter(({ lit }) => lit).length} / ${lanterns.length}`);
  text(elements.score, `${game.score} điểm`);
  text(elements.carry, `${player.carried} / ${tuning.carry_capacity}`);
  for (const [index, slot] of slots.entries()) slot.classList.toggle('charged', index < player.carried);
  const pulseCd = Math.max(0, player.pulseReadyAt - simTick) / TICKS_PER_SECOND;
  const dashCd = Math.max(0, player.dashReadyAt - simTick) / TICKS_PER_SECOND;
  const charm = Math.max(0, player.charmUntil - simTick) / TICKS_PER_SECOND;
  text(elements['pulse-status'], pulseCd > 0 ? `${pulseCd.toFixed(1)} giây`
    : player.carried >= tuning.pulse_cost ? 'Sẵn sàng' : 'Cần 3 đom đóm');
  text(elements['dash-status'], dashCd > 0 && charm === 0 ? `${dashCd.toFixed(1)} giây` : 'Sẵn sàng');
  elements['charm-status'].hidden = charm === 0;
  if (charm > 0) text(elements['charm-status'], `Bùa Gió · ${charm.toFixed(1)} giây`);

  const nearby = nearbyLantern(game);
  elements.action.hidden = !nearby;
  if (nearby) text(elements.action, `E — Nạp ánh sáng (${nearby.deposited}/${tuning.lantern_cost})`);
  elements.feedback.hidden = simTick >= feedbackUntil;
}

function clearInput() {
  keys.clear();
  pending.clear();
  dragX = undefined;
}

function showPanel(screen, chapter, title, description, options) {
  mode = screen;
  elements.game.dataset.state = screen;
  elements.overlay.dataset.screen = screen;
  elements.overlay.hidden = false;
  elements.settings.hidden = screen !== 'settings';
  text(elements.chapter, chapter);
  text(elements.title, title);
  text(elements.description, description);
  buttons.forEach((button, index) => {
    const option = options[index];
    button.hidden = !option;
    button.onclick = option?.[1] ?? null;
    if (option) text(button, option[0]);
  });
  elements['pause-button'].hidden = true;
  elements.controls.hidden = true;
  elements.abilities.hidden = true;
  elements.direction.hidden = true;
  elements.reticle.hidden = true;
  elements.feedback.hidden = true;
  elements.fps.hidden = true;
  elements.hud.hidden = !['paused', 'result', 'dawn'].includes(screen);
  clearInput();
  buttons[0].focus({ preventScroll: true });
}

function showControls() {
  mode = 'playing';
  elements.game.dataset.state = 'playing';
  elements.overlay.hidden = true;
  for (const name of ['hud', 'controls', 'abilities', 'reticle', 'pause-button']) elements[name].hidden = false;
  elements.fps.hidden = !measureFPS;
  if (measureFPS && !benchmark) text(elements.fps, 'Đang đo tốc độ khung hình…');
  document.activeElement?.blur();
  drawHud();
}

function setSettingsValues() {
  elements.volume.value = settings.volume;
  elements.sensitivity.value = settings.sensitivity;
  text(elements['volume-value'], `${settings.volume}%`);
  text(elements['sensitivity-value'], `${settings.sensitivity}%`);
  sound.volume(settings.volume / 100);
}

function updateSettings() {
  settings.volume = elements.volume.valueAsNumber;
  settings.sensitivity = elements.sensitivity.valueAsNumber;
  setSettingsValues();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sliders still work during this session if the browser blocks persistent storage.
  }
}

function showSettings(back) {
  settingsBack = back;
  showPanel('settings', 'Đảo Đèn Lồng', 'Cài đặt', '', [['Quay lại', back]]);
  setSettingsValues();
}

function run(view) {
  function resetNight() {
    game = createGame(seed, {}, campaign.night);
    cameraYaw = 0;
    accumulator = 0;
    previousTime = undefined;
    feedbackUntil = 0;
    lastSeconds = undefined;
    benchmark = undefined;
    clearInput();
    view.reset();
    view.draw(game, cameraYaw, 0, 0);
  }

  function showMenu() {
    sound.stop();
    campaign = createCampaign();
    resetNight();
    showPanel('menu', 'Ba hòn đảo', 'Đảo Đèn Lồng',
      'Cùng Mây gom đom đóm và thắp lại những ngọn đèn qua ba đêm.',
      [['Bắt đầu', showIntro], ['Cài đặt', () => showSettings(showMenu)]]);
  }

  function showIntro() {
    resetNight();
    showPanel('intro', nightTitle(), game.map.name,
      `Ông Đăng: “${narration[campaign.night - 1]}”`, [['Vào đêm', begin], ['Về menu', showMenu]]);
  }

  function begin() {
    resetNight();
    sound.music(campaign.night);
    showControls();
  }

  function showResult() {
    drawHud();
    sound.stop();
    sound.cue(game.state);
    const score = completeNight(campaign, game.state, game.score);
    if (game.state === 'won' && campaign.night === TOTAL_NIGHTS) {
      showPanel('dawn', nightTitle(), 'Bình Minh',
        `Ánh sáng đã trở lại cả ba hòn đảo. Tổng điểm: ${score}.`, [['Về menu', showMenu]]);
    } else if (game.state === 'won') {
      showPanel('result', nightTitle(), 'Đảo đã sáng',
        `Điểm Đêm ${campaign.night}: ${game.score}. Tổng điểm: ${score}.`,
        [['Đêm tiếp theo', () => { if (nextNight(campaign)) showIntro(); }], ['Về menu', showMenu]]);
    } else {
      const reason = game.reason === 'dawn' ? 'Trời đã sáng trước khi Mây thắp hết đèn.' : 'Mây đã hết Ngọn Lửa.';
      showPanel('result', nightTitle(), 'Đèn đã tắt', `${reason} Điểm Đêm này: ${game.score}.`,
        [['Chơi lại Đêm', begin], ['Về menu', showMenu]]);
    }
  }

  function notice(message) {
    text(elements.feedback, message);
    feedbackUntil = game.simTick + 105;
  }

  function processInput(input) {
    const wasWarning = game.wind.warning;
    for (const { name, data } of stepGame(game, input)) {
      sound.cue(name);
      if (name === 'pulse') view.pulse(game.player.pos);
      if (name === 'lantern_lit') notice('Một ngọn đèn đã sáng');
      if (name === 'player_hit') notice(data.by === 'fall' ? 'Mây vừa rơi khỏi đảo' : 'Bóng Mực chạm vào Mây');
      if (name === 'charm_picked') notice('Mây nhặt được Bùa Gió');
      if (name === 'drifter_steal') notice(`Gió Lạc lấy ${data.amount} đom đóm`);
      if (name === 'game_over') showResult();
    }
    if (game.jumped) sound.cue('jump');
    if (!wasWarning && game.wind.warning) {
      sound.cue('wind');
      notice('Gió mạnh sắp tới');
    }
  }

  function showPause() {
    showPanel('paused', nightTitle(), 'Tạm dừng', '',
      [['Tiếp tục', resume], ['Chơi lại Đêm', begin], ['Cài đặt', () => showSettings(showPause)], ['Về menu', showMenu]]);
  }

  function togglePauseInput() {
    if (game.previousInput.pause) processInput(DEFAULT_INPUT);
    processInput({ ...DEFAULT_INPUT, pause: true });
  }

  function pause() {
    if (mode !== 'playing') return;
    togglePauseInput();
    if (game.state !== 'paused') return;
    accumulator = 0;
    if (!benchmark?.complete) benchmark = undefined;
    sound.stop();
    showPause();
  }

  function resume() {
    togglePauseInput();
    if (game.state !== 'playing') return;
    previousTime = undefined;
    sound.music(campaign.night);
    showControls();
  }

  function takeAction(action) {
    return !game.previousInput[action] && pending.delete(action);
  }

  function step() {
    if (keys.has('ArrowLeft')) cameraYaw += 1.75 * tickLength;
    if (keys.has('ArrowRight')) cameraYaw -= 1.75 * tickLength;
    processInput({
      move: [Number(keys.has('KeyA')) - Number(keys.has('KeyD')),
        Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))],
      cam_yaw_deg: cameraYaw * 180 / Math.PI,
      jump: takeAction('jump'), interact: takeAction('interact'), pulse: takeAction('pulse'),
      dash: takeAction('dash'), pause: false,
    });
  }

  function updateBenchmark(timestamp) {
    if (!measureFPS) return;
    const width = elements.view.clientWidth;
    const height = elements.view.clientHeight;
    if (!benchmark || benchmark.width !== width || benchmark.height !== height) {
      benchmark = { width, height, warmUntil: timestamp + 1200, start: null, frames: 0 };
      text(elements.fps, 'Đang đo tốc độ khung hình…');
    }
    if (benchmark.complete || timestamp < benchmark.warmUntil) return;
    benchmark.start ??= timestamp;
    const elapsed = timestamp - benchmark.start;
    if (elapsed >= 10000) {
      const fps = (1000 * benchmark.frames / elapsed).toFixed(1);
      text(elements.fps, `${width}×${height} · ${fps} FPS trung bình · ${(elapsed / 1000).toFixed(1)} giây`);
      benchmark.complete = true;
    }
    benchmark.frames += 1;
  }

  function frame(timestamp) {
    const delta = previousTime === undefined ? 0 : Math.min((timestamp - previousTime) / 1000, 0.2);
    previousTime = timestamp;
    if (mode === 'playing') {
      accumulator += delta;
      while (accumulator + 1e-9 >= tickLength && mode === 'playing') {
        step();
        accumulator -= tickLength;
      }
      if (mode === 'playing') drawHud();
    }
    const visualTime = mode === 'paused' || (mode === 'settings' && game.state === 'paused')
      ? game.simTick * tickLength : timestamp / 1000;
    view.draw(game, cameraYaw, visualTime, game.state === 'paused' ? 0 : delta);
    if (mode === 'playing') {
      const hint = view.hint(nearbyLantern(game, game.player.pos, Infinity));
      elements.direction.hidden = !hint;
      if (hint) {
        elements.direction.style.left = `${hint.x}%`;
        elements.direction.style.top = `${hint.y}%`;
        elements.direction.style.setProperty('--turn', `${hint.angle}deg`);
      }
      updateBenchmark(timestamp);
    }
    requestAnimationFrame(frame);
  }

  elements['pause-button'].addEventListener('click', pause);
  for (const key of ['volume', 'sensitivity']) elements[key].addEventListener('input', updateSettings);
  window.addEventListener('keydown', (event) => {
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
      if (mode === 'playing') pause();
      else if (mode === 'paused') resume();
      else if (mode === 'settings' && event.code === 'Escape') settingsBack();
      event.preventDefault();
      return;
    }
    if (mode !== 'playing' || (!movement.has(event.code) && !actions.has(event.code))) return;
    event.preventDefault();
    if (movement.has(event.code)) keys.add(event.code);
    if (!event.repeat && actions.has(event.code)) pending.add(actions.get(event.code));
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', clearInput);
  elements.view.addEventListener('pointerdown', (event) => {
    if (mode !== 'playing' || event.button !== 0) return;
    dragX = event.clientX;
    elements.view.setPointerCapture(event.pointerId);
  });
  elements.view.addEventListener('pointermove', (event) => {
    if (dragX === undefined) return;
    cameraYaw -= (event.clientX - dragX) * 0.009 * settings.sensitivity / 100;
    dragX = event.clientX;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    elements.view.addEventListener(event, () => { dragX = undefined; });
  }
  setSettingsValues();
  showMenu();
  requestAnimationFrame(frame);
}

try {
  run(createView(elements.view, game));
} catch (error) {
  console.error(error);
  text(elements.description, 'Không mở được cảnh 3D. Hãy dùng trình duyệt có hỗ trợ WebGL 2.');
  elements.start.disabled = true;
}
