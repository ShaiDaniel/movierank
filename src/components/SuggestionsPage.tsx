import { useEffect, useRef, useState } from 'react';
import { SITE, VERDICT_BY_ID, tmdbImage } from '../config';
import {
  addSuggestion,
  deleteSuggestion,
  publicSearchEnabled,
  searchTmdbPublic,
  setSuggestionStatus,
  signIn,
  suggestionThread,
  type Suggestion,
  type SuggestionKind,
} from '../suggestions';
import { useSocial } from '../social';
import type { Ratings, SearchResult } from '../types';
import { AccountButton, Comments } from './SocialBits';

interface Props {
  watched: Set<string>;
  listed: Set<string>;
  ratings: Ratings;
  onOpen: (key: string, tab: 'watched' | 'watchlist') => void;
}

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const LISTS: { kind: SuggestionKind; label: string; intro: string; empty: string }[] = [
  {
    kind: 'watch',
    label: 'Suggested movies',
    intro: `Movies co-workers think ${SITE.owner} should see. Vote to push the best ones up.`,
    empty: 'No suggestions yet. Be the first!',
  },
  {
    kind: 'rewatch',
    label: 'Challenges',
    intro: `Verdicts co-workers disagree with: “watch it again!”. Challenge one from the movie's page; vote on the others.`,
    empty: 'No challenges yet. Disagree with a verdict? Open the movie and challenge it.',
  },
];

/**
 * Co-workers' suggestions and challenges: two separate lists, each sorted by votes.
 * They live only here; accepting one marks it and never changes the watchlist.
 */
