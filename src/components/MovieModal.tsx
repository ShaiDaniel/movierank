import { useEffect, useState, type CSSProperties } from 'react';
import { SCORES, VERDICT_BY_ID, tmdbImage } from '../config';
import { ADMIN } from '../data';
import type { PersonRole } from '../filters';
import type { Movie, Provider, Rating, Ratings, WatchlistEntry } from '../types';
import { CopyFrom, copyRating } from './CopyFrom';
import { RatingEditor } from './RatingEditor';
import { WatchInfo } from './WatchInfo';
import { WatchlistPanel } from './WatchlistPanel';

interface Props {
  movie: Movie;
  rating?: Rating;
  movies: Movie[];
  ratings: Ratings;
  /** Set when the movie is opened from the watchlist tab. */
  entry?: WatchlistEntry;
  onWatchlistChange?: (update: (prev: WatchlistEntry) => WatchlistEntry) => void;
  onRate: (update: Rating | ((prev: Rating) => Rating)) => void;
  onClose: () => void;
  onStep: (delta: number) => void;
  onPerson: (code: string) => void;
}

export function MovieModal({ movie, rating, movies, ratings, entry, onWatchlistChange, onRate, onClose, onStep, onPerson }: Props) {
  const [editing, setEditing] = useState(false);
  const [trailer, setTrailer] = useState(false);

  useEffect(() => setTrailer(false), [movie.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        // First Escape leaves the text box; the next one closes the page.
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose, onStep]);

  const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
  const backdrop = tmdbImage(movie.backdrop, 'w1280');
  const poster = tmdbImage(movie.poster, 'w342');
  const scored = SCORES.filter((s) => rating?.scores?.[s.id] !== undefined);

  const people = (role: PersonRole, label: string, names: string[]) =>
    names.length > 0 && (
      <div className="credit">
        <span className="credit-label">{label}</span>
        {names.map((n) => (
          <button key={n} type="button" className="link" onClick={() => onPerson(`${role}:${n}`)}>
            {n}
          </button>
        ))}
      </div>
    );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={movie.title}
        onClick={(e) => e.stopPropagation()}
        style={{ '--c': verdict?.color } as CSSProperties}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-hero" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
          {trailer && movie.trailer && (
            <iframe
              className="trailer"
              src={`https://www.youtube-nocookie.com/embed/${movie.trailer}?autoplay=1`}
              title={`${movie.title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <div className="modal-content">
          <div className="modal-head">
            {poster && <img className="modal-poster" src={poster} alt="" />}
            <div className="modal-titles">
              <h2>{movie.title}</h2>
              {movie.originalTitle && <p className="muted small">{movie.originalTitle}</p>}
              <p className="muted">
                {[movie.year, movie.certification, movie.runtime && `${movie.runtime} min`, movie.genres.join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="modal-actions">
                {movie.trailer && (
                  <button type="button" className="btn" onClick={() => setTrailer((t) => !t)}>
                    {trailer ? 'Hide trailer' : '▶ Trailer'}
                  </button>
                )}
                {movie.ids.imdb && (
                  <a className="btn" href={`https://www.imdb.com/title/${movie.ids.imdb}/`} target="_blank" rel="noreferrer">
                    IMDb {movie.imdbRating !== undefined ? `★ ${movie.imdbRating.toFixed(1)}` : ''}
                  </a>
                )}
                {movie.ids.tmdb && (
                  <a className="btn" href={`https://www.themoviedb.org/movie/${movie.ids.tmdb}`} target="_blank" rel="noreferrer">
                    TMDB {movie.tmdbRating ? `★ ${movie.tmdbRating}` : ''}
                  </a>
                )}
                {ADMIN && !entry && (
                  <button type="button" className="btn primary" onClick={() => setEditing((x) => !x)}>
                    {editing ? 'Done editing' : 'Edit rating'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {entry && onWatchlistChange ? (
            <WatchlistPanel entry={entry} onChange={onWatchlistChange} />
          ) : (
          <section className="verdict-panel">
            {editing ? (
              <>
                <CopyFrom movie={movie} movies={movies} ratings={ratings} onCopy={(from) => onRate((prev) => copyRating(prev, from))} />
                <RatingEditor value={rating} onChange={onRate} />
              </>
            ) : verdict || scored.length || rating?.note || rating?.review ? (
              <>
                {verdict && <div className="verdict-big">{verdict.label}</div>}
                {rating?.note && <p className="note">“{rating.note}”</p>}
                {rating?.review && <p className="review">{rating.review}</p>}
                {scored.length > 0 && (
                  <div className="score-bars">
                    {scored.map((s) => (
                      <div key={s.id} className="score-bar" title={s.hint}>
                        <span>{s.label}</span>
                        <div className="bar">
                          <div style={{ width: `${rating!.scores![s.id]! * 10}%` }} />
                        </div>
                        <b>{rating!.scores![s.id]}</b>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="muted">Not ranked yet.</p>
            )}
            <WatchInfo movie={movie} rating={rating} />
          </section>
          )}

          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
          <p>{movie.overview}</p>

          <div className="credits">
            {people('d', 'Director', movie.directors)}
            {people('w', 'Writing', movie.writers.slice(0, 4))}
            {people('c', 'Music', movie.composers.slice(0, 3))}
            {people('p', 'Cinematography', movie.cinematographers.slice(0, 2))}
            {movie.collection && (
              <div className="credit">
                <span className="credit-label">Part of</span>
                {movie.collection}
              </div>
            )}
          </div>

          {movie.cast.length > 0 && (
            <>
              <h3>Cast</h3>
              <div className="cast">
                {movie.cast.map((c) => (
                  <button key={c.name} type="button" className="cast-member" onClick={() => onPerson(`a:${c.name}`)}>
                    {c.photo ? <img src={tmdbImage(c.photo, 'w92')!} alt="" loading="lazy" /> : <span className="no-photo" />}
                    <span className="cast-name">{c.name}</span>
                    <span className="cast-char">{c.character}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <h3>Where to watch in Israel</h3>
          {movie.providers && (movie.providers.stream.length || movie.providers.rent.length || movie.providers.buy.length) ? (
            <div className="providers">
              <ProviderRow label="Stream" list={movie.providers.stream} />
              <ProviderRow label="Rent" list={movie.providers.rent} />
              <ProviderRow label="Buy" list={movie.providers.buy} />
              <a className="small" href={movie.providers.link} target="_blank" rel="noreferrer">
                All options (JustWatch) ↗
              </a>
            </div>
          ) : (
            <p className="muted">No streaming info for Israel.</p>
          )}

          <nav className="modal-step">
            <button type="button" className="btn" onClick={() => onStep(-1)}>
              ← Previous
            </button>
            <button type="button" className="btn" onClick={() => onStep(1)}>
              Next →
            </button>
          </nav>
        </div>
      </article>
    </div>
  );
}

function ProviderRow({ label, list }: { label: string; list: Provider[] }) {
  if (!list.length) return null;
  return (
    <div className="provider-row">
      <span className="credit-label">{label}</span>
      {list.map((p) => (
        <img key={p.name} src={tmdbImage(p.logo, 'w92')!} alt={p.name} title={p.name} className="provider-logo" />
      ))}
    </div>
  );
}
