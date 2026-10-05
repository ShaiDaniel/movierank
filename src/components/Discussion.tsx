import { useState } from 'react';
import { SITE, VERDICT_BY_ID } from '../config';
import { useSocial } from '../social';
import { addComment, deleteComment, movieThread, signIn, type Stance } from '../suggestions';
import type { Movie, Rating } from '../types';

const fmt = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Debate about a movie on its page. On ranked movies, posts can agree or disagree with the verdict. */
export function Discussion({ movie, rating }: { movie: Movie; rating?: Rating }) {
  const { enabled, viewer, comments, reload } = useSocial();
  const [text, setText] = useState('');
  const [stance, setStance] = useState<Stance | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const thread = movieThread(movie.key);
  const posts = comments[thread] ?? [];
  const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
  const agree = posts.filter((p) => p.stance === 'agree').length;
  const disagree = posts.filter((p) => p.stance === 'disagree').length;
  // The owner takes part without a stance: it's their own verdict.
  const canTakeSide = Boolean(verdict && viewer && !viewer.isOwner);

  const post = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addComment(thread, text, canTakeSide ? stance : undefined);
      setText('');
      setStance(undefined);
      await reload();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="discussion">
      <h3>
        Discussion {posts.length > 0 && <span className="count">{posts.length}</span>}
      </h3>
      {verdict && (agree > 0 || disagree > 0) && (
        <p className="small">
          On “{verdict.label}”: <b className="agree">👍 {agree} agree</b> · <b className="disagree">👎 {disagree} disagree</b>
        </p>
      )}

      {posts.length === 0 && <p className="muted small">No discussion yet{viewer ? ' — start it.' : '.'}</p>}
      <div className="comment-thread">
        {posts.map((c) => {
          return (
            <div key={c.id} className="comment">
              {c.userPhoto ? <img src={c.userPhoto} alt="" referrerPolicy="no-referrer" /> : <span />}
              <div>
                <span className="comment-meta">
                  <b>{c.userName}</b>
                  {c.byOwner && <span className="owner-tag">{SITE.owner}</span>}
                  {c.stance && (
                    <span className={`stance ${c.stance}`}>{c.stance === 'agree' ? '👍 agrees' : '👎 disagrees'}</span>
                  )}
                  · {fmt(c.createdAt)}
                  {(viewer?.uid === c.userId || viewer?.isOwner) && (
                    <button type="button" className="link small" onClick={() => deleteComment(thread, c.id).then(reload)}>
                      delete
                    </button>
                  )}
                </span>
                <p>{c.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {viewer ? (
        <div className="discussion-form">
          {canTakeSide && (
            <div className="chips">
              <span className="muted small">{SITE.owner} says {verdict!.label}. You:</span>
              <button type="button" className={`chip ${stance === 'agree' ? 'selected' : ''}`} onClick={() => setStance(stance === 'agree' ? undefined : 'agree')}>
                👍 Agree
              </button>
              <button
                type="button"
                className={`chip ${stance === 'disagree' ? 'selected' : ''}`}
                onClick={() => setStance(stance === 'disagree' ? undefined : 'disagree')}
              >
                👎 Disagree
              </button>
            </div>
          )}
          <textarea
            className="review-input"
            rows={2}
            maxLength={1000}
            placeholder={viewer.isOwner ? 'Reply to the discussion…' : 'What did you think?'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <div className="watch-picker-actions">
            <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={post}>
              {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => signIn().catch(() => {})}>
          Sign in to join the discussion
        </button>
      )}
    </section>
  );
}
