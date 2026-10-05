import { useEffect, useRef, useState } from 'react';
import { SITE, tmdbImage } from '../config';
import { useEditMode } from '../edit';
import {
  addSuggestion,
  deleteSuggestion,
  publicSearchEnabled,
  searchTmdbPublic,
  setSuggestionStatus,
  signIn,
  signOut,
  type Suggestion,
  type Viewer,
} from '../suggestions';
import type { SearchResult } from '../types';

interface Props {
  suggestions: Suggestion[];
  viewer: Viewer | null;
  watched: Set<string>;
  listed: Set<string>;
  reload: () => Promise<void>;
  /** Adds the movie to the watchlist (needs edit mode). */
  onAccept: (s: Suggestion) => Promise<void>;
  onOpen: (key: string, tab: 'watched' | 'watchlist') => void;
}

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function SuggestionsPage({ suggestions, viewer, watched, listed, reload, onAccept, onOpen }: Props) {
  const editing = useEditMode() !== null;
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const pending = suggestions.filter((s) => s.status === 'pending');
  const decided = suggestions.filter((s) => s.status !== 'pending');
  const owner = viewer?.isOwner;

  const item = (s: Suggestion) => {
    const key = String(s.tmdb);
    const mine = viewer?.uid === s.userId;
    return (
      <li key={s.id} className={`suggestion ${s.status}`}>
        {s.poster ? <img src={tmdbImage(s.poster, 'w92')!} alt="" loading="lazy" /> : <span className="no-photo small-poster" />}
        <div className="suggestion-text">
          <strong>
            {s.title} {s.year && <span className="muted">({s.year})</span>}
          </strong>
          <span className="suggester">
            {s.userPhoto && <img src={s.userPhoto} alt="" referrerPolicy="no-referrer" />}
            {s.userName} · {fmt(s.createdAt)}
          </span>
          {s.note && <p className="note">“{s.note}”</p>}
          {s.status !== 'pending' && (
            <span className={`status-tag ${s.status}`}>
              {s.status === 'accepted' ? '✓ Added to the watchlist' : 'Not for me'} {s.decidedAt && `· ${fmt(s.decidedAt)}`}
            </span>
          )}
          {watched.has(key) && (
            <button type="button" className="link small" onClick={() => onOpen(key, 'watched')}>
              {SITE.owner} has seen it — see the verdict
            </button>
          )}
          {!watched.has(key) && listed.has(key) && s.status !== 'accepted' && <span className="muted small">Already on the watchlist</span>}
        </div>
        <div className="suggestion-actions">
          {owner && s.status === 'pending' && (
            <>
              <button
                type="button"
                className="btn primary"
                disabled={!editing || busy !== null}
                title={editing ? 'Add to my watchlist' : 'Unlock editing (✎ Edit) to add to the watchlist'}
                onClick={() => run(s.id, async () => {
                  await onAccept(s);
                  await setSuggestionStatus(s.id, 'accepted');
                })}
              >
                {busy === s.id ? '…' : 'Accept'}
              </button>
              <button type="button" className="btn" disabled={busy !== null} onClick={() => run(s.id, () => setSuggestionStatus(s.id, 'dismissed'))}>
                Dismiss
              </button>
            </>
          )}
          {owner && s.status !== 'pending' && (
            <button type="button" className="link small" disabled={busy !== null} onClick={() => run(s.id, () => deleteSuggestion(s.id))}>
              Delete
            </button>
          )}
          {!owner && mine && s.status === 'pending' && (
            <button type="button" className="link small" disabled={busy !== null} onClick={() => run(s.id, () => deleteSuggestion(s.id))}>
              Withdraw
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="suggestions-page">
      <div className="suggestions-bar">
        <p className="muted">Know a movie {SITE.owner} should see? Sign in with Google and suggest it.</p>
        {viewer ? (
          <>
            <span className="viewer">
              {viewer.photo && <img src={viewer.photo} alt="" referrerPolicy="no-referrer" />}
              {viewer.name}
              {owner && <span className="count">owner</span>}
            </span>
            <button type="button" className="btn primary" onClick={() => setSuggesting(true)} disabled={!publicSearchEnabled}>
              + Suggest a movie
            </button>
            <button type="button" className="link small" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="btn primary" onClick={() => signIn().catch((e) => setError(String(e.message ?? e)))}>
            Sign in with Google
          </button>
        )}
      </div>
      {owner && !editing && pending.length > 0 && (
        <p className="chart-note">To accept suggestions, also unlock editing with ✎ Edit (accepting adds the movie to your watchlist).</p>
      )}
      {error && <p className="error">{error}</p>}

      <h2>Waiting for {SITE.owner} {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
      {pending.length ? <ul className="suggestion-list">{pending.map(item)}</ul> : <p className="muted">No open suggestions right now.</p>}

      {decided.length > 0 && (
        <>
          <h2>Decided</h2>
          <ul className="suggestion-list">{decided.map(item)}</ul>
        </>
      )}

      {suggesting && viewer && (
        <SuggestDialog
          watched={watched}
          listed={listed}
          pending={new Set(pending.map((s) => String(s.tmdb)))}
          onClose={() => setSuggesting(false)}
          onSubmit={async (movie, note) => {
            await addSuggestion(movie, note);
            setSuggesting(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function SuggestDialog({
  watched,
  listed,
  pending,
  onSubmit,
  onClose,
}: {
  watched: Set<string>;
  listed: Set<string>;
  pending: Set<string>;
  onSubmit: (movie: SearchResult, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setResults([]);
    const t = setTimeout(() => {
      searchTmdbPublic(q)
        .then(setResults)
        .catch((e) => setError(String(e.message ?? e)));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const blocked = (key: string) =>
    watched.has(key) ? `${SITE.owner} has seen it` : listed.has(key) ? 'Already on the watchlist' : pending.has(key) ? 'Already suggested' : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal add-dialog" role="dialog" aria-modal="true" aria-label="Suggest a movie" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-content">
          <h2>Suggest a movie</h2>
          {picked ? (
            <>
              <div className="picked">
                {picked.poster && <img src={tmdbImage(picked.poster, 'w92')!} alt="" />}
                <strong>
                  {picked.title} {picked.year && <span className="muted">({picked.year})</span>}
                </strong>
              </div>
              <textarea
                className="review-input"
                rows={4}
                maxLength={500}
                placeholder={`Why should ${SITE.owner} watch it? (optional)`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {error && <p className="error">{error}</p>}
              <div className="watch-picker-actions">
                <button type="button" className="btn" onClick={() => setPicked(null)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onSubmit(picked, note);
                    } catch (e) {
                      setError(String((e as Error).message ?? e));
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Sending…' : 'Suggest'}
                </button>
              </div>
            </>
          ) : (
            <>
              <input ref={input} type="search" placeholder="Search for a movie…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {error && <p className="error">{error}</p>}
              <ul className="search-results">
                {results.map((r) => {
                  const why = blocked(String(r.tmdb));
                  return (
                    <li key={r.tmdb}>
                      {r.poster ? <img src={tmdbImage(r.poster, 'w92')!} alt="" /> : <span className="no-photo small-poster" />}
                      <div className="search-text">
                        <strong>
                          {r.title} {r.year && <span className="muted">({r.year})</span>}
                        </strong>
                        <span className="muted small">{r.overview}</span>
                      </div>
                      {why ? (
                        <span className="muted small">{why}</span>
                      ) : (
                        <button type="button" className="btn primary" onClick={() => setPicked(r)}>
                          Choose
                        </button>
                      )}
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
