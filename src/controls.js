export const actions = [
  ['up', 'Đi lên'], ['left', 'Sang trái'], ['down', 'Đi xuống'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng'],
];

export const defaultBindings = Object.freeze({
  up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft',
  interact: 'KeyE', pulse: 'KeyQ', pause: 'KeyP',
});

const aliases = { Escape: 'pause', ShiftRight: 'dash', ArrowUp: 'up', ArrowDown: 'down' };
const friendly = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/',
  Semicolon: ';', Quote: "'", Backslash: '\\', Backquote: '`' };

export function isBindable(code) {
  return typeof code === 'string' && (Object.hasOwn(friendly, code)
    || /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9]|Enter)$/.test(code));
}

export function keyName(code) {
  return friendly[code] ?? code.replace(/^(?:Key|Digit)/, '');
}

export function normalizeBindings(stored) {
  const codes = actions.map(([action]) => stored?.[action]);
  if (!codes.every(isBindable) || new Set(codes).size !== codes.length) return { ...defaultBindings };
  return Object.fromEntries(actions.map(([action], index) => [action, codes[index]]));
}

export function actionForCode(bindings, code) {
  const primary = actions.find(([action]) => bindings[action] === code)?.[0];
  if (primary) return primary;
  const alias = aliases[code];
  if (alias && bindings[alias] === defaultBindings[alias]) return alias;
  if (code === 'ArrowLeft') return 'cameraLeft';
  if (code === 'ArrowRight') return 'cameraRight';
  return undefined;
}

export function bindingConflict(bindings, action, code) {
  const match = actions.find(([other]) => other !== action && bindings[other] === code);
  return match?.[1];
}
