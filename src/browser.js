import { createGame, DEFAULT_INPUT, stepGame, TICKS_PER_SECOND, tuning } from './game.js';
import { carryCapacity } from './rules.js';
import { dawnThreshold, fuelValue, isWeakLight, lightCost, nearbyLantern, nearestLantern } from './lanterns.js';
import { completeNight, createCampaign, nextNight, TOTAL_NIGHTS } from './campaign.js';
import { createSound } from './audio.js';
import { createView } from './scene.js';
import { actionForCode, actions, bindingConflict, defaultBindings, isBindable, keyName, normalizeBindings } from './controls.js';
import { saveEntry, showEntries } from './leaderboard-client.js';

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((node) => [node.id, node]));
const buttons = ['start', 'secondary', 'tertiary', 'quaternary'].map((id) => elements[id]);
const movement = new Set(['up', 'left', 'down', 'right', 'cameraLeft', 'cameraRight']);
const edgeActions = new Set(['jump', 'interact', 'pulse', 'dash']);
const narration = [
  'Mây ơi, hãy lần theo con đường quanh bến. Đèn sẽ cạn dầu, con nhớ quay lại châm thêm trước bình minh.',
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
const slots = Array.from({ length: tuning.capacity_max }, () =>
  elements.slots.appendChild(document.createElement('span')));
const keys = new Map();
const pending = new Set();
const sound = createSound();
const keyButtons = new Map();

function bounded(value, minimum, maximum, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function readSettings() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    stored = null;
  }
  return { volume: bounded(stored?.volume, 0, 100, 55), sensitivity: bounded(stored?.sensitivity, 25, 200, 100),
    distinctColors: stored?.distinctColors === true, largeText: stored?.largeText === true,
    reducedMotion: typeof stored?.reducedMotion === 'boolean' ? stored.reducedMotion
      : matchMedia('(prefers-reduced-motion: reduce)').matches,
    bindings: normalizeBindings(stored?.bindings) };
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
let feedbackMessage = '';
let feedbackWarning = false;
let lastFlames = -1;
let lastSeconds;
let settingsBack;
let benchmark;
let captureAction;
let offeredScore;
let screenRevision = 0;
let spawnIndicator;

function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function nightTitle() {
  return `Đêm ${campaign.night} · ${game.map.name}`;
}

function warningText(message, warning) {
  return warning && settings.distinctColors ? `⚠ ${message}` : message;
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
  const urgent = seconds <= 30;
  text(elements.time, warningText(time, urgent));
  elements.time.classList.toggle('urgent', urgent);
  if (seconds > 0 && seconds <= 10 && seconds !== lastSeconds) sound.cue('countdown');
  lastSeconds = seconds;
  text(elements['night-name'], nightTitle());
  text(elements.lanterns, `${lanterns.filter(({ lit }) => lit).length} / ${lanterns.length}`);
  text(elements['dawn-target'], `Giữ ${dawnThreshold(game)} đèn tới bình minh`);
  text(elements.score, `${game.score} điểm`);
  const capacity = carryCapacity(player);
  text(elements.carry, `${player.carried} / ${capacity}`);
  for (const [index, slot] of slots.entries()) {
    slot.hidden = index >= capacity;
    slot.classList.toggle('charged', index < player.carried);
  }
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
  if (nearby) {
    const warning = isWeakLight(nearby);
    const key = keyName(settings.bindings.interact);
    const action = nearby.lit ? `${key} — Châm dầu (${fuelValue(nearby).toFixed(1)}/100)`
      : `${key} — ${nearby.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${nearby.deposited}/${lightCost(nearby)})`;
    elements.action.classList.toggle('warning', warning);
    text(elements.action, warningText(action, warning));
  }
  elements.feedback.hidden = simTick >= feedbackUntil;
  if (!elements.feedback.hidden) {
    elements.feedback.classList.toggle('warning', feedbackWarning);
    text(elements.feedback, warningText(feedbackMessage, feedbackWarning));
  }
  const captions = [];
  if (spawnIndicator && simTick < spawnIndicator.until) captions.push('Bóng Mực xuất hiện');
  if (game.wind.warning) captions.push('Gió mạnh sắp tới');
  if (seconds > 0 && seconds <= 10) captions.push(`Còn ${seconds} giây`);
  const low = lanterns.filter(isWeakLight);
  if (low.length > 0) captions.push(`Đèn yếu: ${low.map(({ id }) => id).join(', ')}`);
  elements.captions.hidden = captions.length === 0;
  if (captions.length > 0) text(elements.captions, warningText(captions.join(' · '), true));
}

function clearInput() {
  keys.clear();
  pending.clear();
  dragX = undefined;
}

function showPanel(screen, chapter, title, description, options) {
  mode = screen;
  screenRevision += 1;
  captureAction = undefined;
  offeredScore = undefined;
  elements.game.dataset.state = screen;
  elements.overlay.dataset.screen = screen;
  elements.overlay.hidden = false;
  elements.settings.hidden = screen !== 'settings';
  elements['key-settings'].hidden = screen !== 'bindings';
  elements['score-list'].hidden = screen !== 'leaderboard';
  elements['score-form'].hidden = true;
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
  elements['shade-direction'].hidden = true;
  elements.captions.hidden = true;
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
  elements['distinct-colors'].checked = settings.distinctColors;
  elements['large-text'].checked = settings.largeText;
  elements['reduced-motion'].checked = settings.reducedMotion;
  elements.game.dataset.palette = settings.distinctColors ? 'distinct' : 'standard';
  elements.game.dataset.largeText = settings.largeText;
  elements.game.dataset.reducedMotion = settings.reducedMotion;
  text(elements['volume-value'], `${settings.volume}%`);
  text(elements['sensitivity-value'], `${settings.sensitivity}%`);
  sound.volume(settings.volume / 100);
  text(elements['move-key'], ['up', 'left', 'down', 'right'].map((action) => keyName(settings.bindings[action])).join('/'));
  for (const action of ['jump', 'dash', 'pulse', 'pause']) {
    text(elements[`${action}-key`], keyName(settings.bindings[action]));
  }
  for (const [action, label] of actions) {
    const button = keyButtons.get(action);
    if (!button) continue;
    const name = keyName(settings.bindings[action]);
    text(button, name);
    button.setAttribute('aria-label', `Đổi phím ${label}. Hiện tại: ${name}`);
  }
}

function persistSettings() {
  setSettingsValues();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sliders still work during this session if the browser blocks persistent storage.
  }
}

