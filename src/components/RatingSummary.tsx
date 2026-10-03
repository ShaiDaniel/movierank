import { SCORES, VERDICT_BY_ID } from '../config';
import type { Rating } from '../types';

/** Read-only view of a rating: verdict, short take, thoughts and score bars. */
export function RatingSummary({ rating }: { rating?: Rating }) {
  const verdict = rating?.verdict ? VERDICT_BY_ID[rating.verdict] : null;
  const scored = SCORES.filter((s) => rating?.scores?.[s.id] !== undefined);

  if (!verdict && !scored.length && !rating?.note && !rating?.review) return <p className="muted">Not ranked yet.</p>;
  return (
    <>
      {verdict && <div className="verdict-big">{verdict.label}</div>}
      {rating?.note && <p className="note">“{rating.note}”</p>}
      {rating?.review && <p className="review">{rating.review}</p>}
      {scored.length > 0 && (
        <div className="score-bars">
          {scored.map((s) => (
            <div key={s.id} className="score-bar" title={s.hint}>
              <span>{s.label}</span>
              <div className="bar">
                <div style={{ width: `${rating!.scores![s.id]! * 10}%` }} />
              </div>
              <b>{rating!.scores![s.id]}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
