import { useEffect, useState, type CSSProperties } from 'react';
import { VERDICT_BY_ID, isMajorStreamer, tmdbImage } from '../config';
import { useEditMode } from '../edit';
import type { PersonRole } from '../filters';
import type { LoggedWatch, Movie, Play, Provider, Rating, Ratings, WatchlistEntry } from '../types';
import { LoggedWatches } from './LoggedWatches';
import { Discussion } from './Discussion';
import { RatingSummary } from './RatingSummary';
import { SeasonsPanel } from './SeasonsPanel';
import { UNIVERSE_NAME } from '../../shared/universes.mjs';
import { sagaName } from '../filters';
import { StremioButton } from './StremioButton';
import { ChallengeButton, ChallengePanel, MyListButton } from './SocialBits';
import { averageScore } from '../filters';
import { CopyFrom, copyRating } from './CopyFrom';
import { RatingEditor } from './RatingEditor';
import { WatchInfo } from './WatchInfo';
import { WatchlistPanel } from './WatchlistPanel';

interface Props {
  /** Open with the trailer already playing (e.g. from the featured banner). */
  startWithTrailer?: boolean;
  movie: Movie;
  rating?: Rating;
  movies: Movie[];
  ratings: Ratings;
  /** Set when the movie is opened from the watchlist tab. */
  entry?: WatchlistEntry;
  onWatchlistChange?: (update: (prev: WatchlistEntry) => WatchlistEntry) => void;
  /** Watches logged on the site for this movie. */
  watch?: LoggedWatch;
  onLogWatch: (play: Play) => void;
  onRemoveWatch: (at: string) => void;
  onRate: (update: Rating | ((prev: Rating) => Rating)) => void;
  onClose: () => void;
  onStep: (delta: number) => void;
  onPerson: (code: string) => void;
  /** Shows every movie in a saga or universe. */
  onSaga: (code: string) => void;
}

export function MovieModal({ startWithTrailer, movie, rating, movies, ratings, entry, onWatchlistChange, watch, onLogWatch, onRemoveWatch, onRate, onClose, onStep, onPerson, onSaga }: Props) {
  const ADMIN = useEditMode() !== null;
  const [editing, setEditing] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const [challenging, setChallenging] = useState(false);

  useEffect(() => {
    setTrailer(Boolean(startWithTrailer));
    setChallenging(false);
  }, [movie.key, startWithTrailer]);

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
            {poster && (
              <div className="poster-wrap">
                <img className="modal-poster" src={poster} alt="" />
                <PosterBadges imdb={movie.imdbRating} avg={averageScore(rating)} />
              </div>
            )}
            <div className="modal-titles">
              <h2>{movie.title}</h2>
              {movie.originalTitle && <p className="muted small">{movie.originalTitle}</p>}
              <p className="muted">
                {[
                  movie.tv ? showYears(movie) : movie.year,
                  movie.tv?.network,
                  movie.tv && `${movie.tv.seasons.length} season${movie.tv.seasons.length === 1 ? '' : 's'}`,
                  movie.certification,
                  movie.runtime && `${movie.runtime} min${movie.tv ? ' episodes' : ''}`,
                  movie.genres.join(', '),
                ]
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
                {movie.ids.imdb && <StremioButton imdb={movie.ids.imdb} type={movie.tv ? 'series' : 'movie'} />}
                {movie.ids.tmdb && (
                  <a className="btn" href={`https://www.themoviedb.org/movie/${movie.ids.tmdb}`} target="_blank" rel="noreferrer">
                    TMDB {movie.tmdbRating ? `★ ${movie.tmdbRating}` : ''}
                  </a>
                )}
                <MyListButton movie={movie} />
                {!movie.tv && <ChallengeButton rating={rating} onOpen={() => setChallenging(true)} />}
                {ADMIN && !entry && (
                  <button type="button" className="btn primary" onClick={() => setEditing((x) => !x)}>
                    {editing ? 'Done editing' : 'Edit rating'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {entry && onWatchlistChange ? (
            <WatchlistPanel entry={entry} movie={movie} onChange={onWatchlistChange} onSeen={onLogWatch} />
          ) : (
          <section className="verdict-panel">
            {editing ? (
              <>
                <CopyFrom movie={movie} movies={movies} ratings={ratings} onCopy={(from) => onRate((prev) => copyRating(prev, from))} />
                <RatingEditor value={rating} onChange={onRate} movie={movie} />
              </>
            ) : (
              <>
                <RatingSummary rating={rating} />
                <ChallengePanel movie={movie} rating={rating} open={challenging} setOpen={setChallenging} />
              </>
            )}
            <WatchInfo movie={movie} rating={rating} />
            {ADMIN && !movie.tv && <LoggedWatches movie={movie} watch={watch} onAdd={onLogWatch} onRemove={onRemoveWatch} />}
          </section>
          )}

          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
          <p>{movie.overview}</p>

          <div className="credits">
            {people('d', movie.tv ? 'Created by' : 'Director', movie.directors)}
            {people('w', 'Writing', movie.writers.slice(0, 4))}
            {people('c', 'Music', movie.composers.slice(0, 3))}
            {people('p', 'Cinematography', movie.cinematographers.slice(0, 2))}
            {(movie.collection || movie.universes?.length) && (
              <div className="credit">
                <span className="credit-label">Part of</span>
                {[...(movie.universes ?? []).map((u) => `u:${u}`), ...(movie.collection ? [`c:${movie.collection}`] : [])].map((code) => (
                  <button key={code} type="button" className="link" onClick={() => onSaga(code)}>
                    {sagaName(code, UNIVERSE_NAME)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {movie.tv && <SeasonsPanel show={movie} rating={rating} />}

          <Discussion movie={movie} rating={rating} />

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
              <ProviderRow label="Stream" list={movie.providers.stream.filter((p) => isMajorStreamer(p.name))} />
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

/** IMDb and my average on a large poster (movie page, Recent). */
export function PosterBadges({ imdb, avg }: { imdb?: number; avg: number | null }) {
  return (
    <>
      {imdb !== undefined && (
        <span className="card-imdb">
          IMDb <b>{imdb.toFixed(1)}</b>
        </span>
      )}
      {avg !== null && (
        <span className="card-avg poster-avg" title="Average of my scores">
          Avg {avg.toFixed(1)}
        </span>
      )}
    </>
  );
}

/** "2008–2013", or "2019–" while still running. */
function showYears(show: Movie) {
  const end = show.tv?.status === 'Ended' || show.tv?.status === 'Canceled' ? show.tv.lastAirDate?.slice(0, 4) : '';
  return end && end !== String(show.year) ? `${show.year}–${end}` : end ? String(show.year) : `${show.year}–`;
}
