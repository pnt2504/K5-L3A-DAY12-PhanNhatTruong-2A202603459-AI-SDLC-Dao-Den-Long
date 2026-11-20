import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadLeaderboard, startGameServer } from './game-server.js';

function openBrowser(url) {
  const command = process.platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
    : process.platform === 'darwin' ? ['open', url] : ['xdg-open', url];
  const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' });
  child.on('error', () => process.stderr.write(`Mở ${url} trong trình duyệt để chơi.\n`));
  child.unref();
}

async function run() {
  const { values } = parseArgs({ options: {
    'export-leaderboard': { type: 'string' }, 'no-open': { type: 'boolean' }, port: { type: 'string', default: '4380' },
  } });
  if (values['export-leaderboard'] !== undefined) {
    writeFileSync(values['export-leaderboard'], `${JSON.stringify({ entries: loadLeaderboard() }, null, 2)}\n`);
    return;
  }
  const port = Number(values.port);
  if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('--port phải là số nguyên từ 0 đến 65535');
  }
  const server = await startGameServer({ port });
  process.stdout.write(`Đảo Đèn Lồng · ${server.url}\n`);
  if (!values['no-open']) openBrowser(server.url);
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
