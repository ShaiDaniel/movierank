# MovieRank

Shai's verdicts on every movie watched, for co-workers deciding what to watch.

## Everyday use

```bash
npm run dev        # open http://localhost:5173 — admin mode (Rate mode + Edit rating) is on locally
```

Ratings are saved to `data/ratings.json` as you rate. The published site is read-only.

### Adding new watches

1. Export your data from Trakt (same as the first time) and drop the zip into the project root (`trakt-export-*.zip`).
2. `npm run sync` — re-imports plays from the newest zip and fetches TMDB data for new movies.

`npm run enrich -- --refresh` re-fetches TMDB data for everything (e.g. to update streaming availability).

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

This writes `data/ratings.rebuilt.json` for you to check and copy over; it never overwrites `ratings.json`.
In the browser, unsaved edits are kept in localStorage and retried until the dev server confirms them.
