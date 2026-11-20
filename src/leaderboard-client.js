import { addEntry, rankEntries } from './leaderboard.js';

const LEADERBOARD_KEY = 'dao-den-long.leaderboard';

function loadLocal() {
  try {
    return rankEntries(JSON.parse(localStorage.getItem(LEADERBOARD_KEY))?.entries);
  } catch {
    return [];
  }
}

async function api(options) {
  let result;
  try {
    result = await fetch(new URL('api/leaderboard', document.baseURI), options);
  } catch {
    return null;
  }
  if (result.status === 404 || result.status === 405 || !result.headers.get('content-type')?.includes('application/json')) {
    return null;
  }
  if (!result.ok) throw new Error('Không đọc hoặc lưu được bảng xếp hạng.');
  return rankEntries((await result.json()).entries);
}

export async function showEntries() {
  return await api() ?? loadLocal();
}

export async function saveEntry(entry) {
  const stored = await api({ method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry) });
  if (stored !== null) return stored;
  const entries = addEntry(loadLocal(), entry);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify({ entries }));
  return entries;
}
