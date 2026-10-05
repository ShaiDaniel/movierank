import type { Movie, Progress, Rating } from './types';

export const PROGRESS_LABEL: Record<Progress, string> = {
  finished: 'Finished',
  caughtup: 'Caught up',
  watching: 'Watching',
  dropped: 'Dropped',
};

/** A show not watched for this long, without being finished, counts as dropped. */
const STALE_MS = 180 * 24 * 3600 * 1000;

/**
 * Where Shai is with a show, from episodes watched vs. aired (or the owner's override):
 * finished (ended, all seen), caught up (running, all aired seen), watching (recent), dropped.
 */
export function progressOf(show: Movie, rating?: Rating): { state: Progress; label: string } | null {
  const tv = show.tv;
  if (!tv) return null;
  const seasonsSeen = Object.keys(tv.perSeason).map(Number);
  const lastSeason = seasonsSeen.length ? Math.max(...seasonsSeen) : 0;
  const describe = (state: Progress) => ({
    state,
    label: state === 'dropped' && lastSeason ? `Dropped after S${lastSeason}` : PROGRESS_LABEL[state],
  });
  if (rating?.progress) return describe(rating.progress);

  const allSeen = tv.aired > 0 && tv.seen >= tv.aired;
  const ended = tv.status === 'Ended' || tv.status === 'Canceled';
  if (allSeen) return describe(ended ? 'finished' : 'caughtup');
  const lastReal = show.plays.find((p) => !p.backfilled)?.at;
  if (lastReal && Date.now() - Date.parse(lastReal) < STALE_MS) return describe('watching');
  return describe('dropped');
}
