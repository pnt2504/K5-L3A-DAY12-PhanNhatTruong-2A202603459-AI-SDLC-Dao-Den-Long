export function summarizeFrames(intervals) {
  const frames = intervals.length;
  if (frames === 0) throw new Error('Không ghi được khung hình trong khoảng đo.');
  const ordered = [...intervals].sort((first, second) => first - second);
  const total = ordered.reduce((sum, interval) => sum + interval, 0);
  const tail = ordered.slice(-Math.max(1, Math.ceil(frames * 0.01)));
  const slow = tail.reduce((sum, interval) => sum + interval, 0);
  return { avg_fps: 1000 * frames / total, p1_low_fps: 1000 * tail.length / slow,
    frame_ms_p95: ordered[Math.ceil(frames * 0.95) - 1], frames };
}
