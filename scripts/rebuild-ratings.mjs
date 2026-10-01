// Replays data/ratings-history.jsonl into data/ratings.rebuilt.json.
// It never touches data/ratings.json: compare the result, then copy it over yourself.
//
// Usage: npm run ratings:rebuild [-- --until 2026-10-01T12:00]

import fs from 'node:fs';
import path from 'node:path';

const DATA = path.resolve(process.env.MOVIERANK_DATA ?? path.join(import.meta.dirname, '..', 'data'));
const HISTORY = path.join(DATA, 'ratings-history.jsonl');
const OUT = path.join(DATA, 'ratings.rebuilt.json');

const untilArg = process.argv.indexOf('--until');
const until = untilArg > -1 ? new Date(process.argv[untilArg + 1]).toISOString() : null;

if (!fs.existsSync(HISTORY)) {
  console.error('No history yet (data/ratings-history.jsonl).');
  process.exit(1);
}

const ratings = {};
let applied = 0;
for (const line of fs.readFileSync(HISTORY, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const { at, key, rating } = JSON.parse(line);
  if (until && at > until) break;
  if (rating) ratings[key] = rating;
  else delete ratings[key];
  applied++;
}

const sorted = Object.fromEntries(Object.entries(ratings).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Replayed ${applied} changes${until ? ` up to ${until}` : ''}: ${Object.keys(sorted).length} rated movies`);
console.log(`Wrote data/ratings.rebuilt.json — review it, then copy over data/ratings.json if it looks right.`);
