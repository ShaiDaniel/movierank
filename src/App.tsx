import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterPanel } from './components/FilterPanel';
import { MovieCard } from './components/MovieCard';
import { MovieModal } from './components/MovieModal';
import { RateMode } from './components/RateMode';
import { SITE } from './config';
import { ADMIN, isEmptyRating, loadCatalog, loadRatings, onSaveStatus, saveRating, type SaveStatus } from './data';
import { DEFAULT_FILTERS, PRESETS, activeFilterCount, applyFilters, parseFilters, serializeFilters, type Filters } from './filters';
import type { Movie, Rating, Ratings } from './types';

const PAGE = 120;

export function App() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [ratings, setRatings] = useState<Ratings>({});
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => parseFilters(location.search));
  const [openKey, setOpenKey] = useState<string | null>(() => new URLSearchParams(location.search).get('m'));
  const [rateMode, setRateMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'saved', pending: 0 });

  useEffect(() => (ADMIN ? onSaveStatus(setSaveStatus) : undefined), []);

  useEffect(() => {
    Promise.all([loadCatalog(), loadRatings()])
      .then(([m, r]) => {
        setMovies(m);
        setRatings(r);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  // Keep the URL in sync so a filtered view (or an open movie) can be shared as a link.
  useEffect(() => {
    const params = serializeFilters(filters);
    if (openKey) params.set('m', openKey);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }, [filters, openKey]);

  const results = useMemo(() => (movies ? applyFilters(movies, ratings, filters) : []), [movies, ratings, filters]);
  useEffect(() => setVisible(PAGE), [filters]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setVisible((v) => v + PAGE), {
      rootMargin: '800px',
    });
    io.observe(el);
    return () => io.disconnect();
    // Re-observing after each page lets the observer fire again while the sentinel is still on screen.
  }, [movies, visible, results]);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));

  // Accepts an updater so quick successive keystrokes in rate mode build on each other.
  const rate = useCallback((key: string, update: Rating | ((prev: Rating) => Rating)) => {
    setRatings((all) => {
      const rating = typeof update === 'function' ? update(all[key] ?? {}) : update;
      saveRating(key, rating); // debounced, so StrictMode calling this updater twice is harmless
      const next = { ...all };
      if (isEmptyRating(rating)) delete next[key];
      else next[key] = rating;
      return next;
    });
  }, []);

  const open = movies?.find((m) => m.key === openKey);
  const step = useCallback(
    (delta: number) => {
      const i = results.findIndex((m) => m.key === openKey);
      const next = results[i + delta];
      if (next) setOpenKey(next.key);
    },
    [results, openKey],
  );
  const closeModal = useCallback(() => setOpenKey(null), []);

  const ratedCount = movies ? movies.filter((m) => ratings[m.key]?.verdict).length : 0;
  const activeCount = activeFilterCount(filters);

  if (error) return <div className="center">Something went wrong: {error}</div>;
  if (!movies) return <div className="center muted">Loading movies…</div>;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>{SITE.title}</h1>
          <p className="muted">
            {SITE.owner}'s verdicts on {movies.length} movies · {ratedCount} ranked so far
          </p>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Search title, director, actor…"
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
        />
        {ADMIN && (
          <button type="button" className="btn primary" onClick={() => setRateMode(true)}>
            Rate mode <span className="count">{movies.length - ratedCount} left</span>
          </button>
        )}
        {ADMIN && (
          <span className={`save-status ${saveStatus.state}`}>
            {saveStatus.state === 'saved' ? '✓ Saved' : saveStatus.state === 'saving' ? 'Saving…' : '⚠ Not saved'}
          </span>
        )}
      </header>

      {ADMIN && saveStatus.state === 'failed' && (
        <div className="save-warning" role="alert">
          ⚠ {saveStatus.pending} rating{saveStatus.pending === 1 ? '' : 's'} not saved to disk — the dev server isn't reachable.
          They're kept in this browser and will save automatically once <code>npm run dev</code> is running again.
        </div>
      )}

      <nav className="presets" aria-label="Quick picks">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="chip" onClick={() => setFilters({ ...DEFAULT_FILTERS, ...p.filters })}>
            {p.label}
          </button>
        ))}
      </nav>

      <div className="layout">
        <aside className={`sidebar ${filtersOpen ? 'open' : ''}`}>
          <div className="sidebar-head">
            <strong>Filters</strong>
            {activeCount > 0 && (
              <button type="button" className="link" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
                Clear all
              </button>
            )}
            <button type="button" className="btn sidebar-close" onClick={() => setFiltersOpen(false)}>
              Show {results.length} movies
            </button>
          </div>
          <FilterPanel movies={movies} ratings={ratings} filters={filters} onChange={patch} />
        </aside>

        <main>
          <div className="results-bar">
            <button type="button" className="btn filters-toggle" onClick={() => setFiltersOpen(true)}>
              Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
            <span className="muted">
              {results.length === movies.length ? `${results.length} movies` : `${results.length} of ${movies.length} movies`}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="empty">
              <p>No movies match these filters.</p>
              <button type="button" className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid">
              {results.slice(0, visible).map((m) => (
                <MovieCard key={m.key} movie={m} rating={ratings[m.key]} onOpen={() => setOpenKey(m.key)} />
              ))}
            </div>
          )}
          <div ref={sentinel} />
        </main>
      </div>

      <footer className="footer">
        This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by JustWatch.
      </footer>

      {open && (
        <MovieModal
          movie={open}
          rating={ratings[open.key]}
          movies={movies}
          ratings={ratings}
          onRate={(r) => rate(open.key, r)}
          onClose={closeModal}
          onStep={step}
          onPerson={(code) => {
            setOpenKey(null);
            // "Show me this person's movies": start fresh rather than stacking on current filters.
            setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort, people: [code] }));
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {ADMIN && rateMode && <RateMode movies={movies} ratings={ratings} onRate={rate} onClose={() => setRateMode(false)} />}
    </div>
  );
}
