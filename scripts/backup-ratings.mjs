// Commits and pushes your ratings and watchlist to GitHub. Safe to run any time; does nothing if unchanged.
// Usage: npm run backup

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILES = [
  'data/ratings.json',
  'data/ratings-history.jsonl',
  'data/watchlist.json',
  'data/watchlist-history.jsonl',
  'data/watchlist-movies.json',
  'data/watches.json',
  'data/watches-history.jsonl',
  'data/logged-movies.json',
].filter((f) => fs.existsSync(path.join(ROOT, f)));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

if (!git('status', '--porcelain', '--', ...FILES)) {
  console.log('Ratings and watchlist unchanged since the last backup.');
  process.exit(0);
}

const ranked = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ratings.json'), 'utf8'))).filter(
  (r) => r.verdict,
).length;
git('add', '--', ...FILES);
git('commit', '-m', `Ratings backup (${ranked} ranked)`);
// Edits made on the public site are commits too: bring them in before pushing.
try {
  execFileSync('git', ['pull', '--rebase', '--autostash'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('
Could not merge with changes made on the site. Ask Claude to resolve it; nothing was pushed.');
  process.exit(1);
}
execFileSync('git', ['push'], { cwd: ROOT, stdio: 'inherit' });
console.log(`Backed up ${ranked} ranked movies to GitHub.`);
