import { useState } from 'react';
import { SITE } from '../config';
import type { LoggedWatch, Movie, Play } from '../types';
import { WatchDatePicker } from './WatchDatePicker';

interface Props {
  movie: Movie;
  watch?: LoggedWatch;
  onAdd: (play: Play) => void;
  onRemove: (at: string) => void;
}

const fmt = (p: Play) =>
  p.backfilled
    ? `before ${SITE.trackingStartLabel}`
    : new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Admin only: watches logged on the site for this movie (Trakt plays aren't editable here). */
export function LoggedWatches({ movie, watch, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const plays = watch?.plays ?? [];

  return (
    <div className="logged-watches">
      {plays.length > 0 && (
        <div className="credit">
          <span className="credit-label">Logged here</span>
          {plays.map((p) => (
            <span key={p.at} className="chip logged-play">
              {fmt(p)}
              <button type="button" className="link" aria-label={`Remove watch ${fmt(p)}`} onClick={() => onRemove(p.at)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <WatchDatePicker
          movie={movie}
          confirmLabel="Add watch"
          onConfirm={(play) => {
            onAdd(play);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="link small" onClick={() => setAdding(true)}>
          + Watched it again
        </button>
      )}
    </div>
  );
}
