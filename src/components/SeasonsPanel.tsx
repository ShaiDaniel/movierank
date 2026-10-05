import { SITE } from '../config';
import { progressOf } from '../progress';
import type { Movie, Rating } from '../types';

/** A show's seasons: how much of each Shai watched, and the season notes. */
export function SeasonsPanel({ show, rating }: { show: Movie; rating?: Rating }) {
  const tv = show.tv;
  if (!tv) return null;
  const progress = progressOf(show, rating);
  return (
    <section className="seasons">
      <h3>
        Seasons
        {progress && <span className={`progress-tag ${progress.state}`}>{progress.label}</span>}
      </h3>
      <ul>
        {tv.seasons.filter((s) => s.episodes > 0).map((s) => {
          const seen = tv.perSeason[s.n] ?? 0;
          const note = rating?.seasons?.[s.n];
          return (
            <li key={s.n}>
              <span className="season-name">Season {s.n}</span>
              <div className="bar-track" title={`${SITE.owner} watched ${seen} of ${s.episodes} episodes`}>
                <div className="bar-fill" style={{ width: `${s.episodes ? Math.min(100, (seen / s.episodes) * 100) : 0}%` }} />
              </div>
              <span className="muted small">
                {seen}/{s.episodes}
              </span>
              {note && <p className="season-note-text">“{note}”</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