function updateSettings() {
  settings.volume = elements.volume.valueAsNumber;
  settings.sensitivity = elements.sensitivity.valueAsNumber;
  settings.distinctColors = elements['distinct-colors'].checked;
  settings.largeText = elements['large-text'].checked;
  settings.reducedMotion = elements['reduced-motion'].checked;
  persistSettings();
}

function showSettings(back) {
  settingsBack = back;
  showPanel('settings', 'Đảo Đèn Lồng', 'Cài đặt', '',
    [['Quay lại', back], ['Đổi phím', () => showBindingSettings(back)]]);
  setSettingsValues();
}

function showBindingSettings(back) {
  const returnToSettings = () => showSettings(back);
  settingsBack = returnToSettings;
  showPanel('bindings', 'Cài đặt', 'Đổi phím', '',
    [['Quay lại', returnToSettings], ['Khôi phục mặc định', () => {
      captureAction = undefined;
      settings.bindings = { ...defaultBindings };
      persistSettings();
      text(elements['key-status'], 'Đã khôi phục phím mặc định.');
    }]]);
  text(elements['key-status'], '');
  setSettingsValues();
}

function captureBinding(event) {
  if (event.code === 'Tab') {
    captureAction = undefined;
    text(elements['key-status'], '');
    return;
  }
  event.preventDefault();
  if (event.repeat) return;
  if (!isBindable(event.code) || event.altKey || event.metaKey || event.ctrlKey) {
    text(elements['key-status'], 'Chọn một phím chữ, số, mũi tên hoặc phím điều khiển đơn.');
    return;
  }
  const conflict = bindingConflict(settings.bindings, captureAction, event.code);
  if (conflict) {
    text(elements['key-status'], `${keyName(event.code)} đã dùng cho ${conflict}. Hãy chọn phím khác.`);
    return;
  }
  settings.bindings[captureAction] = event.code;
  captureAction = undefined;
  persistSettings();
  text(elements['key-status'], `Đã lưu phím ${keyName(event.code)}.`);
}

