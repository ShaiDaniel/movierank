import { useState } from 'react';
import type { Movie, Play } from '../types';
import { backfilledPlay, playOn } from '../watches';

interface Props {
  movie: Pick<Movie, 'releaseDate' | 'year'>;
  confirmLabel: string;
  onConfirm: (play: Play) => void;
  onCancel?: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "When did you watch it?" — today, a date, or long ago (before tracking). */
export function WatchDatePicker({ movie, confirmLabel, onConfirm, onCancel }: Props) {
  const [when, setWhen] = useState<'today' | 'date' | 'past'>('today');
  const [date, setDate] = useState(today);

  return (
    <div className="watch-picker">
      <span className="credit-label">Watched</span>
      <div className="chips">
        {(
          [
            ['today', 'Today'],
            ['date', 'On a date'],
            ['past', 'A long time ago'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${when === id ? 'selected' : ''}`} onClick={() => setWhen(id)}>
            {label}
          </button>
        ))}
        {when === 'date' && <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}
      </div>
      <div className="watch-picker-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          disabled={when === 'date' && !date}
          onClick={() => onConfirm(when === 'past' ? backfilledPlay(movie) : playOn(when === 'today' ? today() : date))}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
