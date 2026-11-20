const NAME = /^[A-Za-z0-9_]{3,12}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isScore(entry) {
  return entry !== null && typeof entry === 'object'
    && typeof entry.name === 'string' && NAME.test(entry.name)
    && Number.isSafeInteger(entry.score) && entry.score >= 0
    && Number.isInteger(entry.nights_won) && entry.nights_won >= 0 && entry.nights_won <= 3
    && Number.isSafeInteger(entry.seed);
}

export function rankEntries(entries) {
  const valid = Array.isArray(entries) ? entries.filter((entry) => isScore(entry)
    && typeof entry.achieved_at === 'string' && ISO_TIME.test(entry.achieved_at)
    && Number.isFinite(Date.parse(entry.achieved_at))) : [];
  return valid.sort((first, second) => second.score - first.score
    || Date.parse(first.achieved_at) - Date.parse(second.achieved_at)).slice(0, 10);
}

export function addEntry(entries, score, now = new Date()) {
  if (!isScore(score)) throw new TypeError('Tên cần 3–12 ký tự chữ, số hoặc dấu gạch dưới.');
  const { name, score: points, nights_won, seed } = score;
  return rankEntries([...entries, { name, score: points, nights_won, achieved_at: now.toISOString(), seed }]);
}
