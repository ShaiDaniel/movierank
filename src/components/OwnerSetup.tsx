import { useEffect, useRef, useState, type FormEvent } from 'react';
import { githubClient } from '../../shared/github.mjs';
import { saveOwnerCreds, type OwnerCreds } from '../suggestions';

const REPO = 'ShaiDaniel/movierank';

interface Props {
  /** Why it's shown: no token saved yet, or the saved token stopped working. */
  reason: 'missing' | 'rejected';
  onDone: (creds: OwnerCreds) => void;
  onClose: () => void;
}

/** Connects the owner's account to GitHub with a fine-grained token, saved to Firestore (owner-only). */
export function OwnerSetup({ reason, onDone, onClose }: Props) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const value = token.trim();
      if (!(await githubClient({ token: value, repo: REPO }).canPush().catch(() => false))) {
        throw new Error('GitHub rejected this token (expired, or no write access to movierank).');
      }
      const creds = { github: value, repo: REPO, branch: 'main' };
      await saveOwnerCreds(creds);
      onDone(creds);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal unlock-dialog" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Connect editing">
        <div className="modal-content">
          <h2>{reason === 'rejected' ? 'Reconnect editing' : 'Turn on editing'}</h2>
          <p className="muted small">
            {reason === 'rejected'
              ? 'GitHub no longer accepts the saved token (it probably expired). Paste a new fine-grained token with Contents: read and write on movierank.'
              : 'Paste a GitHub fine-grained token with Contents: read and write on movierank, so your rankings save.'}
          </p>
          <input
            ref={input}
            type="password"
            autoComplete="off"
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <div className="rate-nav">
            <button type="button" className="btn" onClick={onClose}>
              Not now
            </button>
            <button type="submit" className="btn primary" disabled={busy || !token}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
