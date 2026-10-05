import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddMovieDialog, type AddPurpose } from './components/AddMovieDialog';
import { FeaturedHero } from './components/FeaturedHero';
import { FilterPanel } from './components/FilterPanel';
import { MovieCard } from './components/MovieCard';
import { MovieModal } from './components/MovieModal';
import { RateMode } from './components/RateMode';
import { RecentPage } from './components/RecentPage';
import { StatsPage } from './components/StatsPage';
import { SuggestionsPage } from './components/SuggestionsPage';
import { AboutPage } from './components/AboutPage';
import { MyListPage } from './components/MyListPage';
import { AccountButton } from './components/SocialBits';
import { useSocial } from './social';
import { loadOwnerCreds } from './suggestions';
import { SITE, tmdbImage } from './config';
import { OwnerSetup } from './components/OwnerSetup';
import {
  disableGithubEditing,
  editMode,
  enableGithubEditing,
  fetchMovieDetails,
  isEmptyRating,
  loadAll,
  onSaveStatus,
  saveNow,
  saveRating,
  saveWatch,
  saveWatchlistEntry,
  type EditMode,
  type SaveStatus,
} from './data';
import { EditContext } from './edit';
import { DEFAULT_FILTERS, activeFilterCount, applyFilters, parseFilters, serializeFilters, type Filters } from './filters';
import type { Movie, Play, Rating, Ratings, Watches, Watchlist, WatchlistEntry } from './types';
import { mergeWatched } from './watches';

const PAGE = 120;
type Tab = 'watched' | 'recent' | 'watchlist' | 'suggestions' | 'mylist' | 'stats' | 'about';
const TABS: Tab[] = ['watched', 'recent', 'watchlist', 'suggestions', 'mylist', 'stats', 'about'];

