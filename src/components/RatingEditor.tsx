import type { CSSProperties } from 'react';
import { SCORES, VERDICTS } from '../config';
import type { Rating, ScoreId } from '../types';

interface Props {
  value: Rating | undefined;
  /** Receives an updater, so several quick clicks build on each other instead of on a stale value. */
  onChange: (update: (prev: Rating) => Rating) => void;
  /** Row highlighted for keyboard input in rate mode: 0 = verdict, 1.. = scores. */
  activeRow?: number;
  onRowClick?: (row: number) => void;
}

export function RatingEditor({ value, onChange, activeRow, onRowClick }: Props) {
  const r = value ?? {};
  const update = (change: (prev: Rating) => Partial<Rating>) =>
    onChange((prev) => ({ ...prev, ...change(prev), updatedAt: new Date().toISOString() }));
  const setScore = (id: ScoreId, v: number) =>
    update((prev) => {
      const scores = { ...prev.scores };
      if (prev.scores?.[id] === v) delete scores[id];
      else scores[id] = v;
      return { scores };
    });

  return (
    <div className="editor">
      <div className={`editor-row verdict-row ${activeRow === 0 ? 'active' : ''}`} onClick={() => onRowClick?.(0)}>
        {VERDICTS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            className={`verdict-btn ${r.verdict === v.id ? 'selected' : ''}`}
            style={{ '--c': v.color } as CSSProperties}
            onClick={() => update((prev) => ({ verdict: prev.verdict === v.id ? undefined : v.id }))}
            title={activeRow !== undefined ? `Key ${i + 1}` : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>

      {SCORES.map((s, i) => {
        const current = r.scores?.[s.id];
        return (
          <div
            key={s.id}
            className={`editor-row score-row ${activeRow === i + 1 ? 'active' : ''}`}
            onClick={() => onRowClick?.(i + 1)}
          >
            <span className="score-label" title={s.hint}>
              {s.label}
            </span>
            <div className="segments" role="radiogroup" aria-label={s.label}>
              {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={current === n}
                  className={`segment ${current !== undefined && n <= current ? 'on' : ''}`}
                  onClick={() => setScore(s.id, n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="score-value">{current ?? '–'}</span>
          </div>
        );
      })}

      <label className="field">
        <span>Short take · shown on the movie card</span>
        <input
          type="text"
          className="note-input"
          placeholder="e.g. Slow first act, worth it"
          maxLength={120}
          value={r.note ?? ''}
          onChange={(e) => {
            const note = e.target.value || undefined;
            update(() => ({ note }));
          }}
        />
      </label>
      <label className="field">
        <span>Your thoughts · free text, shown on the movie page</span>
        <textarea
          className="review-input"
          placeholder="Anything: why it works, who it's for, when to watch it, spoiler-free tips…"
          value={r.review ?? ''}
          rows={5}
          onChange={(e) => {
            const review = e.target.value || undefined;
            update(() => ({ review }));
          }}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={!!r.dateUncertain}
          onChange={(e) => {
            const dateUncertain = e.target.checked || undefined;
            update(() => ({ dateUncertain }));
          }}
        />
        Watch date is uncertain (logged later from memory)
      </label>
    </div>
  );
}
