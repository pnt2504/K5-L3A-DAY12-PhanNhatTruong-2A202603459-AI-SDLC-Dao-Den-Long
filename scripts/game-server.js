import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, isScore, rankEntries } from '../src/leaderboard.js';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4' };

function leaderboardPath() {
  const data = process.env.DAO_DEN_LONG_DATA_DIR ?? join(homedir(), '.dao-den-long');
  return join(data, 'leaderboard.json');
}

export function loadLeaderboard() {
  const file = leaderboardPath();
  if (!existsSync(file)) return [];
  return rankEntries(JSON.parse(readFileSync(file, 'utf8')).entries);
}

function saveLeaderboard(entry) {
  const entries = addEntry(loadLeaderboard(), entry);
  const path = leaderboardPath();
  mkdirSync(dirname(path), { recursive: true });
  const next = `${path}.${process.pid}.tmp`;
  writeFileSync(next, `${JSON.stringify({ entries }, null, 2)}\n`, 'utf8');
  renameSync(next, path);
  return entries;
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  let data = '';
  request.setEncoding('utf8');
  for await (const piece of request) {
    data += piece;
    if (data.length > 4096) throw new RangeError('Nội dung vượt giới hạn');
  }
  return JSON.parse(data);
}

async function handleLeaderboard(request, response) {
  if (request.method === 'GET') return json(response, 200, { entries: loadLeaderboard() });
  if (request.method !== 'POST') return json(response, 405, { error: 'Phương thức không hỗ trợ' });
  const origin = request.headers.origin;
  if (origin && origin !== `http://${request.headers.host}`) return json(response, 403, { error: 'Nguồn không hợp lệ' });
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { error: 'Cần gửi JSON' });
  }
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json(response, 400, { error: 'JSON không hợp lệ' });
  }
  if (!isScore(body)) return json(response, 400, { error: 'Tên, điểm, số đêm hoặc seed không hợp lệ' });
  return json(response, 200, { entries: saveLeaderboard(body) });
}

function serveFile(request, response, pathname, directory) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json(response, 405, { error: 'Phương thức không hỗ trợ' });
  }
  const file = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
  const local = relative(directory, file);
  if (local.startsWith('..') || isAbsolute(local)) return json(response, 404, { error: 'Không tìm thấy trang' });
  const info = statSync(file, { throwIfNoEntry: false });
  if (!info?.isFile()) return json(response, 404, { error: 'Không tìm thấy trang' });
  response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' });
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(file);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

export async function startGameServer({ port = 0, leaderboard = true, directory = DIST } = {}) {
  if (!existsSync(join(directory, 'index.html'))) throw new Error('Thiếu bản build. Chạy npm run build trước.');
  const server = createServer(async (request, response) => {
    const address = server.address();
    if (![`127.0.0.1:${address.port}`, `localhost:${address.port}`].includes(request.headers.host)) {
      return json(response, 403, { error: 'Chỉ có thể truy cập trên máy này' });
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      return json(response, 400, { error: 'Địa chỉ không hợp lệ' });
    }
    try {
      if (pathname === '/api/leaderboard' && leaderboard) return await handleLeaderboard(request, response);
      return serveFile(request, response, pathname, directory);
    } catch {
      if (!response.headersSent) json(response, 500, { error: 'Máy chủ cục bộ không đọc hoặc ghi được dữ liệu' });
      else response.destroy();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}