function offerScore(score) {
  offeredScore = { score, nights_won: campaign.wins.length, seed };
  elements['score-form'].reset();
  elements['score-form'].hidden = false;
  elements['score-name'].disabled = false;
  elements['save-score'].disabled = false;
  text(elements['score-status'], '');
}

function run(view) {
  function resetNight() {
    game = createGame(seed, {}, campaign.night);
    cameraYaw = 0;
    accumulator = 0;
    previousTime = undefined;
    feedbackUntil = 0;
    spawnIndicator = undefined;
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
      'Cùng Mây gom đom đóm, châm dầu và giữ ba hòn đảo sáng đến bình minh.',
      [['Bắt đầu', showIntro], ['Cài đặt', () => showSettings(showMenu)], ['Bảng xếp hạng', showLeaderboard]]);
  }

  async function showLeaderboard() {
    elements['score-list'].replaceChildren();
    showPanel('leaderboard', 'Đảo Đèn Lồng', 'Bảng xếp hạng', 'Đang đọc kết quả…', [['Về menu', showMenu]]);
    const revision = screenRevision;
    try {
      const entries = await showEntries();
      if (revision !== screenRevision) return;
      text(elements.description, entries.length ? '' : 'Chưa có điểm nào được lưu.');
      for (const entry of entries) {
        const item = document.createElement('li');
        const row = document.createElement('div');
        row.className = 'score-row';
        const name = document.createElement('strong');
        const progress = document.createElement('span');
        const score = document.createElement('span');
        name.textContent = entry.name;
        progress.textContent = `${entry.nights_won}/3`;
        progress.title = 'Số đêm đã thắng';
        score.textContent = entry.score.toLocaleString('vi-VN');
        item.title = `${new Date(entry.achieved_at).toLocaleString('vi-VN')} · Seed ${entry.seed}`;
        row.append(name, progress, score);
        item.append(row);
        elements['score-list'].append(item);
      }
    } catch (error) {
      if (revision === screenRevision) text(elements.description, error.message);
    }
  }

  async function submitScore(event) {
    event.preventDefault();
    if (!offeredScore || elements['save-score'].disabled) return;
    const attempt = offeredScore;
    elements['save-score'].disabled = true;
    try {
      await saveEntry({ ...attempt, name: elements['score-name'].value });
      if (offeredScore === attempt) {
        elements['score-name'].disabled = true;
        text(elements['score-status'], 'Đã lưu điểm.');
      }
    } catch (error) {
      if (offeredScore === attempt) {
        elements['save-score'].disabled = false;
        text(elements['score-status'], error.message);
      }
    }
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
      offerScore(score);
    } else if (game.state === 'won') {
      showPanel('result', nightTitle(), 'Đảo đã sáng',
        `Điểm Đêm ${campaign.night}: ${game.score}. Tổng điểm: ${score}.`,
        [['Đêm tiếp theo', () => { if (nextNight(campaign)) showIntro(); }], ['Về menu', showMenu]]);
    } else {
      const reason = game.reason === 'dawn' ? 'Đảo còn quá ít đèn sáng lúc bình minh.' : 'Mây đã hết Ngọn Lửa.';
      showPanel('result', nightTitle(), 'Đèn đã tắt', `${reason} Điểm Đêm này: ${game.score}.`,
        [['Chơi lại Đêm', begin], ['Về menu', showMenu]]);
      offerScore(score);
    }
  }

  function notice(message, warning = false) {
    feedbackMessage = message;
    feedbackWarning = warning;
    feedbackUntil = game.simTick + 105;
  }

  function processInput(input) {
    const wasWarning = game.wind.warning;
    for (const { name, data } of stepGame(game, input)) {
      sound.cue(name);
      if (name === 'pulse') view.pulse(game.player.pos);
      if (name === 'lantern_lit') notice(data.relight ? 'Ngọn đèn đã được thắp lại' : 'Một ngọn đèn đã sáng');
      if (name === 'refuel') notice('Đèn đã được châm dầu');
      if (name === 'lantern_out') notice('Một ngọn đèn đã cạn dầu', true);
      if (name === 'player_hit') notice(data.by === 'fall' ? 'Mây vừa rơi khỏi đảo' : 'Bóng Mực chạm vào Mây', true);
      if (name === 'charm_picked') notice('Mây nhặt được Bùa Gió');
      if (name === 'drifter_steal') notice(`Gió Lạc lấy ${data.amount} đom đóm`);
      if (name === 'shade_spawned') spawnIndicator = { id: data.id, until: game.simTick + 180 };
      if (name === 'game_over') showResult();
    }
    if (game.jumped) sound.cue('jump');
    if (!wasWarning && game.wind.warning) {
      sound.cue('wind');
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

  function movementHeld(action) {
    for (const pressed of keys.values()) {
      if (action === pressed) return 1;
    }
    return 0;
  }

  function step() {
    if (movementHeld('cameraLeft')) cameraYaw += 1.75 * tickLength;
    if (movementHeld('cameraRight')) cameraYaw -= 1.75 * tickLength;
    processInput({
      move: [movementHeld('left') - movementHeld('right'), movementHeld('up') - movementHeld('down')],
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
      placeIndicator(elements.direction, view.hint(nearestLantern(game.lanterns, game.player.pos,
        (lantern) => !lantern.lit)));
      const shade = spawnIndicator && game.simTick < spawnIndicator.until
        ? game.shades.find(({ id }) => id === spawnIndicator.id) : null;
      placeIndicator(elements['shade-direction'], view.hint(shade, true, 0));
      updateBenchmark(timestamp);
    }
    requestAnimationFrame(frame);
  }

  function placeIndicator(node, hint) {
    node.hidden = !hint;
    if (!hint) return;
    node.style.left = `${hint.x}%`;
    node.style.top = `${hint.y}%`;
    node.style.setProperty('--turn', `${hint.angle}deg`);
  }

  elements['pause-button'].addEventListener('click', pause);
  elements['score-form'].addEventListener('submit', submitScore);
  for (const [action, label] of actions) {
    const row = document.createElement('div');
    row.className = 'key-row';
    const name = document.createElement('span');
    name.textContent = label;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.addEventListener('click', () => {
      captureAction = action;
      text(elements['key-status'], `Bấm phím mới cho ${label}.`);
    });
    row.append(name, button);
    elements['key-list'].append(row);
    keyButtons.set(action, button);
  }
  for (const key of ['volume', 'sensitivity']) elements[key].addEventListener('input', updateSettings);
  for (const key of ['distinct-colors', 'large-text', 'reduced-motion']) {
    elements[key].addEventListener('change', () => {
      updateSettings();
      view.setDistinctColors(settings.distinctColors);
      view.setReducedMotion(settings.reducedMotion);
    });
  }
  window.addEventListener('keydown', (event) => {
    if (mode === 'bindings' && captureAction) {
      captureBinding(event);
      return;
    }
    if ((mode === 'settings' || mode === 'bindings') && event.code === 'Escape' && !event.repeat) {
      event.preventDefault();
      settingsBack();
      return;
    }
    const action = actionForCode(settings.bindings, event.code);
    if (action === 'pause' && !event.repeat && (mode === 'playing' || mode === 'paused')) {
      if (mode === 'playing') pause();
      else resume();
      event.preventDefault();
      return;
    }
    if (mode !== 'playing' || (!movement.has(action) && !edgeActions.has(action))) return;
    event.preventDefault();
    if (movement.has(action)) keys.set(event.code, action);
    if (!event.repeat && edgeActions.has(action)) pending.add(action);
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
  view.setDistinctColors(settings.distinctColors);
  view.setReducedMotion(settings.reducedMotion);
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
