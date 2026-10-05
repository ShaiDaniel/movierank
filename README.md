# MovieRank

Shai's verdicts on every movie watched, for co-workers deciding what to watch.

**Live site:** https://shaidaniel.github.io/movierank/ — published by GitHub Actions on every push to `main`
(so `npm run backup` also publishes). Signed in with the owner's Google account, the site edits directly
(each change is committed to the repo); everyone else gets a read-only site.

## Everyday use

```bash
npm run dev        # open http://localhost:5173 — admin mode (Rate mode + Edit rating) is on locally
```

Ratings are saved to `data/ratings.json` as you rate. The published site is read-only.

### Adding new watches

1. Export your data from Trakt (same as the first time) and drop the zip into the project root (`trakt-export-*.zip`).
2. `npm run sync` — re-imports plays from the newest zip and fetches TMDB data for new movies.

`npm run enrich -- --refresh` re-fetches TMDB data for everything (e.g. to update streaming availability).

## Logging watches on the site

**+ Watched** (when editing) searches TMDB and logs a watch: today, on a date, or "a long time ago"
(shown as before tracking). On a watchlist movie, **Seen it** does the same and moves it to Watched.
On a movie's page, **+ Watched it again** adds a rewatch, and logged dates can be removed.

Logged watches live in `data/watches.json` (+ `watches-history.jsonl`; details of movies Trakt doesn't
know in `data/logged-movies.json`). They are merged with Trakt for display and never overwrite Trakt data.
If you log a movie in both, a site play within a day of a Trakt play counts as the same watch.

## Watchlist

The **Watchlist** tab shows movies you plan to watch, with priority and why/who recommended them.

- **Add from the site:** click **+ Watchlist** (local admin only), search TMDB, add, then set priority and why.
- **From Trakt:** `npm run sync` merges new Trakt watchlist movies. Movies you removed on the site stay removed.
- **Watched it?** Once it shows up in your Trakt history (after a sync), it leaves the watchlist and appears
  in Rate mode as unrated.

Stored in `data/watchlist.json` (+ `watchlist-history.jsonl`); `data/watchlist-movies.json` holds its TMDB details.

## How dates work

Plays logged before **2017-08-23** are treated as backfills (Trakt filled in the release date, or the
"just now" bulk add on 2017-08-21/22) and shown as "Watched before Aug 2017". Change `TRACKING_START`
in `scripts/import-trakt.mjs` and `trackingStartLabel` in `src/config.ts` together.

## Files

- `data/trakt-movies.json` — plays per movie from the Trakt export
- `data/movies.json` — catalog the site loads (Trakt + TMDB)
- `data/ratings.json` — your verdicts, scores and notes (the source of truth; commit it)
- `data/tmdb-cache/` — cached TMDB responses (git-ignored)

## Setup

Copy `.env.example` to `.env` and set `TMDB_TOKEN` (TMDB → Settings → API → API Read Access Token).

## Safety net for ratings

Every save is also appended to `data/ratings-history.jsonl` (commit it along with `ratings.json`).
If `ratings.json` is ever lost or broken:

```bash
npm run ratings:rebuild                              # replay everything
npm run ratings:rebuild -- --until 2026-10-01T12:00  # or only up to a point in time
```

Run `npm run backup` after a session to commit and push your ratings and watchlist to GitHub.

The rebuild writes `data/ratings.rebuilt.json` for you to check and copy over; it never overwrites `ratings.json`.
In the browser, unsaved edits are kept in localStorage and retried until the dev server confirms them.

## Editing on the public site

Sign in with Google as the owner (shai.daniel@gmail.com) and editing turns on: Rate mode, ratings,
+ Watched and + Watchlist. Changes are committed to this repo with a GitHub fine-grained token that is
stored in Firestore at `owner/credentials`, readable only by the owner (see `firestore.rules`).
The first sign-in asks once for the token. When the
token expires, the site asks for a new one.
