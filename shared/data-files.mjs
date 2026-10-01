// How pending edits are written into the data files. Shared by the browser's GitHub
// edit mode, so commits from the site look exactly like the dev server's writes
// (sorted keys, same history line format; see scripts/store.mjs).

export const FILES = {
  ratings: 'data/ratings.json',
  ratingsHistory: 'data/ratings-history.jsonl',
  watchlist: 'data/watchlist.json',
  watchlistHistory: 'data/watchlist-history.jsonl',
  watchlistMovies: 'data/watchlist-movies.json',
};

const sortedJson = (obj) =>
  JSON.stringify(Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n';

/**
 * changes: {
 *   ratings?:   { [key]: rating | null },
 *   watchlist?: { [key]: entry | null },
 *   watchlistMovies?: Movie[]   // catalog entries for newly added watchlist movies
 * }
 * read(path) returns the file's current text (or null). Edits are merged per key
 * into the latest file, so changes made elsewhere in the meantime are kept.
 */
export async function buildDataFiles(read, changes, at = new Date().toISOString()) {
  const files = {};
  const collections = [
    ['ratings', FILES.ratings, FILES.ratingsHistory, 'rating'],
    ['watchlist', FILES.watchlist, FILES.watchlistHistory, 'entry'],
  ];
  for (const [name, file, historyFile, field] of collections) {
    const edits = Object.entries(changes[name] ?? {});
    if (!edits.length) continue;
    const all = JSON.parse((await read(file)) ?? '{}');
    let history = (await read(historyFile)) ?? '';
    if (history && !history.endsWith('\n')) history += '\n';
    for (const [key, value] of edits) {
      if (value) all[key] = value;
      else delete all[key];
      history += JSON.stringify({ at, key, [field]: value, by: 'site' }) + '\n';
    }
    files[file] = sortedJson(all);
    files[historyFile] = history;
  }

  const added = changes.watchlistMovies ?? [];
  if (added.length) {
    const catalog = JSON.parse((await read(FILES.watchlistMovies)) ?? '[]');
    const known = new Set(catalog.map((m) => m.key));
    const fresh = added.filter((m) => !known.has(m.key));
    if (fresh.length) files[FILES.watchlistMovies] = JSON.stringify([...catalog, ...fresh]) + '\n';
  }
  return files;
}
