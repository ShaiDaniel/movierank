import { useEffect, useMemo, useRef, useState } from 'react';
import { SCORES, VERDICTS, tmdbImage } from '../config';
import { lastWatched } from '../filters';
import type { Movie, Rating, Ratings } from '../types';
import { CopyFrom, copyRating, seriesSources } from './CopyFrom';
import { RatingEditor } from './RatingEditor';
import { WatchInfo } from './WatchInfo';

type Order = 'watched' | 'popular' | 'random';

interface Props {
  movies: Movie[];
  ratings: Ratings;
  onRate: (key: string, update: Rating | ((prev: Rating) => Rating)) => void;
  onClose: () => void;
}

const ROWS = SCORES.length + 1;

/** Fast queue for working through unrated movies, mostly from the keyboard. */
export function RateMode({ movies, ratings, onRate, onClose }: Props) {
  const [order, setOrder] = useState<Order>('watched');
  // The queue is fixed when the order changes, so a movie doesn't vanish while you rate it.
  const queue = useMemo(() => {
    const unrated = movies.filter((m) => !ratings[m.key]?.verdict);
    if (order === 'popular') return unrated.sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0));
    if (order === 'random') return unrated.sort(() => Math.random() - 0.5);
    return unrated.sort((a, b) => lastWatched(b).localeCompare(lastWatched(a)));
  }, [movies, order]);
  const [index, setIndex] = useState(0);
  const [row, setRowState] = useState(0);
  // Mirrored in a ref so keystrokes faster than a re-render still see the current row.
  const rowRef = useRef(0);
  const setRow = (next: number) => {
    rowRef.current = Math.max(0, Math.min(ROWS - 1, next));
    setRowState(rowRef.current);
  };

  const movie = queue[index];
  const rating = movie ? ratings[movie.key] : undefined;
  const ratedCount = movies.filter((m) => ratings[m.key]?.verdict).length;

  const go = (delta: number) => {
    setIndex((i) => Math.max(0, Math.min(queue.length, i + delta)));
    setRow(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') return onClose();
      if (!movie) return;

      const current = rowRef.current;
      const score = SCORES[current - 1]?.id;
      const set = (change: (r: Rating) => Rating) =>
        onRate(movie.key, (r) => ({ ...change(r), updatedAt: new Date().toISOString() }));

      if (e.key === 'ArrowDown') setRow(current + 1);
      else if (e.key === 'ArrowUp') setRow(current - 1);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'c' || e.key === 'C') {
        const source = seriesSources(movie, movies, ratings)[0];
        if (!source) return;
        onRate(movie.key, (r) => copyRating(r, ratings[source.key]));
      } else if (e.key === 'n' || e.key === 'N') document.querySelector<HTMLInputElement>('.rate-mode .note-input')?.focus();
      else if (e.key === 't' || e.key === 'T') document.querySelector<HTMLTextAreaElement>('.rate-mode .review-input')?.focus();
      else if (/^[0-9]$/.test(e.key)) {
        const digit = Number(e.key);
        if (!score) {
          const verdict = VERDICTS[digit - 1]?.id;
          if (!verdict) return;
          set((r) => ({ ...r, verdict }));
        } else {
          set((r) => ({ ...r, scores: { ...r.scores, [score]: digit === 0 ? 10 : digit } }));
        }
        setRow(current + 1);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        set((r) => {
          if (!score) return { ...r, verdict: undefined };
          const scores = { ...r.scores };
          delete scores[score];
          return { ...r, scores };
        });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="rate-mode" role="dialog" aria-modal="true" aria-label="Rate mode">
      <header className="rate-header">
        <strong>Rate mode</strong>
        <span className="muted">
          {ratedCount} of {movies.length} rated · {Math.min(index + 1, queue.length)} / {queue.length} in queue
        </span>
        <select
          value={order}
          onChange={(e) => {
            setOrder(e.target.value as Order);
            setIndex(0);
          }}
        >
          <option value="watched">Recently watched first</option>
          <option value="popular">Most popular first</option>
          <option value="random">Random</option>
        </select>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </header>

      {movie ? (
        <div className="rate-body">
          <div className="rate-movie">
            {tmdbImage(movie.poster, 'w342') && <img src={tmdbImage(movie.poster, 'w342')!} alt="" className="rate-poster" />}
            <div>
              <h2>
                {movie.title} <span className="muted">({movie.year})</span>
              </h2>
              <p className="muted">
                {movie.directors.join(', ')}
                {movie.runtime ? ` · ${movie.runtime} min` : ''}
                {movie.genres.length ? ` · ${movie.genres.join(', ')}` : ''}
              </p>
              {movie.collection && <p className="muted small">Part of {movie.collection}</p>}
              <p className="muted small">{movie.cast.slice(0, 5).map((c) => c.name).join(', ')}</p>
              <WatchInfo movie={movie} rating={rating} />
              <p className="rate-overview">{movie.overview}</p>
            </div>
          </div>
          <div>
            <CopyFrom movie={movie} movies={movies} ratings={ratings} onCopy={(from) => onRate(movie.key, (r) => copyRating(r, from))} />
            <RatingEditor value={rating} onChange={(r) => onRate(movie.key, r)} activeRow={row} onRowClick={setRow} />
            <div className="rate-nav">
              <button type="button" className="btn" onClick={() => go(-1)} disabled={index === 0}>
                ← Previous
              </button>
              <button type="button" className="btn primary" onClick={() => go(1)}>
                Next →
              </button>
            </div>
            <p className="kbd-help">
              <kbd>↑</kbd>
              <kbd>↓</kbd> choose row · Verdict <kbd>1</kbd>–<kbd>7</kbd> · Scores <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> = 10 ·{' '}
              <kbd>⌫</kbd> clear · <kbd>C</kbd> copy from series · <kbd>N</kbd> short take · <kbd>T</kbd> thoughts · <kbd>Enter</kbd>/<kbd>→</kbd> next · <kbd>←</kbd> back · <kbd>Esc</kbd> exit
            </p>
          </div>
        </div>
      ) : (
        <div className="rate-done">
          <h2>Queue finished 🎉</h2>
          <p className="muted">Everything in this queue has been through. Pick another order or close rate mode.</p>
          <button type="button" className="btn" onClick={() => setIndex(0)} disabled={!queue.length}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
