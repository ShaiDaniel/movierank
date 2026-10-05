import { useMemo } from 'react';
import { SCORES, SITE } from '../config';
import { computeStats, type PersonStat } from '../stats';
import type { Movie, Ratings, Watchlist } from '../types';
import { BarList, ColumnChart, Progress, Scatter, StatTile } from './charts';

interface Props {
  movies: Movie[];
  ratings: Ratings;
  watchlist: Watchlist;
  watchlistCount: number;
  onOpen: (key: string) => void;
  onPerson: (code: string) => void;
}

const one = (v: number | null) => (v === null ? '–' : v.toFixed(1));
const MIN_RATED = 3; // "best" lists need a few rated movies to mean anything

export function StatsPage({ movies, ratings, watchlist, watchlistCount, onOpen, onPerson }: Props) {
  const s = useMemo(() => computeStats(movies, ratings, watchlist, watchlistCount), [movies, ratings, watchlist, watchlistCount]);
  const { activity: a, taste: t, people: p, crowd: c, progress: g } = s;

  const topBy = (list: PersonStat[], role: 'd' | 'a') =>
    [...list]
      .sort((x, y) => y.count - x.count || (y.avg ?? 0) - (x.avg ?? 0))
      .slice(0, 10)
      .map((x) => ({
        label: x.name,
        value: x.count,
        display: `${x.count}${x.avg !== null ? ` · avg ${x.avg.toFixed(1)}` : ''}`,
        onClick: () => onPerson(`${role}:${x.name}`),
      }));
  const bestDirectors = p.directors
    .filter((d) => d.rated >= MIN_RATED && d.avg !== null)
    .sort((x, y) => y.avg! - x.avg!)
    .slice(0, 10);
  const bestGenres = t.genres.filter((x) => x.rated >= MIN_RATED && x.avg !== null).sort((x, y) => y.avg! - x.avg!);
  const fewRated = t.scored < 30;

  return (
    <div className="stats">
      <section className="stats-section">
        <h2>Watching</h2>
        <div className="tiles">
          <StatTile label="Movies watched" value={a.movies.toLocaleString()} hint={`${a.plays.toLocaleString()} watches incl. rewatches`} />
          <StatTile label="Hours of movies" value={a.hours.toLocaleString()} hint={`≈ ${Math.round(a.hours / 24)} days non-stop`} />
          <StatTile label="Per year" value={Math.round(a.perYearAvg)} hint={`since tracking began (${SITE.trackingStartLabel})`} />
          <StatTile label="Rewatched" value={a.rewatched} hint="movies watched more than once" />
        </div>
        <div className="chart-grid">
          <figure>
            <figcaption>Movies watched per year</figcaption>
            <ColumnChart data={a.perYear} />
            <p className="chart-note">
              Real watch dates only. {a.beforeTracking} movies have no real date: logged from memory before{' '}
              {SITE.trackingStartLabel}, or in catch-up sessions (5+ movies logged the same day).
            </p>
          </figure>
          <figure>
            <figcaption>By day of the week</figcaption>
            <ColumnChart data={a.perWeekday} />
          </figure>
          <figure>
            <figcaption>By month</figcaption>
            <ColumnChart data={a.perMonth} />
          </figure>
        </div>
      </section>

      <section className="stats-section">
        <h2>Taste</h2>
        {fewRated && (
          <p className="chart-note">
            Based on {t.scored} scored movies so far. These charts sharpen as more get ranked.
          </p>
        )}
        <div className="chart-grid">
          <figure>
            <figcaption>Verdicts</figcaption>
            <BarList items={t.verdicts.map((v) => ({ label: v.label, value: v.count, color: v.color }))} />
          </figure>
          <figure>
            <figcaption>Average score by category</figcaption>
            <BarList
              max={10}
              items={t.scoreAverages
                .filter((x) => x.avg !== null)
                .map((x) => ({
                  label: SCORES.find((sc) => sc.id === x.id)!.label,
                  value: x.avg!,
                  display: `${x.avg!.toFixed(1)}`,
                  detail: `${x.n} movies scored`,
                }))}
            />
          </figure>
          <figure>
            <figcaption>Most watched genres</figcaption>
            <BarList items={[...t.genres].sort((x, y) => y.count - x.count).slice(0, 10).map((x) => ({ label: x.genre, value: x.count }))} />
          </figure>
          <figure>
            <figcaption>Favorite genres (my average score)</figcaption>
            {bestGenres.length ? (
              <BarList
                max={10}
                items={bestGenres.slice(0, 10).map((x) => ({ label: x.genre, value: x.avg!, display: `${x.avg!.toFixed(1)} · ${x.rated} rated` }))}
              />
            ) : (
              <p className="chart-note">Needs at least {MIN_RATED} scored movies per genre.</p>
            )}
          </figure>
          <figure>
            <figcaption>Movies watched by release decade</figcaption>
            <ColumnChart data={t.decades.map((d) => ({ label: `${String(d.decade).slice(2)}s`, value: d.count, detail: `${d.decade}s` }))} />
          </figure>
          <figure>
            <figcaption>How well they hold up, by decade</figcaption>
            <ColumnChart
              max={10}
              format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
              data={t.decades
                .filter((d) => d.holdsUp !== null)
                .map((d) => ({ label: `${String(d.decade).slice(2)}s`, value: d.holdsUp!, detail: `${d.holdsUpN} scored` }))}
            />
          </figure>
        </div>
      </section>

      <section className="stats-section">
        <h2>People</h2>
        <div className="chart-grid">
          <figure>
            <figcaption>Most watched directors</figcaption>
            <BarList items={topBy(p.directors, 'd')} />
          </figure>
          <figure>
            <figcaption>Most watched actors</figcaption>
            <BarList items={topBy(p.actors, 'a')} />
          </figure>
          <figure>
            <figcaption>Highest-rated directors (my average, {MIN_RATED}+ rated)</figcaption>
            {bestDirectors.length ? (
              <BarList
                max={10}
                items={bestDirectors.map((d) => ({
                  label: d.name,
                  value: d.avg!,
                  display: `${d.avg!.toFixed(1)} · ${d.rated} rated`,
                  onClick: () => onPerson(`d:${d.name}`),
                }))}
              />
            ) : (
              <p className="chart-note">Shows up once directors have {MIN_RATED}+ scored movies.</p>
            )}
          </figure>
        </div>
      </section>

      <section className="stats-section">
        <h2>Me vs. IMDb</h2>
        <div className="tiles">
          <StatTile label="My average" value={one(c.meanMe)} hint={`on ${c.pairs.length} scored movies`} />
          <StatTile label="IMDb average" value={one(c.meanImdb)} hint="same movies" />
          <StatTile
            label="Agree within 1 point"
            value={c.withinOne === null ? '–' : `${Math.round(c.withinOne * 100)}%`}
            hint="after allowing for my usual gap"
          />
          <StatTile
            label="Taste correlation"
            value={c.correlation === null ? '–' : c.correlation.toFixed(2)}
            hint="1 = same order as IMDb, 0 = unrelated"
          />
        </div>
        {c.pairs.length > 0 && (
          <p className="chart-note gap-note">
            My scores average {Math.abs(c.gap).toFixed(1)} points {c.gap < 0 ? 'below' : 'above'} IMDb across the board, so the
            agreement and the lists below compare each movie against that usual gap.
          </p>
        )}
        <div className="chart-grid">
          <figure>
            <figcaption>My average score vs. IMDb rating</figcaption>
            <Scatter
              xLabel="IMDb rating"
              yLabel="My average"
              points={c.pairs.map((x) => ({ x: x.imdb, y: x.me, label: `${x.movie.title} (${x.movie.year})`, onClick: () => onOpen(x.movie.key) }))}
            />
            <p className="chart-note">Hover a dot for the movie; click to open it. The line marks identical scores.</p>
          </figure>
          <div className="diff-lists">
            <figure>
              <figcaption>I like more than IMDb (relative to my usual gap)</figcaption>
              <DiffList items={c.over.filter((x) => x.diff > 0)} onOpen={onOpen} />
            </figure>
            <figure>
              <figcaption>IMDb likes more than me (relative to my usual gap)</figcaption>
              <DiffList items={c.under.filter((x) => x.diff < 0)} onOpen={onOpen} />
            </figure>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <h2>Ranking progress</h2>
        <div className="progress-list">
          <Progress label="Verdict given" done={g.ranked} total={g.total} />
          <Progress label="Scored" done={g.scored} total={g.total} />
          <Progress label="With a take or thoughts" done={g.withThoughts} total={g.total} />
          <Progress label="Watched in the last 12 months, ranked" done={g.lastYearRanked} total={g.lastYear} />
        </div>
        <div className="tiles">
          <StatTile label="On the watchlist" value={g.watchlist} hint={`${g.highPriority} high priority`} />
        </div>
      </section>
    </div>
  );
}

function DiffList({ items, onOpen }: { items: { movie: Movie; me: number; imdb: number; diff: number }[]; onOpen: (key: string) => void }) {
  if (!items.length) return <p className="chart-note">Nothing yet.</p>;
  return (
    <ul className="diff-list">
      {items.map((x) => (
        <li key={x.movie.key}>
          <button type="button" className="link" onClick={() => onOpen(x.movie.key)}>
            {x.movie.title}
          </button>
          <span className="muted" title="Difference from my usual gap to IMDb">
            me {x.me.toFixed(1)} · IMDb {x.imdb.toFixed(1)}
          </span>
          <b>
            {x.diff > 0 ? '+' : ''}
            {x.diff.toFixed(1)}
          </b>
        </li>
      ))}
    </ul>
  );
}