export function SuggestionsPage({ watched, listed, ratings, onOpen }: Props) {
  const { suggestions: all, viewer, reload, scoreOf, myVote, vote, votes } = useSocial();
  const [kind, setKind] = useState<SuggestionKind>('watch');
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = LISTS.find((l) => l.kind === kind)!;

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

  const byVotes = (a: Suggestion, b: Suggestion) =>
    scoreOf(b.id) - scoreOf(a.id) || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  const ofKind = all.filter((s) => s.kind === kind);
  const open = ofKind.filter((s) => s.status === 'pending').sort(byVotes);
  const decided = ofKind.filter((s) => s.status !== 'pending').sort(byVotes);
  const owner = viewer?.isOwner;

  const voteBox = (s: Suggestion) => {
    const mine = myVote(s.id);
    const voters = votes[s.id] ?? [];
    const names = (v: 1 | -1) =>
      voters
        .filter((x) => x.value === v)
        .map((x) => x.userName)
        .join(', ');
    const press = (v: 1 | -1) => (viewer ? vote(s.id, v) : signIn().catch((e) => setError(String(e.message ?? e))));
    const score = scoreOf(s.id);
    const ups = voters.filter((x) => x.value === 1).length;
    const downs = voters.length - ups;
    return (
      <div className="vote-box">
        <button
          type="button"
          className={`vote up ${mine === 1 ? 'on' : ''}`}
          aria-label="Vote up"
          aria-pressed={mine === 1}
          title={names(1) ? `Up: ${names(1)}` : viewer ? 'Vote up' : 'Sign in to vote'}
          onClick={() => press(1)}
        >
          ▲
        </button>
        <span className="vote-score" title={`${ups} up · ${downs} down`}>
          {score > 0 ? `+${score}` : score}
        </span>
        <button
          type="button"
          className={`vote down ${mine === -1 ? 'on' : ''}`}
          aria-label="Vote down"
          aria-pressed={mine === -1}
          title={names(-1) ? `Down: ${names(-1)}` : viewer ? 'Vote down' : 'Sign in to vote'}
          onClick={() => press(-1)}
        >
          ▼
        </button>
      </div>
    );
  };

  const item = (s: Suggestion) => {
    const key = String(s.tmdb);
    const mine = viewer?.uid === s.userId;
    const rewatch = s.kind === 'rewatch';
    return (
      <li key={s.id} className={`suggestion ${s.status}`}>
        {voteBox(s)}
        {s.poster ? <img src={tmdbImage(s.poster, 'w92')!} alt="" loading="lazy" /> : <span className="no-photo small-poster" />}
        <div className="suggestion-text">
          <strong>
            {s.title} {s.year && <span className="muted">({s.year})</span>}
          </strong>
          {rewatch && (
            <span className="small">
              {SITE.owner}'s verdict: <b>{ratings[key]?.verdict ? VERDICT_BY_ID[ratings[key].verdict!].label : 'not ranked'}</b>
              {s.proposedVerdict && (
                <>
                  {' '}
                  · {s.userName.split(' ')[0]} says: <b>{VERDICT_BY_ID[s.proposedVerdict].label}</b>
                </>
              )}
            </span>
          )}
          <span className="suggester">
            {s.userPhoto && <img src={s.userPhoto} alt="" referrerPolicy="no-referrer" />}
            {s.userName} · {fmt(s.createdAt)}
          </span>
          {s.note && <p className="note">“{s.note}”</p>}
          {s.status !== 'pending' && (
            <span className={`status-tag ${s.status}`}>
              {s.status === 'accepted'
                ? `✓ ${SITE.owner} will ${rewatch ? 'rewatch' : 'watch'} it`
                : rewatch
                  ? `${SITE.owner} stands by the verdict`
                  : 'Not for me'}{' '}
              {s.decidedAt && `· ${fmt(s.decidedAt)}`}
            </span>
          )}
          {(rewatch || watched.has(key)) && (
            <button type="button" className="link small" onClick={() => onOpen(key, 'watched')}>
              {rewatch ? 'See the movie and verdict' : `${SITE.owner} has seen it — see the verdict`}
            </button>
          )}
          {!rewatch && !watched.has(key) && listed.has(key) && (
            <span className="muted small">Already on {SITE.owner}'s watchlist</span>
          )}
          <Comments thread={suggestionThread(s.id)} />
        </div>
        <div className="suggestion-actions">
          {owner && s.status === 'pending' && (
            <>
              <button type="button" className="btn primary" disabled={busy !== null} onClick={() => run(s.id, () => setSuggestionStatus(s.id, 'accepted'))}>
                {busy === s.id ? '…' : rewatch ? 'Will rewatch' : "I'll watch it"}
              </button>
              <button type="button" className="btn" disabled={busy !== null} onClick={() => run(s.id, () => setSuggestionStatus(s.id, 'dismissed'))}>
                {rewatch ? 'Stand by it' : 'Not for me'}
              </button>
            </>
          )}
          {owner && s.status !== 'pending' && (
            <>
              <button type="button" className="link small" disabled={busy !== null} onClick={() => run(s.id, () => setSuggestionStatus(s.id, 'pending'))}>
                Undo
              </button>
              <button type="button" className="link small" disabled={busy !== null} onClick={() => run(s.id, () => deleteSuggestion(s.id))}>
                Delete
              </button>
            </>
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
      <nav className="segmented" aria-label="Lists">
        {LISTS.map((l) => {
          const count = all.filter((s) => s.kind === l.kind && s.status === 'pending').length;
          return (
            <button key={l.kind} type="button" className={kind === l.kind ? 'active' : ''} onClick={() => setKind(l.kind)}>
              {l.kind === 'rewatch' && '⚔ '}
              {l.label} {count > 0 && <span className="count">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="suggestions-bar">
        <p className="muted">{list.intro}</p>
        {viewer ? (
          <>
            <AccountButton />
            {!owner && kind === 'watch' && (
              <button type="button" className="btn primary" onClick={() => setSuggesting(true)} disabled={!publicSearchEnabled}>
                + Suggest a movie
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn primary" onClick={() => signIn().catch((e) => setError(String(e.message ?? e)))}>
            Sign in with Google
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {open.length ? <ul className="suggestion-list">{open.map(item)}</ul> : <p className="muted">{list.empty}</p>}

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
          pending={new Set(all.filter((s) => s.kind === 'watch' && s.status === 'pending').map((s) => String(s.tmdb)))}
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