export function App() {
  const [traktMovies, setTraktMovies] = useState<Movie[] | null>(null);
  const [shows, setShows] = useState<Movie[]>([]);
  // Movies or TV: one switch for the whole site, kept in the URL (?k=tv).
  const [media, setMedia] = useState<'movies' | 'tv'>(() => (new URLSearchParams(location.search).get('k') === 'tv' ? 'tv' : 'movies'));
  const isTv = media === 'tv';
  const [watches, setWatches] = useState<Watches>({});
  const [loggedMovies, setLoggedMovies] = useState<Movie[]>([]);
  const [ratings, setRatings] = useState<Ratings>({});
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(location.search).get('tab') as Tab;
    return TABS.includes(t) ? t : 'watched';
  });
  const [filters, setFilters] = useState<Filters>(() => parseFilters(location.search));
  const [openKey, setOpenKey] = useState<string | null>(() => new URLSearchParams(location.search).get('m'));
  const [rateMode, setRateMode] = useState(false);
  const [adding, setAdding] = useState<AddPurpose | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [heroBackdrop, setHeroBackdrop] = useState<string | null>(null);
  const [trailerFor, setTrailerFor] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'saved', pending: 0 });
  // A remembered device unlocks straight away.
  // 'local' on the dev server; on the public site, editing turns on when the owner signs in.
  const [mode, setMode] = useState<EditMode>(() => editMode());
  const [ownerSetup, setOwnerSetup] = useState<'missing' | 'rejected' | null>(null);
  const ADMIN = mode !== null;
  const social = useSocial();
  const pendingSuggestions = social.suggestions.filter((x) => x.status === 'pending').length;
  const isOwner = Boolean(social.viewer?.isOwner);

  useEffect(() => {
    if (import.meta.env.DEV) return; // the dev server edits local files instead
    if (!isOwner) {
      disableGithubEditing();
      setMode(editMode());
      return;
    }
    let cancelled = false;
    loadOwnerCreds()
      .then((creds) => {
        if (cancelled) return;
        if (!creds) return setOwnerSetup('missing');
        enableGithubEditing(creds);
        setMode(editMode());
      })
      .catch((e) => console.error('Loading editing credentials failed', e));
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  // A save GitHub refuses means the stored token expired or was revoked: ask for a new one.
  useEffect(() => {
    if (isOwner && saveStatus.state === 'failed' && saveStatus.message?.includes('token')) setOwnerSetup('rejected');
  }, [isOwner, saveStatus]);


  useEffect(() => onSaveStatus(setSaveStatus), []);

  // Reloads when editing is unlocked, to edit the latest data in the repo rather than the last deploy.
  useEffect(() => {
    let stale = false;
    loadAll()
      .then((d) => {
        if (stale) return;
        setTraktMovies(d.movies);
        setShows(d.shows);
        setWatches(d.watches);
        setLoggedMovies(d.loggedMovies);
        setRatings(d.ratings);
        setWatchlistMovies(d.watchlistMovies);
        setWatchlist(d.watchlist);
      })
      .catch((e) => !stale && setError(String(e.message ?? e)));
    return () => {
      stale = true;
    };
  }, [mode]);

  // Keep the URL in sync so a filtered view (or an open movie) can be shared as a link.
  useEffect(() => {
    const params = serializeFilters(filters);
    if (isTv) params.set('k', 'tv');
    if (tab !== 'watched') params.set('tab', tab);
    if (openKey) params.set('m', openKey);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }, [filters, openKey, tab, isTv]);

  // Watched = Trakt history plus watches logged on the site.
  const movies = useMemo(
    () => (traktMovies ? mergeWatched(traktMovies, [...loggedMovies, ...watchlistMovies], watches) : null),
    [traktMovies, loggedMovies, watchlistMovies, watches],
  );
  const watchedKeys = useMemo(() => new Set(movies?.map((m) => m.key)), [movies]);
  // Watched movies drop off the watchlist once they show up in the Trakt history.
  // Watched movies drop off the watchlist once they show up in the history.
  const listed = useMemo(
    () => watchlistMovies.filter((m) => watchlist[m.key] && !watchlist[m.key].removed && !watchedKeys.has(m.key)),
    [watchlistMovies, watchlist, watchedKeys],
  );

  // Recent and Stats open movies from the Watched list.
  // What the grid, Recent and Rate mode work on.
  const catalog = isTv ? shows : (movies ?? []);
  const current = !isTv && tab === 'watchlist' ? listed : catalog;
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
  /** "Show me this person's movies": the Watched grid, filtered to just them. */
  const showPerson = (code: string) => {
    setOpenKey(null);
    if (tab !== 'watched' && tab !== 'watchlist') setTab('watched');
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort, people: [code] }));
    window.scrollTo({ top: 0 });
  };

  /** Tabs that exist for TV (watchlist, suggestions and stats are movies-only for now). */
  const TV_TABS: Tab[] = ['watched', 'recent', 'mylist', 'about'];
  const switchMedia = (next: 'movies' | 'tv') => {
    if (next === media) return;
    setMedia(next);
    setFilters(DEFAULT_FILTERS);
    setOpenKey(null);
    if (next === 'tv' && !TV_TABS.includes(tab)) setTab('watched');
    window.scrollTo({ top: 0 });
  };

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

  // My list can hold watched and watchlist movies, so fall back to both catalogs.
  const open =
    current.find((m) => m.key === openKey) ??
    (tab === 'mylist' ? [...watchlistMovies, ...(movies ?? []), ...shows].find((m) => m.key === openKey) : undefined);
  const step = useCallback(
    (delta: number) => {
      const i = results.findIndex((m) => m.key === openKey);
      const next = results[i + delta];
      if (next) setOpenKey(next.key);
    },
    [results, openKey],
  );
  const closeModal = useCallback(() => {
    setOpenKey(null);
    setTrailerFor(null);
  }, []);
  // E.g. a movie just removed from the watchlist: drop it from the URL too.
  useEffect(() => {
    if (movies && openKey && !open) setOpenKey(null);
  }, [movies, openKey, open]);

  const noun = isTv ? "shows" : "movies";
  const ratedCount = catalog.filter((m) => ratings[m.key]?.verdict).length;
  const activeCount = activeFilterCount(filters);
  // The page's ambient glow follows the open movie, else the featured one.
  const ambient = tmdbImage(open?.backdrop ?? (tab === 'watched' ? heroBackdrop : null), 'w780');

  if (error) return <div className="center">Something went wrong: {error}</div>;
  if (!movies) return <div className="center muted">Loading movies…</div>;

  return (
    <EditContext.Provider value={mode}>
    <div className="app">
      <div className="ambient" style={ambient ? { backgroundImage: `url(${ambient})` } : undefined} aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <h1>{SITE.title}</h1>
          <p className="muted">
            {SITE.owner}'s verdicts on {catalog.length} {isTv ? 'TV shows' : 'movies'} · {ratedCount} ranked so far
          </p>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Search title, director, actor…"
          value={filters.q}
          onChange={(e) => {
            if (tab !== 'watched' && tab !== 'watchlist') setTab('watched');
            patch({ q: e.target.value });
          }}
        />
        <nav className="segmented media-switch" aria-label="Movies or TV">
          <button type="button" className={!isTv ? 'active' : ''} onClick={() => switchMedia('movies')}>
            🎬 Movies
          </button>
          <button type="button" className={isTv ? 'active' : ''} onClick={() => switchMedia('tv')}>
            📺 TV
          </button>
        </nav>
        {ADMIN && !isTv && (
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
            Rate mode <span className="count">{catalog.length - ratedCount} left</span>
          </button>
        )}
        <AccountButton />
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
      </header>

      {ADMIN && saveStatus.state === 'failed' && (
        <div className="save-warning" role="alert">
          ⚠ {saveStatus.pending} change{saveStatus.pending === 1 ? '' : 's'} not saved yet. {saveStatus.message} They're kept in
          this browser and will save automatically.
        </div>
      )}

      <nav className="tabs" aria-label="Lists">
        <button type="button" className={`tab ${tab === 'watched' ? 'active' : ''}`} onClick={() => switchTab('watched')}>
          Watched <span className="count">{catalog.length}</span>
        </button>
        <button type="button" className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => switchTab('recent')}>
          Recent
        </button>
        {!isTv && (
          <button type="button" className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => switchTab('watchlist')}>
            {SITE.owner}'s watchlist <span className="count">{listed.length}</span>
          </button>
        )}
        {social.enabled && !isTv && (
          <button type="button" className={`tab ${tab === 'suggestions' ? 'active' : ''}`} onClick={() => switchTab('suggestions')}>
            Suggestions {pendingSuggestions > 0 && <span className="count">{pendingSuggestions}</span>}
          </button>
        )}
        {social.viewer && !social.viewer.isOwner && (
          <button type="button" className={`tab ${tab === 'mylist' ? 'active' : ''}`} onClick={() => switchTab('mylist')}>
            {social.viewer.name.split(' ')[0]}'s list <span className="count">{social.myList.length}</span>
          </button>
        )}
        {!isTv && (
          <button type="button" className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => switchTab('stats')}>
            Stats
          </button>
        )}
        <button type="button" className={`tab ${tab === 'about' ? 'active' : ''}`} onClick={() => switchTab('about')}>
          About
        </button>
      </nav>

      {tab === 'watched' && activeCount === 0 && (
        <FeaturedHero
          key={media}
          movies={catalog}
          ratings={ratings}
          onBackdrop={setHeroBackdrop}
          onOpen={(key, withTrailer) => {
            setTrailerFor(withTrailer ? key : null);
            setOpenKey(key);
          }}
        />
      )}

      {tab === 'recent' && (
        <RecentPage movies={catalog} ratings={ratings} onRate={rate} onOpen={setOpenKey} onPerson={showPerson} />
      )}
      {tab === 'suggestions' && (
        <SuggestionsPage
          watched={watchedKeys}
          listed={new Set(listed.map((m) => m.key))}
          ratings={ratings}
          onOpen={(key, target) => {
            switchTab(target);
            setOpenKey(key);
          }}
        />
      )}
      {tab === 'mylist' && (
        <MyListPage catalog={[...movies, ...watchlistMovies, ...shows]} ratings={ratings} onOpen={setOpenKey} />
      )}
      {tab === 'about' && <AboutPage />}
      {tab === 'stats' && (
        <StatsPage
          movies={movies}
          ratings={ratings}
          watchlist={watchlist}
          watchlistCount={listed.length}
          onOpen={setOpenKey}
          onPerson={showPerson}
        />
      )}

      {(tab === 'watched' || tab === 'watchlist') && (
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
              Show {results.length} {isTv ? "shows" : "movies"}
            </button>
          </div>
          <FilterPanel movies={current} ratings={ratings} filters={filters} onChange={patch} mode={!isTv && tab === 'watchlist' ? 'watchlist' : 'watched'} kind={isTv ? 'tv' : undefined} />
        </aside>

        <main>
          <div className="results-bar">
            <button type="button" className="btn filters-toggle" onClick={() => setFiltersOpen(true)}>
              Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
            <span className="muted">
              {results.length === current.length ? `${results.length} ${noun}` : `${results.length} of ${current.length} ${noun}`}
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
      )}

      <footer className="footer">
        This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by JustWatch.
      </footer>

      {open && (
        <MovieModal
          startWithTrailer={trailerFor === open.key}
          movie={open}
          rating={ratings[open.key]}
          movies={catalog}
          ratings={ratings}
          entry={tab === 'watchlist' || !watchedKeys.has(open.key) ? watchlist[open.key] : undefined}
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
          onPerson={showPerson}
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

      {ADMIN && rateMode && <RateMode key={media} movies={catalog} ratings={ratings} onRate={rate} onClose={() => setRateMode(false)} />}

      {ownerSetup && (
        <OwnerSetup
          reason={ownerSetup}
          onDone={(creds) => {
            setOwnerSetup(null);
            enableGithubEditing(creds);
            setMode(editMode());
          }}
          onClose={() => setOwnerSetup(null)}
        />
      )}
    </div>
    </EditContext.Provider>
  );
}
