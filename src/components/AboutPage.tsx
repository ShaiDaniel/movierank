import type { CSSProperties } from 'react';
import { SCORES, SITE, VERDICTS } from '../config';
import type { VerdictId } from '../types';

// What each verdict means for someone deciding what to watch tonight.
const VERDICT_MEANING: Record<VerdictId, string> = {
  must: "Drop what you're doing. One of the best I've seen; everyone should see it at least once.",
  should: 'Very good. Worth making time for, even if it isn’t your usual genre.',
  may: 'Good, with caveats. If the premise or genre appeals to you, go for it.',
  neutral: "Fine, forgettable. Neither a recommendation nor a warning.",
  maynot: 'Has its moments, but most people can skip it.',
  shouldnot: 'Not worth two hours. Only for die-hard fans of the genre or cast.',
  mustnot: 'Avoid. Life is short.',
};

/** Explains how to read the verdicts, scores and badges. */
export function AboutPage() {
  return (
    <div className="about">
      <section>
        <h2>What is this?</h2>
        <p>
          {SITE.owner}'s verdict on every movie watched since tracking started in 2017, plus the ones remembered from
          before. Use it to decide what to watch: filter by verdict, scores, genre, actor, director or what's streaming in
          Israel. Movies not ranked yet show their IMDb rating so you still get a sense of them.
        </p>
      </section>

      <section>
        <h2>The verdict</h2>
        <p className="muted">The headline: should <em>you</em> watch it? Seven steps from a strong yes to a strong no.</p>
        <ul className="about-verdicts">
          {VERDICTS.map((v) => (
            <li key={v.id}>
              <span className="chip verdict-chip selected" style={{ '--c': v.color } as CSSProperties}>
                {v.label}
              </span>
              <span>{VERDICT_MEANING[v.id]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>The scores (1–10)</h2>
        <p className="muted">
          Optional details behind the verdict. A movie can be a Must watch with a low Audio score — the verdict is the overall
          call, the scores explain it.
        </p>
        <dl className="about-scores">
          {SCORES.map((s) => (
            <div key={s.id}>
              <dt>{s.label}</dt>
              <dd>{s.hint}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          <b>Holds up</b> matters most for older movies: some classics feel dated today, some feel timeless.{' '}
          <b>Epic</b> is about scale and goosebumps, not quality — a small drama can be a Must watch with a low Epic score.
        </p>
      </section>

      <section>
        <h2>Badges on the posters</h2>
        <dl className="about-scores">
          <div>
            <dt>
              <span className="card-imdb static">
                IMDb <b>8.1</b>
              </span>
            </dt>
            <dd>The IMDb rating, updated daily.</dd>
          </div>
          <div>
            <dt>
              <span className="card-epic">Epic 9</span>
            </dt>
            <dd>Shown when the Epic score is 8 or more.</dd>
          </div>
          <div>
            <dt>
              <span className="card-avg">Avg 7.4</span>
            </dt>
            <dd>
              The average of {SITE.owner}'s scores for that movie. It runs about 2 points below IMDb across the board — an
              average of eight categories is naturally lower than a single overall rating — so compare it with other movies
              here rather than with IMDb.
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>Watch dates</h2>
        <p>
          Watches have been logged since August 2017. Movies seen before that show “Watched before Aug 2017”, because their real
          date isn't known. A rewatch adds a new date, so a recently rewatched old movie appears under Recent.
        </p>
      </section>

      <section>
        <h2>Joining in</h2>
        <p>
          Sign in with Google to <b>suggest a movie</b> {SITE.owner} hasn't seen, <b>challenge a verdict</b> you disagree with
          (from the movie's page), <b>comment</b> on suggestions and challenges, and keep <b>your own list</b> of movies from this
          site. Suggestions, challenges and comments are public; your list is private.
        </p>
      </section>
    </div>
  );
}
