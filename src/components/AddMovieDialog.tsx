import { useEffect, useRef, useState } from 'react';
import { tmdbImage } from '../config';
import { fetchMovieDetails, searchTmdb } from '../data';
import type { Movie, Play, SearchResult } from '../types';
import { WatchDatePicker } from './WatchDatePicker';

export type AddPurpose = 'watchlist' | 'watched';

interface Props {
  purpose: AddPurpose;
  /** Keys of movies already watched or already on the watchlist. */
  watched: Set<string>;
  listed: Set<string>;
  /** A movie the site already has details for (watched, or on the watchlist). */
  known: (key: string) => Movie | undefined;
  onAddToWatchlist: (movie: Movie) => void;
  onLogWatch: (movie: Movie, play: Play) => void;
  onOpen: (key: string, tab: 'watched' | 'watchlist') => void;
  onClose: () => void;
}

/** Search TMDB and add a movie to the watchlist, or log that you watched it. */
export function AddMovieDialog({ purpose, watched, listed, known, onAddToWatchlist, onLogWatch, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Movie | null>(null);
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

  const choose = async (r: SearchResult) => {
    setBusy(r.tmdb);
    try {
      const key = String(r.tmdb);
      const movie = known(key) ?? (await fetchMovieDetails(r.tmdb, purpose === 'watched' ? 'logged' : 'watchlist'));
      if (purpose === 'watchlist') onAddToWatchlist(movie);
      else setPicked(movie);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const action = (r: SearchResult) => {
    const key = String(r.tmdb);
    if (purpose === 'watchlist') {
      if (watched.has(key)) return { label: 'Watched ✓', run: () => onOpen(key, 'watched') };
      if (listed.has(key)) return { label: 'On list ✓', run: () => onOpen(key, 'watchlist') };
      return { label: '+ Add', primary: true, run: () => choose(r) };
    }
    return { label: watched.has(key) ? 'Watched again' : 'Watched it', primary: true, run: () => choose(r) };
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal add-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={purpose === 'watched' ? 'Log a watched movie' : 'Add to watchlist'}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-content">
          <h2>{purpose === 'watched' ? 'I watched…' : 'Add to watchlist'}</h2>

          {picked ? (
            <>
              <div className="picked">
                {tmdbImage(picked.poster, 'w92') && <img src={tmdbImage(picked.poster, 'w92')!} alt="" />}
                <strong>
                  {picked.title} <span className="muted">({picked.year})</span>
                </strong>
              </div>
              {watched.has(picked.key) && <p className="muted small">Already in Watched — this adds another watch.</p>}
              <WatchDatePicker
                movie={picked}
                confirmLabel="Add to Watched"
                onConfirm={(play) => onLogWatch(picked, play)}
                onCancel={() => setPicked(null)}
              />
            </>
          ) : (
            <>
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
                  const poster = tmdbImage(r.poster, 'w92');
                  const a = action(r);
                  return (
                    <li key={r.tmdb}>
                      {poster ? <img src={poster} alt="" /> : <span className="no-photo small-poster" />}
                      <div className="search-text">
                        <strong>
                          {r.title} {r.year && <span className="muted">({r.year})</span>}
                        </strong>
                        <span className="muted small">{r.overview}</span>
                      </div>
                      <button type="button" className={`btn ${a.primary ? 'primary' : ''}`} disabled={busy !== null} onClick={a.run}>
                        {busy === r.tmdb ? '…' : a.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
