import { useState } from 'react';
import { SITE } from '../config';
import { useSocial } from '../social';
import type { Movie, Ratings } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  /** Every movie on the site (watched and watchlist). */
  catalog: Movie[];
  ratings: Ratings;
  onOpen: (key: string) => void;
}

/** A signed-in co-worker's own list of movies picked from this site. Private to them. */
export function MyListPage({ catalog, ratings, onOpen }: Props) {
  const { viewer, myList, setSeen, toggleMyList } = useSocial();
  const [showSeen, setShowSeen] = useState(true);
  if (!viewer) return <p className="muted">Sign in to keep your own list.</p>;

  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const items = [...myList]
    .sort((a, b) => Number(a.seen) - Number(b.seen) || (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0))
    .filter((i) => showSeen || !i.seen);
  const seenCount = myList.filter((i) => i.seen).length;

  return (
    <div className="mylist">
      <div className="suggestions-bar">
        <p className="muted">
          Your private list — add movies with “＋ My list” on any movie page. Only you can see it. {seenCount} of {myList.length} watched.
        </p>
        <label className="check">
          <input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} />
          Show watched
        </label>
      </div>
      {items.length === 0 ? (
        <p className="muted">Nothing here yet. Open a movie and click “＋ My list”, e.g. one of {SITE.owner}'s Must watch picks.</p>
      ) : (
        <div className="grid">
          {items.map((i) => {
            const movie = byKey.get(i.key);
            if (!movie) return null;
            return (
              <div key={i.key} className={`mylist-item ${i.seen ? 'seen' : ''}`}>
                <MovieCard movie={movie} rating={ratings[movie.key]} onOpen={() => onOpen(movie.key)} />
                <div className="mylist-actions">
                  <label className="check">
                    <input type="checkbox" checked={i.seen} onChange={(e) => setSeen(i.key, e.target.checked)} />
                    Watched
                  </label>
                  <button type="button" className="link small" onClick={() => toggleMyList(i.key, i.title)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
