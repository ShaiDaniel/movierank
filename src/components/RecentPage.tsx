import type { CSSProperties } from 'react';
import { VERDICT_BY_ID, tmdbImage } from '../config';
import { useEditMode } from '../edit';
import type { Movie, Rating, Ratings } from '../types';
import { CopyFrom, copyRating } from './CopyFrom';
import { RatingEditor } from './RatingEditor';
import { RatingSummary } from './RatingSummary';
import { WatchInfo } from './WatchInfo';
import { PosterBadges } from './MovieModal';
import { averageScore } from '../filters';

export const RECENT_COUNT = 5;

/** The latest watches with a real date (backfills from memory don't count), newest first. */
export function recentMovies(movies: Movie[], count = RECENT_COUNT) {
  const lastReal = (m: Movie) => m.plays.find((p) => !p.backfilled)?.at ?? '';
  return movies
    .filter(lastReal)
    .sort((a, b) => lastReal(b).localeCompare(lastReal(a)))
    .slice(0, count);
}

interface Props {
  movies: Movie[];
  ratings: Ratings;
  onRate: (key: string, update: Rating | ((prev: Rating) => Rating)) => void;
  onOpen: (key: string) => void;
  onPerson: (code: string) => void;
}

/** Big panels for the last few movies watched, while they're fresh enough to review in detail. */
export function RecentPage({ movies, ratings, onRate, onOpen, onPerson }: Props) {
  const editing = useEditMode() !== null;

  return (
    <div className="recent">
      <p className="muted">The last {RECENT_COUNT} movies watched{editing ? ' — fresh in memory, so review them in detail' : ''}.</p>
      {recentMovies(movies).map((m) => {
        const rating = ratings[m.key];
        const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
        const backdrop = tmdbImage(m.backdrop, 'w1280');
        return (
          <article key={m.key} className="recent-panel" style={{ '--c': verdict?.color } as CSSProperties}>
            <div className="recent-hero" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined} />
            <div className="recent-body">
              <div className="recent-info">
                <div className="recent-head">
                  {m.poster && (
                    <button type="button" className="recent-poster" onClick={() => onOpen(m.key)} aria-label={`Open ${m.title}`}>
                      <img src={tmdbImage(m.poster, 'w342')!} alt="" loading="lazy" />
                      <PosterBadges avg={averageScore(rating)} />
                    </button>
                  )}
                  <div>
                    <h2>
                      <button type="button" className="link title-link" onClick={() => onOpen(m.key)}>
                        {m.title}
                      </button>
                    </h2>
                    <p className="muted">
                      {[m.year, m.runtime && `${m.runtime} min`, m.genres.join(', ')].filter(Boolean).join(' · ')}
                    </p>
                    {m.imdbRating !== undefined && <span className="card-imdb static">IMDb <b>{m.imdbRating.toFixed(1)}</b></span>}
                    <WatchInfo movie={m} rating={rating} />
                  </div>
                </div>
                <p className="recent-overview">{m.overview}</p>
                <div className="credits">
                  {m.directors.length > 0 && (
                    <div className="credit">
                      <span className="credit-label">{m.kind === 'tv' ? 'Created by' : 'Director'}</span>
                      {m.directors.map((n) => (
                        <button key={n} type="button" className="link" onClick={() => onPerson(`d:${n}`)}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="credit">
                    <span className="credit-label">Cast</span>
                    {m.cast.slice(0, 6).map((c) => (
                      <button key={c.name} type="button" className="link" onClick={() => onPerson(`a:${c.name}`)}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="recent-rating verdict-panel">
                {editing ? (
                  <>
                    <CopyFrom movie={m} movies={movies} ratings={ratings} onCopy={(from) => onRate(m.key, (prev) => copyRating(prev, from))} />
                    <RatingEditor value={rating} onChange={(update) => onRate(m.key, update)} movie={m} />
                  </>
                ) : (
                  <RatingSummary rating={rating} />
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
