import { createBenchWorld, stepBenchWorld, benchCamera } from './bench-world.js';
import { TICKS_PER_SECOND } from './rules.js';
import { createView } from './scene.js';
import { summarizeFrames } from './bench-metrics.js';

const { searchParams } = new URL(location.href);
const seed = Number(searchParams.get('seed'));
const durationMs = Number(searchParams.get('duration')) * 1000;
const warmupMs = 3000;

globalThis.benchmarkResult = new Promise((resolve, reject) => {
  const world = createBenchWorld(seed);
  const view = createView(document.getElementById('benchmark'), world);
  const renderer = view.rendererName();
  const intervals = [];
  let beginning;
  let previous;
  let firstFrameAt;

  function frame(timestamp) {
    try {
      beginning ??= timestamp;
      const elapsed = timestamp - beginning;
      const seconds = elapsed / 1000;
      const targetTick = Math.floor(seconds * TICKS_PER_SECOND);
      while (world.simTick < targetTick) stepBenchWorld(world);
      view.draw(world, 0, seconds, previous === undefined ? 0 : (timestamp - previous) / 1000, benchCamera(seconds));
      firstFrameAt ??= performance.timeOrigin + performance.now();
      if (previous !== undefined && previous - beginning >= warmupMs && elapsed <= warmupMs + durationMs) {
        const interval = timestamp - previous;
        if (interval > 0) intervals.push(interval);
      }
      previous = timestamp;
      if (elapsed >= warmupMs + durationMs) {
        resolve({ ...summarizeFrames(intervals), firstFrameAt, renderer,
          width: innerWidth, height: innerHeight, shades: world.shades.length, motes: world.motes.length });
      } else requestAnimationFrame(frame);
    } catch (error) {
      reject(error);
    }
  }
  requestAnimationFrame(frame);
});
