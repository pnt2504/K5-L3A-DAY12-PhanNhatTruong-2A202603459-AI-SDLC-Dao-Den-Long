import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { ensureBenchBrowser } from './ensure-bench-browser.js';
import { startGameServer } from './game-server.js';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'docs/proof/phase-4' },
  'video-dir': { type: 'string' }, headless: { type: 'boolean' } } });
const out = resolve(values.out);
const temporary = mkdtempSync(join(tmpdir(), 'lantern-browser-'));
const before = process.env.DAO_DEN_LONG_DATA_DIR;
process.env.DAO_DEN_LONG_DATA_DIR = join(temporary, 'data');
mkdirSync(out, { recursive: true });

let server;
let browser;
let context;
try {
  server = await startGameServer();
  const root = server.url;
  const port = Number(new URL(root).port);
  browser = await chromium.launch({ executablePath: ensureBenchBrowser(), headless: Boolean(values.headless),
    args: ['--window-size=1280,720'] });
  const size = { width: 1280, height: 720 };
  context = await browser.newContext({
    viewport: size, deviceScaleFactor: 1,
    ...(values['video-dir'] ? { recordVideo: { dir: resolve(values['video-dir']), size } } : {}),
  });
  const recordingStart = performance.now();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const button = (name) => page.getByRole('button', { name, exact: true });
  const proof = { videoCues: {} };
  const cue = (name) => { proof.videoCues[name] = (performance.now() - recordingStart) / 1000; };
  await page.goto(`${root}/?seed=12`);
  await button('Cài đặt').click();
  const font = () => page.locator('#start').evaluate((element) => getComputedStyle(element).fontSize);
  proof.normalText = await font();
  assert.equal(proof.normalText, '18px');
  await page.getByLabel('Chữ lớn').check();
  await page.getByLabel('Giảm chuyển động').check();
  proof.largeText = await font();
  assert.equal(proof.largeText, '22.5px');
  await page.screenshot({ path: join(out, 'accessibility.jpg'), type: 'jpeg', quality: 86 });
  await button('Đổi phím').click();
  const pauseControl = page.getByRole('button', { name: /^Đổi phím Tạm dừng\./ });
  await pauseControl.click();
  await page.keyboard.press('w');
  proof.conflict = await page.locator('#key-status').innerText();
  assert.match(proof.conflict, /W đã dùng cho Đi lên/);
  await page.keyboard.press('o');
  assert.match(await pauseControl.getAttribute('aria-label'), /Hiện tại: O$/);
  await page.screenshot({ path: join(out, 'bindings.jpg'), type: 'jpeg', quality: 86 });
  await page.reload();
  assert.equal(await page.locator('#game').getAttribute('data-reduced-motion'), 'true');
  assert.equal(await page.locator('#game').getAttribute('data-large-text'), 'true');
  await button('Bắt đầu').click();
  await button('Vào đêm').click();
  cue('nightStart');
  await page.keyboard.press('o');
  await page.getByRole('heading', { name: 'Tạm dừng' }).waitFor();
  proof.remapAfterReload = await page.locator('#game').getAttribute('data-state');
  assert.equal(proof.remapAfterReload, 'paused');
  const pausedTime = await page.locator('#time').innerText();
  await button('Cài đặt').click();
  await button('Đổi phím').click();
  await button('Khôi phục mặc định').click();
  assert.match(await pauseControl.getAttribute('aria-label'), /Hiện tại: P$/);
  await button('Quay lại').click();
  await page.getByLabel('Chữ lớn').uncheck();
  await page.getByLabel('Giảm chuyển động').uncheck();
  await button('Quay lại').click();
  assert.equal(await page.locator('#time').innerText(), pausedTime);
  await page.keyboard.press('p');
  assert.equal(await page.locator('#game').getAttribute('data-state'), 'playing');

  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => document.getElementById('carry').textContent.startsWith('1 /'), null, { timeout: 5000 });
  } finally {
    await page.keyboard.up('w');
  }
  proof.pickedMote = await page.locator('#carry').innerText();
  await page.keyboard.press('Space');
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => document.getElementById('dash-status').textContent.includes('giây'));
  await page.getByText('Bóng Mực xuất hiện', { exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole('img', { name: 'Hướng Bóng Mực vừa xuất hiện' }).waitFor();
  proof.shadeCaptionAndArrow = true;
  proof.hudMinimumText = await page.locator('#hud .hud-label, #lanterns, #score, #dawn-target, #time, .keys kbd, #captions')
    .evaluateAll((parts) => Math.min(...parts.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))));
  assert.ok(proof.hudMinimumText >= 18);
  await page.screenshot({ path: join(out, 'gameplay.jpg'), type: 'jpeg', quality: 88 });

  const action = page.locator('#action');
  await page.keyboard.down('w');
  try {
    await action.waitFor({ state: 'visible', timeout: 20000 });
  } finally {
    await page.keyboard.up('w');
  }
  await page.keyboard.press('e');
  await page.waitForFunction(() => Number.parseInt(document.getElementById('score').textContent, 10) > 0);
  cue('deposit');
  proof.deposited = await page.locator('#score').innerText();

  const lost = page.getByRole('heading', { name: 'Đèn đã tắt' });
  await page.keyboard.down('w');
  try {
    await Promise.race([lost.waitFor({ timeout: 300000 }), page.waitForTimeout(26000)]);
  } finally {
    await page.keyboard.up('w');
  }
  await lost.waitFor({ timeout: 300000 });
  cue('lost');
  const name = page.getByLabel('Tên trên bảng xếp hạng');
  await name.fill('May-');
  assert.equal(await name.evaluate((field) => field.validity.patternMismatch), true);
  await name.fill('Demo_May');
  await button('Lưu điểm').click();
  await page.getByText('Đã lưu điểm.', { exact: true }).waitFor();
  if (values['video-dir']) await page.waitForTimeout(1800);
  await server.close();
  server = await startGameServer({ port });
  await page.goto(root);
  await button('Bảng xếp hạng').click();
  await page.getByText('Demo_May', { exact: true }).waitFor();
  cue('leaderboard');
  proof.rankAfterServerRestart = true;
  await page.screenshot({ path: join(out, 'leaderboard.jpg'), type: 'jpeg', quality: 90 });
  const exportFile = join(out, 'leaderboard-export.json');
  execFileSync(process.execPath, ['scripts/run.js', '--export-leaderboard', exportFile]);
  const exported = JSON.parse(readFileSync(exportFile, 'utf8')).entries;
  assert.equal(exported.length, 1);
  assert.deepEqual({ ...exported[0], achieved_at: undefined },
    { name: 'Demo_May', score: 0, nights_won: 0, seed: 12, achieved_at: undefined });
  assert.deepEqual(errors, []);
  writeFileSync(join(out, 'browser.json'), `${JSON.stringify({ ...proof, viewport: size, consoleErrors: errors }, null, 2)}\n`);
  if (values['video-dir']) await page.waitForTimeout(2200);
  const video = page.video();
  await context.close();
  context = undefined;
  if (video) process.stdout.write(`Video raw: ${await video.path()}\n`);
  process.stdout.write('Kiểm chứng browser thành công.\n');
} finally {
  await context?.close();
  await browser?.close();
  await server?.close();
  if (before === undefined) delete process.env.DAO_DEN_LONG_DATA_DIR;
  else process.env.DAO_DEN_LONG_DATA_DIR = before;
  rmSync(temporary, { recursive: true, force: true });
}
