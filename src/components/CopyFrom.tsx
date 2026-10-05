import { useEffect, useState } from 'react';
import { VERDICT_BY_ID } from '../config';
import { averageScore } from '../filters';
import type { Movie, Rating, Ratings } from '../types';

interface Props {
  movie: Movie;
  movies: Movie[];
  ratings: Ratings;
  onCopy: (from: Rating) => void;
}

/** Something worth copying: a verdict or at least one score. */
const hasRanks = (r: Rating | undefined) => Boolean(r?.verdict || Object.keys(r?.scores ?? {}).length);

/** "Must watch", or "Avg 6.4" for a movie scored but not given a verdict yet. */
function summary(r: Rating) {
  if (r.verdict) return VERDICT_BY_ID[r.verdict].label;
  const avg = averageScore(r);
  return avg === null ? 'scores' : `Avg ${avg.toFixed(1)}, no verdict`;
}

/** Ranked movies in the same TMDB collection, oldest first. */
export function seriesSources(movie: Movie, movies: Movie[], ratings: Ratings) {
  if (!movie.collection) return [];
  return movies
    .filter((m) => m.collection === movie.collection && m.key !== movie.key && hasRanks(ratings[m.key]))
    .sort((a, b) => a.year - b.year);
}

/** Copies the verdict and scores as independent values; notes and the date flag stay specific to each movie. */
export function copyRating(target: Rating | undefined, from: Rating): Rating {
  return { ...target, verdict: from.verdict ?? target?.verdict, scores: { ...from.scores }, updatedAt: new Date().toISOString() };
}

export function CopyFrom({ movie, movies, ratings, onCopy }: Props) {
  const [text, setText] = useState('');
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  useEffect(() => setCopiedFrom(null), [movie.key]);
  const copy = (m: Movie) => {
    onCopy(ratings[m.key]);
    setCopiedFrom(m.title);
    setText('');
  };
  const series = seriesSources(movie, movies, ratings);

  const q = text.trim().toLowerCase();
  const matches =
    q.length < 2
      ? []
      : movies
          .filter((m) => m.key !== movie.key && hasRanks(ratings[m.key]) && m.title.toLowerCase().includes(q))
          .slice(0, 8);

  const button = (m: Movie, hint?: string) => (
    <button
      key={m.key}
      type="button"
      className="chip copy-chip"
      onClick={() => copy(m)}
      title={hint}
    >
      Copy from {m.title} <span className="count">{summary(ratings[m.key])}</span>
    </button>
  );

  return (
    <div className="copy-from">
      {copiedFrom && (
        <p className="copy-note">
          ✓ Copied from {copiedFrom}. Change anything below. The original stays as it was.
        </p>
      )}
      {series.length > 0 && <div className="chips">{series.map((m, i) => button(m, i === 0 ? 'Key C' : undefined))}</div>}
      <div className="people-search">
        <input
          type="search"
          placeholder="Copy ranks from another rated movie…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {matches.length > 0 && (
          <ul className="suggestions">
            {matches.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  onClick={() => copy(m)}
                >
                  {m.title} ({m.year})
                  <span className="muted small">{summary(ratings[m.key])}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
