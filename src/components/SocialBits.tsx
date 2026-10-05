// Small co-worker widgets: the account button, comment threads, "My list" toggle and
// the "challenge this verdict" panel.
import { useState, type CSSProperties } from 'react';
import { SITE, VERDICTS, VERDICT_BY_ID } from '../config';
import { addComment, addSuggestion, deleteComment, signIn, signOut } from '../suggestions';
import { useSocial } from '../social';
import type { Movie, Rating, VerdictId } from '../types';

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

export function AccountButton() {
  const { enabled, viewer } = useSocial();
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;
  if (!viewer)
    return (
      <button
        type="button"
        className="btn account-btn"
        title={error ?? 'Sign in to suggest movies, challenge verdicts and keep your own list'}
        onClick={() => signIn().catch((e) => setError(String(e.message ?? e)))}
      >
        Sign in
      </button>
    );
  return (
    <span className="account">
      {viewer.photo && <img src={viewer.photo} alt="" referrerPolicy="no-referrer" />}
      <span className="account-name">{viewer.name.split(' ')[0]}</span>
      <button type="button" className="link small" onClick={() => signOut()}>
        Sign out
      </button>
    </span>
  );
}

/** Comment thread under a suggestion or challenge. */
export function Comments({ suggestionId }: { suggestionId: string }) {
  const { viewer, comments, reload } = useSocial();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = comments[suggestionId] ?? [];

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addComment(suggestionId, text);
      setText('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="comments">
      <button type="button" className="link small" onClick={() => setOpen((o) => !o)}>
        💬 {list.length ? `${list.length} comment${list.length === 1 ? '' : 's'}` : 'Comment'}
      </button>
      {open && (
        <div className="comment-thread">
          {list.map((c) => (
            <div key={c.id} className="comment">
              {c.userPhoto && <img src={c.userPhoto} alt="" referrerPolicy="no-referrer" />}
              <div>
                <span className="comment-meta">
                  <b>{c.userName}</b> · {fmt(c.createdAt)}
                  {(viewer?.uid === c.userId || viewer?.isOwner) && (
                    <button type="button" className="link small" onClick={() => deleteComment(suggestionId, c.id).then(reload)}>
                      delete
                    </button>
                  )}
                </span>
                <p>{c.text}</p>
              </div>
            </div>
          ))}
          {viewer ? (
            <div className="comment-form">
              <input
                type="text"
                maxLength={1000}
                placeholder="Add a comment…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button type="button" className="btn" disabled={busy || !text.trim()} onClick={send}>
                Post
              </button>
            </div>
          ) : (
            <p className="muted small">Sign in to comment.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** "＋ My list" toggle for signed-in co-workers. */
export function MyListButton({ movie }: { movie: Movie }) {
  const { viewer, isOnMyList, toggleMyList } = useSocial();
  if (!viewer || viewer.isOwner) return null;
  const on = isOnMyList(movie.key);
  return (
    <button type="button" className={`btn ${on ? 'on-list' : ''}`} onClick={() => toggleMyList(movie.key, movie.title)}>
      {on ? '✓ On my list' : '＋ My list'}
    </button>
  );
}

/** "⚔ Challenge" in a ranked movie's action row, for co-workers (signs them in first if needed). */
export function ChallengeButton({ rating, onOpen }: { rating?: Rating; onOpen: () => void }) {
  const { enabled, viewer } = useSocial();
  if (!enabled || !rating?.verdict || viewer?.isOwner) return null;
  return (
    <button
      type="button"
      className="btn challenge-btn"
      title="Disagree with this verdict? Ask for a rewatch"
      onClick={() => (viewer ? onOpen() : signIn().then(onOpen).catch(() => {}))}
    >
      ⚔ Challenge
    </button>
  );
}

/** On a ranked movie's page: existing challenges, and the form opened by ChallengeButton. */
export function ChallengePanel({
  movie,
  rating,
  open,
  setOpen,
}: {
  movie: Movie;
  rating?: Rating;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { enabled, viewer, suggestions, reload } = useSocial();
  const [verdict, setVerdict] = useState<VerdictId | undefined>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!enabled || !rating?.verdict) return null;

  const challenges = suggestions.filter((s) => s.kind === 'rewatch' && String(s.tmdb) === movie.key && s.status === 'pending');
  const mine = challenges.some((s) => s.userId === viewer?.uid);

  return (
    <div className="challenge">
      {challenges.length > 0 && (
        <p className="small">
          ⚔ {challenges.length} challenge{challenges.length === 1 ? '' : 's'}:{' '}
          {challenges
            .map((c) => `${c.userName.split(' ')[0]}${c.proposedVerdict ? ` (${VERDICT_BY_ID[c.proposedVerdict].label})` : ''}`)
            .join(', ')}{' '}
          <span className="muted">— see Suggestions</span>
        </p>
      )}
      {sent && <p className="small">✓ Challenge sent. {SITE.owner} will see it in Suggestions → Challenges.</p>}
      {open && mine && !sent && <p className="small">You've already challenged this verdict — see Suggestions → Challenges.</p>}
      {open && !mine && !sent && viewer && (
        <div className="challenge-form">
          <span className="credit-label">I think it's</span>
          <div className="chips">
            {VERDICTS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`chip verdict-chip ${verdict === v.id ? 'selected' : ''}`}
                style={{ '--c': v.color } as CSSProperties}
                onClick={() => setVerdict(verdict === v.id ? undefined : v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <textarea
            className="review-input"
            rows={3}
            maxLength={500}
            placeholder={`Why should ${SITE.owner} watch it again?`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="watch-picker-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || (!note.trim() && !verdict)}
              onClick={async () => {
                setBusy(true);
                try {
                  await addSuggestion(
                    { tmdb: movie.ids.tmdb ?? Number(movie.key), title: movie.title, year: movie.year, poster: movie.poster ?? null },
                    note,
                    'rewatch',
                    verdict,
                  );
                  setSent(true);
                  setOpen(false);
                  await reload();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Sending…' : 'Send challenge'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
