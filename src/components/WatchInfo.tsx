import { SITE } from '../config';
import { TRACKING_START } from '../filters';
import type { Movie, Play, Rating } from '../types';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const month = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/**
 * A backfilled play has no real date: either logged from memory before tracking started,
 * or logged later in a catch-up session — then it was watched sometime before that day.
 */
export const watchedBefore = (p: Play) => (p.at < TRACKING_START ? SITE.trackingStartLabel : month(p.at));

function ShowWatchInfo({ movie }: { movie: Movie }) {
  const tv = movie.tv!;
  const real = movie.plays.filter((p) => !p.backfilled);
  const earlier = movie.plays.filter((p) => p.backfilled);
  const when = real.length
    ? `${month(real[real.length - 1].at)}${real.length > 1 && month(real[0].at) !== month(real[real.length - 1].at) ? ` – ${month(real[0].at)}` : ''}${earlier.length ? `, and before ${watchedBefore(earlier[0])}` : ''}`
    : earlier.length
      ? `before ${watchedBefore(earlier[0])}`
      : '';
  return (
    <p className="watch-info">
      {tv.seen} of {tv.aired} episodes{when ? ` · watched ${when}` : ''}
    </p>
  );
}

export function WatchInfo({ movie, rating }: { movie: Movie; rating?: Rating }) {
  if (movie.kind === 'tv') return <ShowWatchInfo movie={movie} />;
  const real = movie.plays.filter((p) => !p.backfilled);
  const earlier = movie.plays.filter((p) => p.backfilled);
  const times = movie.plays.length > 1 ? ` · ${movie.plays.length} times` : '';
  // The latest "before" bound is the most informative.
  const before = earlier.length ? watchedBefore(earlier[0]) : null;

  if (!real.length) {
    return (
      <p className="watch-info">
        Watched before {before}
        {times}
      </p>
    );
  }
  return (
    <p className="watch-info">
      Watched {rating?.dateUncertain ? 'around ' : ''}
      {real.map((p) => fmt(p.at)).join(', ')}
      {before ? `, and before ${before}` : ''}
      {times}
    </p>
  );
}
