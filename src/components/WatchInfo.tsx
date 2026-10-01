import { SITE } from '../config';
import { onlyBackfilled } from '../filters';
import type { Movie, Rating } from '../types';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function WatchInfo({ movie, rating }: { movie: Movie; rating?: Rating }) {
  const real = movie.plays.filter((p) => !p.backfilled);
  const times = movie.plays.length > 1 ? ` · ${movie.plays.length} times` : '';

  if (onlyBackfilled(movie)) {
    return <p className="watch-info">Watched before {SITE.trackingStartLabel}{times}</p>;
  }
  return (
    <p className="watch-info">
      Watched {rating?.dateUncertain ? 'around ' : ''}
      {real.map((p) => fmt(p.at)).join(', ')}
      {real.length < movie.plays.length ? `, and before ${SITE.trackingStartLabel}` : ''}
      {times}
    </p>
  );
}
