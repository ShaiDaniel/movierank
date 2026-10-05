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

const ANYONE = [
  { icon: '📺', title: 'Movies or TV', text: 'Switch between 🎬 Movies and 📺 TV at the top. Shows have their own verdicts, extra scores (Consistency, Ending, Bingeable), season notes, and progress: Finished, Caught up, Watching or Dropped.' },
  { icon: '🎬', title: 'Browse & filter', text: 'Filter by verdict, minimum scores, genre, director or actor, release years, watch date, and what streams in Israel. Sort by recommendation, IMDb, scores and more.' },
  { icon: '🔎', title: 'Search', text: 'Search titles, directors, actors and the notes on each movie from the box at the top.' },
  { icon: '🍿', title: 'Open a movie', text: 'See the verdict, scores and thoughts, the trailer, cast and crew, and where to watch it. Click any person to see all their movies.' },
  { icon: '⭐', title: 'Featured picks', text: `The banner at the top cycles through ${SITE.owner}'s Must watch picks. Open one or play its trailer.` },
  { icon: '🕒', title: 'Recent', text: `The last five movies ${SITE.owner} watched, with the full verdict.` },
  { icon: '📋', title: `${SITE.owner}'s watchlist`, text: `What ${SITE.owner} plans to watch next, by priority and who recommended it.` },
  { icon: '📊', title: 'Stats', text: `Watching habits, taste by genre and decade, favorite directors and actors, and how ${SITE.owner}'s taste compares with IMDb.` },
  { icon: '🔗', title: 'Share a view', text: 'The address bar keeps your filters and the open movie, so you can send a link like "all Must watch thrillers".' },
];

const SIGNED_IN = [
  { icon: '💡', title: 'Suggest a movie', text: `Know one ${SITE.owner} should see? Search it in Suggestions and say why.` },
  { icon: '⚔', title: 'Challenge a verdict', text: 'Disagree with a verdict? Click ⚔ Challenge on the movie, pick the verdict you think it deserves, and ask for a rewatch.' },
  { icon: '▲', title: 'Vote', text: 'Vote suggestions and challenges up or down; the most wanted rise to the top.' },
  { icon: '💬', title: 'Discuss', text: `Join the discussion on any movie and say whether you agree or disagree with ${SITE.owner}'s verdict. ${SITE.owner} replies there too.` },
  { icon: '🗨', title: 'Comment', text: 'Comment on suggestions and challenges.' },
  { icon: '📌', title: 'Your own list', text: 'Click ＋ My list on any movie to save it to your private list, and tick it off once you have watched it.' },
];

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

      <section className="about-do">
        <h2>What you can do here</h2>

        <h3>Anyone</h3>
        <div className="do-grid">
          {ANYONE.map((d) => (
            <div key={d.title} className="do-card">
              <span className="do-icon" aria-hidden="true">
                {d.icon}
              </span>
              <b>{d.title}</b>
              <p>{d.text}</p>
            </div>
          ))}
        </div>

        <h3>Signed in with Google</h3>
        <p className="muted small">
          Click <b>Sign in</b> at the top right. Suggestions, challenges, votes and discussions are public, with your name; your
          list is private to you.
        </p>
        <div className="do-grid">
          {SIGNED_IN.map((d) => (
            <div key={d.title} className="do-card signed-in">
              <span className="do-icon" aria-hidden="true">
                {d.icon}
              </span>
              <b>{d.title}</b>
              <p>{d.text}</p>
            </div>
          ))}
        </div>
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
          <b>Iconic</b> is about status, not quality: how canonical the movie is, a reference point people quote and build on.
          A small drama can be a Must watch with a low Iconic score. <b>Holds up</b> and <b>Rewatch</b> aren't part of the
          average: how well a movie aged, or whether it rewards watching again (a twist like The Sixth Sense only works once,
          while The Big Lebowski gets better every time), says nothing about how good it is.
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
              <span className="card-epic">Iconic 9</span>
            </dt>
            <dd>Shown when the Iconic score is 8 or more.</dd>
          </div>
          <div>
            <dt>
              <span className="card-avg">Avg 7.4</span>
            </dt>
            <dd>
              The average of {SITE.owner}'s scores for that movie (all except Holds up and Rewatch). It runs about 2 points below IMDb across the board — an
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

    </div>
  );
}
