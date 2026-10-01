import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddMovieDialog, type AddPurpose } from './components/AddMovieDialog';
import { FilterPanel } from './components/FilterPanel';
import { MovieCard } from './components/MovieCard';
import { MovieModal } from './components/MovieModal';
import { RateMode } from './components/RateMode';
import { SITE } from './config';
import { UnlockDialog } from './components/UnlockDialog';
import {
  autoUnlock,
  editMode,
  fetchMovieDetails,
  isEmptyRating,
  loadAll,
  lock,
  onSaveStatus,
  saveNow,
  saveRating,
  saveWatch,
  saveWatchlistEntry,
  type EditMode,
  type SaveStatus,
} from './data';
import { EditContext } from './edit';
import { DEFAULT_FILTERS, PRESETS, activeFilterCount, applyFilters, parseFilters, serializeFilters, type Filters } from './filters';
import type { Movie, Play, Rating, Ratings, Watches, Watchlist, WatchlistEntry } from './types';
import { mergeWatched } from './watches';

const PAGE = 120;
type Tab = 'watched' | 'watchlist';

export function App() {
  const [traktMovies, setTraktMovies] = useState<Movie[] | null>(null);
  const [watches, setWatches] = useState<Watches>({});
  const [loggedMovies, setLoggedMovies] = useState<Movie[]>([]);
  const [ratings, setRatings] = useState<Ratings>({});
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') === 'watchlist' ? 'watchlist' : 'watched'));
  const [filters, setFilters] = useState<Filters>(() => parseFilters(location.search));
  const [openKey, setOpenKey] = useState<string | null>(() => new URLSearchParams(location.search).get('m'));
  const [rateMode, setRateMode] = useState(false);
  const [adding, setAdding] = useState<AddPurpose | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'saved', pending: 0 });
  // A remembered device unlocks straight away.
  const [mode, setMode] = useState<EditMode>(() => (autoUnlock(), editMode()));
  const [unlocking, setUnlocking] = useState(false);
  const ADMIN = mode !== null;

  useEffect(() => onSaveStatus(setSaveStatus), []);

  // Reloads when editing is unlocked, to edit the latest data in the repo rather than the last deploy.
  useEffect(() => {
    loadAll()
      .then((d) => {
        setTraktMovies(d.movies);
        setWatches(d.watches);
        setLoggedMovies(d.loggedMovies);
        setRatings(d.ratings);
        setWatchlistMovies(d.watchlistMovies);
        setWatchlist(d.watchlist);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [mode]);

  // Keep the URL in sync so a filtered view (or an open movie) can be shared as a link.
  useEffect(() => {
    const params = serializeFilters(filters);
    if (tab === 'watchlist') params.set('tab', 'watchlist');
    if (openKey) params.set('m', openKey);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }, [filters, openKey, tab]);

  // Watched = Trakt history plus watches logged on the site.
  const movies = useMemo(
    () => (traktMovies ? mergeWatched(traktMovies, [...loggedMovies, ...watchlistMovies], watches) : null),
    [traktMovies, loggedMovies, watchlistMovies, watches],
  );
  const watchedKeys = useMemo(() => new Set(movies?.map((m) => m.key)), [movies]);
  // Watched movies drop off the watchlist once they show up in the Trakt history.
  const listed = useMemo(
    () => watchlistMovies.filter((m) => watchlist[m.key] && !watchlist[m.key].removed && !watchedKeys.has(m.key)),
    [watchlistMovies, watchlist, watchedKeys],
  );

  const current = tab === 'watched' ? (movies ?? []) : listed;
  const results = useMemo(
    () => applyFilters(current, ratings, filters, tab === 'watchlist' ? watchlist : undefined),
    [current, ratings, filters, tab, watchlist],
  );
  useEffect(() => setVisible(PAGE), [filters, tab]);

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
  const switchTab = (next: Tab) => {
    setTab(next);
    setFilters(DEFAULT_FILTERS);
    setOpenKey(null);
  };

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

  const updateWatchlist = useCallback((key: string, update: (prev: WatchlistEntry) => WatchlistEntry) => {
    setWatchlist((all) => {
      const entry = update(all[key] ?? { addedAt: new Date().toISOString(), source: 'site' });
      saveWatchlistEntry(key, entry);
      return { ...all, [key]: entry };
    });
  }, []);

  const logWatch = useCallback(
    async (movie: Movie, play: Play) => {
      // Movies Trakt doesn't know need their details stored with the logged watches.
      const needsCatalog = !traktMovies?.some((m) => m.key === movie.key) && !loggedMovies.some((m) => m.key === movie.key);
      const details = needsCatalog ? await fetchMovieDetails(Number(movie.key), 'logged') : movie;
      if (needsCatalog) setLoggedMovies((all) => [...all, details]);
      setWatches((all) => {
        const prev = all[movie.key];
        const next = { title: movie.title, year: movie.year, plays: [...(prev?.plays ?? []), play], updatedAt: new Date().toISOString() };
        saveWatch(movie.key, next);
        return { ...all, [movie.key]: next };
      });
    },
    [traktMovies, loggedMovies],
  );

  const removeWatch = useCallback((key: string, at: string) => {
    setWatches((all) => {
      const prev = all[key];
      if (!prev) return all;
      const next = { ...prev, plays: prev.plays.filter((p) => p.at !== at), updatedAt: new Date().toISOString() };
      saveWatch(key, next);
      const copy = { ...all };
      if (next.plays.length) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  }, []);

  const addToWatchlist = (movie: Movie) => {
    setWatchlistMovies((all) => (all.some((m) => m.key === movie.key) ? all : [...all, movie]));
    updateWatchlist(movie.key, (prev) => ({
      ...prev,
      // Re-adding a removed movie starts it fresh on the list.
      ...(prev.removed ? { addedAt: new Date().toISOString(), source: 'site' as const } : {}),
      removed: undefined,
      title: movie.title,
      year: movie.year,
      updatedAt: new Date().toISOString(),
    }));
    setAdding(null);
    setTab('watchlist');
    setOpenKey(movie.key); // straight to the movie page to set priority and why
  };

  const open = current.find((m) => m.key === openKey);
  const step = useCallback(
    (delta: number) => {
      const i = results.findIndex((m) => m.key === openKey);
      const next = results[i + delta];
      if (next) setOpenKey(next.key);
    },
    [results, openKey],
  );
  const closeModal = useCallback(() => setOpenKey(null), []);
  // E.g. a movie just removed from the watchlist: drop it from the URL too.
  useEffect(() => {
    if (movies && openKey && !open) setOpenKey(null);
  }, [movies, openKey, open]);

  const ratedCount = movies ? movies.filter((m) => ratings[m.key]?.verdict).length : 0;
  const activeCount = activeFilterCount(filters);

  if (error) return <div className="center">Something went wrong: {error}</div>;
  if (!movies) return <div className="center muted">Loading movies…</div>;

  return (
    <EditContext.Provider value={mode}>
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
          <>
            <button type="button" className="btn" onClick={() => setAdding('watched')}>
              + Watched
            </button>
            <button type="button" className="btn" onClick={() => setAdding('watchlist')}>
              + Watchlist
            </button>
          </>
        )}
        {ADMIN && (
          <button type="button" className="btn primary" onClick={() => setRateMode(true)}>
            Rate mode <span className="count">{movies.length - ratedCount} left</span>
          </button>
        )}
        {ADMIN && (
          <span className={`save-status ${saveStatus.state}`}>
            {saveStatus.state === 'saved' ? '✓ Saved' : saveStatus.state === 'saving' ? 'Saving…' : '⚠ Not saved'}
            {mode === 'github' && saveStatus.state === 'saving' && (
              <button type="button" className="link" onClick={() => saveNow()}>
                {' '}
                save now
              </button>
            )}
          </span>
        )}
        {mode === 'github' && (
          <button
            type="button"
            className="btn"
            disabled={saveStatus.pending > 0}
            title={saveStatus.pending ? 'Wait for changes to save first' : 'Stop editing on this device'}
            onClick={() => {
              lock();
              setMode(null);
            }}
          >
            Lock
          </button>
        )}
        {!ADMIN && (
          <button type="button" className="btn edit-btn" onClick={() => setUnlocking(true)}>
            ✎ Edit
          </button>
        )}
      </header>

      {ADMIN && saveStatus.state === 'failed' && (
        <div className="save-warning" role="alert">
          ⚠ {saveStatus.pending} change{saveStatus.pending === 1 ? '' : 's'} not saved yet. {saveStatus.message} They're kept in
          this browser and will save automatically.
        </div>
      )}

      <nav className="tabs" aria-label="Lists">
        <button type="button" className={`tab ${tab === 'watched' ? 'active' : ''}`} onClick={() => switchTab('watched')}>
          Watched <span className="count">{movies.length}</span>
        </button>
        <button type="button" className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => switchTab('watchlist')}>
          Watchlist <span className="count">{listed.length}</span>
        </button>
      </nav>

      {tab === 'watched' && (
        <nav className="presets" aria-label="Quick picks">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" onClick={() => setFilters({ ...DEFAULT_FILTERS, ...p.filters })}>
              {p.label}
            </button>
          ))}
        </nav>
      )}

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
          <FilterPanel movies={current} ratings={ratings} filters={filters} onChange={patch} mode={tab} />
        </aside>

        <main>
          <div className="results-bar">
            <button type="button" className="btn filters-toggle" onClick={() => setFiltersOpen(true)}>
              Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
            <span className="muted">
              {results.length === current.length ? `${results.length} movies` : `${results.length} of ${current.length} movies`}
              {tab === 'watchlist' && ` ${SITE.owner} plans to watch`}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="empty">
              <p>{current.length ? 'No movies match these filters.' : 'The watchlist is empty.'}</p>
              {current.length > 0 && (
                <button type="button" className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid">
              {results.slice(0, visible).map((m) => (
                <MovieCard
                  key={m.key}
                  movie={m}
                  rating={tab === 'watched' ? ratings[m.key] : undefined}
                  entry={tab === 'watchlist' ? watchlist[m.key] : undefined}
                  onOpen={() => setOpenKey(m.key)}
                />
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
          entry={tab === 'watchlist' ? watchlist[open.key] : undefined}
          onWatchlistChange={(update) => updateWatchlist(open.key, update)}
          watch={watches[open.key]}
          onLogWatch={async (play) => {
            await logWatch(open, play);
            // Seen it on the watchlist: it's now in Watched, so show it there.
            if (tab === 'watchlist') {
              setTab('watched');
              setFilters(DEFAULT_FILTERS);
            }
          }}
          onRemoveWatch={(at) => removeWatch(open.key, at)}
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

      {ADMIN && adding && (
        <AddMovieDialog
          purpose={adding}
          watched={watchedKeys}
          listed={new Set(listed.map((m) => m.key))}
          known={(key) => movies.find((m) => m.key === key)}
          onAddToWatchlist={addToWatchlist}
          onLogWatch={async (movie, play) => {
            await logWatch(movie, play);
            setAdding(null);
            if (tab !== 'watched') switchTab('watched');
            setOpenKey(movie.key); // straight to it, ready to rate
          }}
          onOpen={(key, target) => {
            setAdding(null);
            if (target !== tab) switchTab(target);
            setOpenKey(key);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {ADMIN && rateMode && <RateMode movies={movies} ratings={ratings} onRate={rate} onClose={() => setRateMode(false)} />}

      {unlocking && (
        <UnlockDialog
          onUnlocked={() => {
            setUnlocking(false);
            setMode(editMode());
          }}
          onClose={() => setUnlocking(false)}
        />
      )}
    </div>
    </EditContext.Provider>
  );
}
