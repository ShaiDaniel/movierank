import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SITE, VERDICT_BY_ID, tmdbImage } from '../config';
import { averageScore } from '../filters';
import type { Movie, Ratings } from '../types';

const INTERVAL_MS = 8000;
const MAX = 8;

interface Props {
  movies: Movie[];
  ratings: Ratings;
  onOpen: (key: string, trailer?: boolean) => void;
  /** Reports the backdrop on screen, for the page's ambient glow. */
  onBackdrop: (path: string | null) => void;
}

/** Same order all day, a new set each day: seeded by the date. */
function dailyShuffle<T>(items: T[]) {
  let seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  return [...items].sort(() => rand() - 0.5);
}

/** Banner of Must watch picks, cycling slowly; the first thing visitors see. */
export function FeaturedHero({ movies, ratings, onOpen, onBackdrop }: Props) {
  const picks = useMemo(() => {
    const must = movies.filter((m) => ratings[m.key]?.verdict === 'must' && m.backdrop);
    // Favor picks with a short take, which make the best headline.
    const withNote = must.filter((m) => ratings[m.key]?.note);
    return dailyShuffle(withNote.length >= 3 ? withNote : must).slice(0, MAX);
    // Picked once per load, so rating while browsing doesn't reshuffle the banner.
  }, [movies.length]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paused || reducedMotion || picks.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % picks.length), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, picks.length, reducedMotion]);

  const movie = picks[index];
  useEffect(() => onBackdrop(movie?.backdrop ?? null), [movie, onBackdrop]);
  if (!movie) return null;

  const rating = ratings[movie.key];
  const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
  const avg = averageScore(rating);

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label={`${SITE.owner}'s picks`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ '--c': verdict?.color } as CSSProperties}
    >
      {picks.map((m, i) => (
        <div
          key={m.key}
          className={`hero-backdrop ${i === index ? 'shown' : ''}`}
          style={{ backgroundImage: `url(${tmdbImage(m.backdrop, 'w1280')})` }}
          aria-hidden="true"
        />
      ))}
      <div className="hero-content" key={movie.key}>
        <span className="hero-kicker">{SITE.owner}'s pick</span>
        <h2 className="hero-title">{movie.title}</h2>
        <p className="hero-meta">
          {verdict && <span className="hero-verdict">{verdict.label}</span>}
          <span>{movie.year}</span>
          {movie.directors[0] && <span>{movie.directors[0]}</span>}
          {avg !== null && <span>Avg {avg.toFixed(1)}</span>}
          {movie.imdbRating !== undefined && <span>IMDb {movie.imdbRating.toFixed(1)}</span>}
        </p>
        {rating?.note ? <p className="hero-take">“{rating.note}”</p> : <p className="hero-take muted">{movie.tagline ?? ''}</p>}
        <div className="hero-actions">
          <button type="button" className="btn primary" onClick={() => onOpen(movie.key)}>
            Open
          </button>
          {movie.trailer && (
            <button type="button" className="btn" onClick={() => onOpen(movie.key, true)}>
              ▶ Trailer
            </button>
          )}
        </div>
      </div>
      {picks.length > 1 && (
        <div className="hero-dots">
          {picks.map((m, i) => (
            <button
              key={m.key}
              type="button"
              className={i === index ? 'on' : ''}
              aria-label={`Show ${m.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
