import { useEffect, useRef, useState } from 'react';
import { tmdbImage } from '../config';
import { fetchWatchlistMovie, searchTmdb } from '../data';
import type { Movie, SearchResult } from '../types';

interface Props {
  /** Keys of movies already watched or already on the watchlist. */
  watched: Set<string>;
  listed: Set<string>;
  onAdded: (movie: Movie) => void;
  onOpen: (key: string, tab: 'watched' | 'watchlist') => void;
  onClose: () => void;
}

export function AddToWatchlist({ watched, listed, onAdded, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setResults([]);
    // Wait for a pause in typing before searching.
    const t = setTimeout(() => {
      searchTmdb(q)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch((e) => setError(String(e.message ?? e)));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = async (r: SearchResult) => {
    setBusy(r.tmdb);
    try {
      onAdded(await fetchWatchlistMovie(r.tmdb));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal add-dialog" role="dialog" aria-modal="true" aria-label="Add to watchlist" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-content">
          <h2>Add to watchlist</h2>
          <input
            ref={input}
            type="search"
            placeholder="Search TMDB for a movie…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <ul className="search-results">
            {results.map((r) => {
              const key = String(r.tmdb);
              const poster = tmdbImage(r.poster, 'w92');
              return (
                <li key={r.tmdb}>
                  {poster ? <img src={poster} alt="" /> : <span className="no-photo small-poster" />}
                  <div className="search-text">
                    <strong>
                      {r.title} {r.year && <span className="muted">({r.year})</span>}
                    </strong>
                    <span className="muted small">{r.overview}</span>
                  </div>
                  {watched.has(key) ? (
                    <button type="button" className="btn" onClick={() => onOpen(key, 'watched')}>
                      Watched ✓
                    </button>
                  ) : listed.has(key) ? (
                    <button type="button" className="btn" onClick={() => onOpen(key, 'watchlist')}>
                      On list ✓
                    </button>
                  ) : (
                    <button type="button" className="btn primary" disabled={busy !== null} onClick={() => add(r)}>
                      {busy === r.tmdb ? 'Adding…' : '+ Add'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
