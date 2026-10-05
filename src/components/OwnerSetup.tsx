import { useEffect, useRef, useState, type FormEvent } from 'react';
import { githubClient } from '../../shared/github.mjs';
import { decryptVault } from '../../shared/vault.mjs';
import { saveOwnerCreds, type OwnerCreds } from '../suggestions';

const REPO = 'ShaiDaniel/movierank';
const BASE = import.meta.env.BASE_URL;

interface Props {
  /** Why it's shown: first time, or the saved token stopped working. */
  reason: 'missing' | 'rejected';
  onDone: (creds: OwnerCreds) => void;
  onClose: () => void;
}

/**
 * Connects the owner's account to GitHub once: either moves the token out of the old
 * passphrase vault, or takes a new fine-grained token. Saved to Firestore (owner-only).
 */
export function OwnerSetup({ reason, onDone, onClose }: Props) {
  const [how, setHow] = useState<'passphrase' | 'token'>(reason === 'rejected' ? 'token' : 'passphrase');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [how]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let token = value.trim();
      if (how === 'passphrase') {
        const res = await fetch(`${BASE}vault.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error('The old passphrase file is gone. Paste a GitHub token instead.');
        try {
          token = (await decryptVault(await res.json(), value)).github;
        } catch {
          throw new Error('Wrong passphrase.');
        }
      }
      if (!(await githubClient({ token, repo: REPO }).canPush().catch(() => false))) {
        throw new Error('GitHub rejected this token (expired, or no write access to movierank).');
      }
      const creds = { github: token, repo: REPO, branch: 'main' };
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
              ? 'GitHub no longer accepts the saved token (it probably expired). Paste a new fine-grained token.'
              : 'One time only: connect your account to GitHub so your rankings save. After this, signing in is all it takes.'}
          </p>
          {reason === 'missing' && (
            <div className="chips">
              <button type="button" className={`chip ${how === 'passphrase' ? 'selected' : ''}`} onClick={() => setHow('passphrase')}>
                Use my old passphrase
              </button>
              <button type="button" className={`chip ${how === 'token' ? 'selected' : ''}`} onClick={() => setHow('token')}>
                Paste a GitHub token
              </button>
            </div>
          )}
          <input
            ref={input}
            type="password"
            autoComplete="off"
            placeholder={how === 'passphrase' ? 'Passphrase' : 'github_pat_…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <div className="rate-nav">
            <button type="button" className="btn" onClick={onClose}>
              Not now
            </button>
            <button type="submit" className="btn primary" disabled={busy || !value}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
