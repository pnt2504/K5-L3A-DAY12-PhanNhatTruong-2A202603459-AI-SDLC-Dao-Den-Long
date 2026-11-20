import { writeFileSync } from 'node:fs';
import { arch, release, type } from 'node:os';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { ensureBenchBrowser } from './ensure-bench-browser.js';
import { startGameServer } from './game-server.js';
import contract from '../game.contract.json' with { type: 'json' };

async function run() {
  const { values } = parseArgs({
    options: { seed: { type: 'string' }, duration: { type: 'string' }, out: { type: 'string' } },
  });
  const seed = Number(values.seed);
  const duration = Number(values.duration);
  if (!/^[+-]?\d+$/.test(values.seed ?? '') || !Number.isSafeInteger(seed)
      || !Number.isFinite(duration) || duration <= 0 || !values.out) {
    throw new Error('Cách chạy: node scripts/bench.js --seed 42 --duration 30 --out bench.json');
  }
  const started = performance.timeOrigin;
  const executablePath = ensureBenchBrowser();
  const server = await startGameServer({ leaderboard: false });
  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      headless: process.env.DAO_DEN_LONG_BENCH_HEADLESS === '1',
      args: ['--window-size=1280,720', '--window-position=0,0', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.bringToFront();
    await page.goto(`${server.url}/bench.html?seed=${seed}&duration=${duration}`);
    await page.waitForFunction(() => typeof globalThis.benchmarkResult !== 'undefined');
    const measured = await page.evaluate(() => globalThis.benchmarkResult);
    if (measured.width !== 1280 || measured.height !== 720 || measured.shades !== 200 || measured.motes !== 100) {
      throw new Error('Viewport hoặc số thực thể benchmark không đúng hợp đồng.');
    }
    const output = {
      contract_version: contract.contract_version,
      avg_fps: measured.avg_fps,
      p1_low_fps: measured.p1_low_fps,
      frame_ms_p95: measured.frame_ms_p95,
      frames: measured.frames,
      load_ms: Math.max(0, Math.round(measured.firstFrameAt - started)),
      peak_mem_mb: null,
      vsync_off: true,
      renderer: `${measured.renderer} · Chromium ${browser.version()}`,
      os: `${type()} ${release()} (${arch()})`,
    };
    writeFileSync(values.out, `${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await browser?.close();
    await server.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
