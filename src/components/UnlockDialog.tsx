import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { unlock } from '../data';

interface Props {
  onUnlocked: () => void;
  onClose: () => void;
}

export function UnlockDialog({ onUnlocked, onClose }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(passphrase, remember);
      onUnlocked();
    } catch (err) {
      const message = (err as Error).message;
      setError(message === 'wrong-passphrase' ? 'Wrong passphrase.' : message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal unlock-dialog" onSubmit={submit} onClick={(e) => e.stopPropagation()} aria-label="Unlock editing">
        <div className="modal-content">
          <h2>Edit rankings</h2>
          <p className="muted small">Enter your passphrase to edit. Changes are saved to GitHub and appear on the site for everyone within about a minute.</p>
          <input
            ref={input}
            type="password"
            autoComplete="current-password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device (only on your own phone or computer)
          </label>
          {error && <p className="error">{error}</p>}
          <div className="rate-nav">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy || !passphrase}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
