import type { CSSProperties } from 'react';
import { VERDICT_BY_ID, tmdbImage } from '../config';
import { averageScore } from '../filters';
import type { Movie, Rating, WatchlistEntry } from '../types';

interface Props {
  movie: Movie;
  rating?: Rating;
  /** Set on the watchlist tab. */
  entry?: WatchlistEntry;
  onOpen: () => void;
}

export function MovieCard({ movie, rating, entry, onOpen }: Props) {
  const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
  const poster = tmdbImage(movie.poster, 'w342');
  const epic = rating?.scores?.epic;
  const average = averageScore(rating);
  const scoreCount = Object.keys(rating?.scores ?? {}).length;

  return (
    <button type="button" className="card" onClick={onOpen} style={{ '--c': verdict?.color } as CSSProperties}>
      <div className="card-poster">
        {poster ? <img src={poster} alt="" loading="lazy" /> : <div className="no-poster">{movie.title}</div>}
        {movie.imdbRating !== undefined && (
          <span className="card-imdb" title={`IMDb ${movie.imdbRating} (${movie.imdbVotes?.toLocaleString()} votes)`}>
            IMDb <b>{movie.imdbRating.toFixed(1)}</b>
          </span>
        )}
        {verdict && <span className="card-verdict">{verdict.label}</span>}
        {entry?.priority && <span className={`card-priority priority-badge ${entry.priority}`}>{entry.priority}</span>}
        {((epic !== undefined && epic >= 8) || average !== null) && (
          <div className="card-badges-right">
            {epic !== undefined && epic >= 8 && (
              <span className="card-epic" title={`Epic ${epic}/10`}>
                Epic {epic}
              </span>
            )}
            {average !== null && (
              <span className="card-avg" title={`Average of my ${scoreCount} score${scoreCount === 1 ? '' : 's'}`}>
                Avg {average.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="card-body">
        <span className="card-title">{movie.title}</span>
        <span className="card-meta">
          {movie.year}
          {movie.directors[0] ? ` · ${movie.directors[0]}` : ''}
        </span>
        {rating?.note && <span className="card-note">“{rating.note}”</span>}
        {entry?.why && <span className="card-note">{entry.why}</span>}
      </div>
    </button>
  );
}
