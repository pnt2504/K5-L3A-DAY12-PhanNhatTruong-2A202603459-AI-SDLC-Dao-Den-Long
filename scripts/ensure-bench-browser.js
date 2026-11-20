import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export function installedBrowser() {
  if (process.platform === 'win32') {
    const chrome = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    const edge = process.env['ProgramFiles(x86)']
      && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    return [...chrome, edge].find((file) => file && existsSync(file))
      ?? (existsSync(chromium.executablePath()) ? chromium.executablePath() : undefined);
  }
  const external = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return external.find((file) => existsSync(file))
    ?? (existsSync(chromium.executablePath()) ? chromium.executablePath() : undefined);
}

export function ensureBenchBrowser() {
  const installed = installedBrowser();
  if (installed) return installed;
  const install = fileURLToPath(new URL('../node_modules/playwright/cli.js', import.meta.url));
  const result = spawnSync(process.execPath, [install, 'install', 'chromium'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0 || !existsSync(chromium.executablePath())) {
    throw new Error('Không cài được Chromium cho benchmark.');
  }
  return chromium.executablePath();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    ensureBenchBrowser();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
