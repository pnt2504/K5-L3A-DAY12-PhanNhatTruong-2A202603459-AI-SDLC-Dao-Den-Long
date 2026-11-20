import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../package.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const release = join(root, 'release');
const temporary = mkdtempSync(join(tmpdir(), 'lantern-release-'));
const folder = `dao-den-long-v${manifest.version}`;
const bundle = join(temporary, folder);
const archive = join(release, `${folder}-web.tar.gz`);

try {
  mkdirSync(release, { recursive: true });
  mkdirSync(bundle);
  mkdirSync(join(bundle, 'src'));
  mkdirSync(join(bundle, 'scripts'));
  for (const file of ['dist', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md', 'scripts/game-server.js',
    'scripts/run.js', 'src/leaderboard.js']) {
    cpSync(join(root, file), join(bundle, file), { recursive: true });
  }
  writeFileSync(join(bundle, 'package.json'), JSON.stringify({
    name: manifest.name, version: manifest.version, private: true, type: 'module', engines: manifest.engines,
  }, null, 2));
  const licenses = [['three', 'LICENSE'], ['vite', 'LICENSE.md']].map(([name, filename]) => {
    const text = readFileSync(join(root, 'node_modules', name, filename), 'utf8');
    return `${name}\n\n${text.trim()}\n`;
  });
  writeFileSync(join(bundle, 'THIRD_PARTY_LICENSES.txt'), licenses.join('\n'));
  writeFileSync(join(bundle, 'CHOI-GAME.md'), [
    '# Đảo Đèn Lồng',
    '',
    'Cần Node.js 22.12 trở lên và trình duyệt hỗ trợ WebGL 2.',
    'Mở terminal trong thư mục vừa giải nén và chạy `node scripts/run.js`.',
    'Nếu trình duyệt chưa mở, truy cập địa chỉ được in trong terminal.',
    '',
    'WASD để di chuyển, Space nhảy, Shift lướt, E nạp hoặc châm đèn, Q Tỏa Sáng, P hoặc Esc tạm dừng.',
    'Đổi phím, giảm chuyển động và chữ lớn có trong Cài đặt.',
    '',
    'Xuất bảng điểm bằng `node scripts/run.js --export-leaderboard leaderboard.json`.',
  ].join('\n'));
  const result = spawnSync('tar', ['-czf', 'bundle.tar.gz', folder], { cwd: temporary, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Đóng gói thất bại.');
  copyFileSync(join(temporary, 'bundle.tar.gz'), archive);
  process.stdout.write(`${archive}\n`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
