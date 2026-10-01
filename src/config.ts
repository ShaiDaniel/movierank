import type { ScoreId, VerdictId } from './types';

export const SITE = {
  title: 'MovieRank',
  owner: 'Shai',
  /** Matches TRACKING_START in scripts/import-trakt.mjs. */
  trackingStartLabel: 'Aug 2017',
};

export const VERDICTS: { id: VerdictId; label: string; color: string }[] = [
  { id: 'must', label: 'Must watch', color: '#22c55e' },
  { id: 'should', label: 'Should watch', color: '#4ade80' },
  { id: 'may', label: 'May watch', color: '#a3e635' },
  { id: 'neutral', label: 'Neutral', color: '#94a3b8' },
  { id: 'maynot', label: 'May not watch', color: '#fbbf24' },
  { id: 'shouldnot', label: 'Should not watch', color: '#fb923c' },
  { id: 'mustnot', label: 'Must not watch', color: '#f87171' },
];

export const VERDICT_BY_ID = Object.fromEntries(VERDICTS.map((v) => [v.id, v])) as Record<
  VerdictId,
  (typeof VERDICTS)[number]
>;

export const SCORES: { id: ScoreId; label: string; hint: string }[] = [
  { id: 'fun', label: 'Fun', hint: 'How much fun it is to watch' },
  { id: 'epic', label: 'Epic', hint: 'Scale, grandeur, goosebumps' },
  { id: 'story', label: 'Story', hint: 'Script and plot' },
  { id: 'acting', label: 'Acting', hint: 'Performances' },
  { id: 'visuals', label: 'Visuals', hint: 'Cinematography and effects' },
  { id: 'audio', label: 'Audio', hint: 'Soundtrack and sound design' },
  { id: 'rewatch', label: 'Rewatch', hint: 'Would you watch it again?' },
  { id: 'holdsUp', label: 'Holds up', hint: 'How well it has aged' },
];

export const tmdbImage = (path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w780' | 'w1280') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
