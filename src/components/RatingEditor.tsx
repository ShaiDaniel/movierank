import type { CSSProperties } from 'react';
import { VERDICTS, scoresFor } from '../config';
import { PROGRESS_LABEL } from '../progress';
import type { Movie, Progress, Rating, ScoreId } from '../types';

interface Props {
  value: Rating | undefined;
  /** Receives an updater, so several quick clicks build on each other instead of on a stale value. */
  onChange: (update: (prev: Rating) => Rating) => void;
  /** Row highlighted for keyboard input in rate mode: 0 = verdict, 1.. = scores. */
  activeRow?: number;
  onRowClick?: (row: number) => void;
  /** The movie or show being rated: shows get TV scores, season notes and a progress override. */
  movie?: Movie;
}

export function RatingEditor({ value, onChange, activeRow, onRowClick, movie }: Props) {
  const r = value ?? {};
  const scores = scoresFor(movie?.kind);
  const seasons = (movie?.tv?.seasons ?? []).filter((s) => s.episodes > 0);
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

      {scores.map((s, i) => {
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
      {movie?.tv && (
        <div className="season-notes">
          <label className="field">
            <span>Progress (worked out from episodes watched, unless you set it)</span>
            <select
              value={r.progress ?? ''}
              onChange={(e) => {
                const progress = (e.target.value || undefined) as Progress | undefined;
                update(() => ({ progress }));
              }}
            >
              <option value="">Automatic</option>
              {(Object.keys(PROGRESS_LABEL) as Progress[]).map((p) => (
                <option key={p} value={p}>
                  {PROGRESS_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <span className="field-title">Season notes (optional)</span>
          {seasons.map((season) => (
            <label key={season.n} className="season-note">
              <span>S{season.n}</span>
              <input
                type="text"
                maxLength={140}
                placeholder={season.n === 1 ? 'e.g. Slow start, push through' : ''}
                value={r.seasons?.[season.n] ?? ''}
                onChange={(e) => {
                  const text = e.target.value;
                  update((prev) => {
                    const notes = { ...prev.seasons };
                    if (text) notes[season.n] = text;
                    else delete notes[season.n];
                    return { seasons: Object.keys(notes).length ? notes : undefined };
                  });
                }}
              />
            </label>
          ))}
        </div>
      )}
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
