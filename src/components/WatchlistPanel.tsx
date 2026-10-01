import { useEditMode } from '../edit';
import type { Priority, WatchlistEntry } from '../types';

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

interface Props {
  entry: WatchlistEntry;
  onChange: (update: (prev: WatchlistEntry) => WatchlistEntry) => void;
}

/** Shown in the movie page for watchlist movies, instead of the verdict panel. */
export function WatchlistPanel({ entry, onChange }: Props) {
  const ADMIN = useEditMode() !== null;
  const update = (patch: Partial<WatchlistEntry>) =>
    onChange((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));

  return (
    <section className="verdict-panel watchlist-panel">
      <div className="watchlist-head">
        <strong>On the watchlist</strong>
        <span className="muted small">since {fmt(entry.addedAt)}</span>
        {!ADMIN && entry.priority && <span className={`priority-badge ${entry.priority}`}>{entry.priority} priority</span>}
      </div>

      {ADMIN ? (
        <>
          <div className="priority-row">
            <span className="credit-label">Priority</span>
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${entry.priority === p.id ? 'selected' : ''}`}
                onClick={() => update({ priority: entry.priority === p.id ? undefined : p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Why / who recommended it</span>
            <input
              type="text"
              placeholder="e.g. Dana says it's her favorite"
              value={entry.why ?? ''}
              onChange={(e) => {
                const why = e.target.value || undefined;
                onChange((prev) => ({ ...prev, why, updatedAt: new Date().toISOString() }));
              }}
            />
          </label>
          <button type="button" className="link remove-link" onClick={() => update({ removed: true })}>
            Remove from watchlist
          </button>
        </>
      ) : (
        entry.why && <p className="note">“{entry.why}”</p>
      )}
    </section>
  );
}
