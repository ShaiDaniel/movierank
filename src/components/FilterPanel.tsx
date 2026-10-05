import { useMemo, useState, type CSSProperties } from 'react';
import { SCORES, VERDICTS, isMajorStreamer } from '../config';
import { PERSON_ROLES, SORTS, verdictOf, WATCHLIST_SORTS, personNames, type Filters, type PersonRole, type SortKey, type VerdictFilter } from '../filters';
import type { Movie, Ratings } from '../types';

interface Props {
  movies: Movie[];
  ratings: Ratings;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  /** The watchlist has no verdicts, scores or watch dates to filter on. */
  mode: 'watched' | 'watchlist';
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function FilterPanel({ movies, ratings, filters, onChange, mode }: Props) {
  const watched = mode === 'watched';
  const genres = useMemo(() => countBy(movies.flatMap((m) => m.genres)), [movies]);
  const streamers = useMemo(
    () => countBy(movies.flatMap((m) => m.providers?.stream.map((p) => p.name).filter(isMajorStreamer) ?? [])),
    [movies],
  );
  // The most frequent directors and (top-billed) actors, offered as one-click chips.
  const topPeople = useMemo(
    () =>
      (['d', 'a'] as const).map((role) => ({
        role,
        list: countBy(movies.flatMap((m) => (role === 'a' ? m.cast.slice(0, 6).map((c) => c.name) : m.directors)))
          .filter(([, n]) => n >= 3)
          .slice(0, 12),
      })),
    [movies],
  );
  const watchYears = useMemo(
    () => [...new Set(movies.flatMap((m) => m.plays.filter((p) => !p.backfilled).map((p) => p.at.slice(0, 4))))].sort().reverse(),
    [movies],
  );
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of movies) {
      const v = verdictOf(ratings[m.key]);
      if (!v) continue;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return counts;
  }, [movies, ratings]);

  return (
    <div className="filters">
      {watched && (
      <section>
        <h4>Verdict</h4>
        <div className="chips">
          {[...VERDICTS, { id: 'unrated' as const, label: 'Not ranked yet', color: '#64748b' }].map((v) => (
            <button
              key={v.id}
              type="button"
              className={`chip verdict-chip ${filters.verdicts.includes(v.id) ? 'selected' : ''}`}
              style={{ '--c': v.color } as CSSProperties}
              onClick={() => onChange({ verdicts: toggle<VerdictFilter>(filters.verdicts, v.id) })}
            >
              {v.label} <span className="count">{verdictCounts[v.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>
      )}

      <section>
        <h4>Search people</h4>
        <PeopleSearch movies={movies} selected={filters.people} onAdd={(code) => onChange({ people: [...filters.people, code] })} />
        {filters.people.length > 0 && (
          <div className="chips">
            {filters.people.map((code) => (
              <button key={code} type="button" className="chip selected" onClick={() => onChange({ people: toggle(filters.people, code) })}>
                {PERSON_ROLES[code[0] as PersonRole].label}: {code.slice(2)} ×
              </button>
            ))}
          </div>
        )}
      </section>

      {topPeople.map(({ role, list }) =>
        list.length ? (
          <section key={role}>
            <h4>{role === 'd' ? 'Common directors' : 'Common actors'}</h4>
            <div className="chips">
              {list.map(([name, n]) => {
                const code = `${role}:${name}`;
                return (
                  <button
                    key={code}
                    type="button"
                    className={`chip ${filters.people.includes(code) ? 'selected' : ''}`}
                    onClick={() => onChange({ people: toggle(filters.people, code) })}
                  >
                    {name} <span className="count">{n}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null,
      )}

      {watched && (
      <section>
        <h4>Minimum scores</h4>
        {SCORES.map((s) => {
          const value = filters.min[s.id] ?? 0;
          return (
            <label key={s.id} className="range-row" title={s.hint}>
              <span>{s.label}</span>
              <input
                type="range"
                min={0}
                max={10}
                value={value}
                onChange={(e) => onChange({ min: { ...filters.min, [s.id]: Number(e.target.value) || undefined } })}
              />
              <span className="range-value">{value ? `${value}+` : 'Any'}</span>
            </label>
          );
        })}
      </section>
      )}

      <section>
        <h4>Genre</h4>
        <div className="chips">
          {genres.map(([g, n]) => (
            <button
              key={g}
              type="button"
              className={`chip ${filters.genres.includes(g) ? 'selected' : ''}`}
              onClick={() => onChange({ genres: toggle(filters.genres, g) })}
            >
              {g} <span className="count">{n}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>Streaming in Israel</h4>
        <div className="chips">
          {streamers.map(([s, n]) => (
            <button
              key={s}
              type="button"
              className={`chip ${filters.stream.includes(s) ? 'selected' : ''}`}
              onClick={() => onChange({ stream: toggle(filters.stream, s) })}
            >
              {s} <span className="count">{n}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="two-col">
        <label>
          <h4>Released from</h4>
          <input
            type="number"
            placeholder="1900"
            value={filters.yearFrom ?? ''}
            onChange={(e) => onChange({ yearFrom: Number(e.target.value) || null })}
          />
        </label>
        <label>
          <h4>to</h4>
          <input
            type="number"
            placeholder="2026"
            value={filters.yearTo ?? ''}
            onChange={(e) => onChange({ yearTo: Number(e.target.value) || null })}
          />
        </label>
      </section>

      <section className="two-col">
        {watched && (
        <label>
          <h4>Watched</h4>
          <select value={filters.watched} onChange={(e) => onChange({ watched: e.target.value })}>
            <option value="any">Any time</option>
            {watchYears.map((y) => (
              <option key={y} value={y}>
                In {y}
              </option>
            ))}
            <option value="before">Date unknown (logged later)</option>
          </select>
        </label>
        )}
        <label>
          <h4>Sort by</h4>
          <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
            {(watched ? SORTS : WATCHLIST_SORTS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}

function countBy(items: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function PeopleSearch({ movies, selected, onAdd }: { movies: Movie[]; selected: string[]; onAdd: (code: string) => void }) {
  const [text, setText] = useState('');
  const index = useMemo(() => {
    const all: string[] = [];
    for (const m of movies) {
      for (const role of Object.keys(PERSON_ROLES) as PersonRole[]) {
        for (const name of personNames(m, role)) all.push(`${role}:${name}`);
      }
    }
    return countBy(all);
  }, [movies]);

  const q = text.trim().toLowerCase();
  const matches = q.length < 2 ? [] : index.filter(([code]) => code.slice(2).toLowerCase().includes(q) && !selected.includes(code)).slice(0, 10);

  return (
    <div className="people-search">
      <input type="search" placeholder="Type a name…" value={text} onChange={(e) => setText(e.target.value)} />
      {matches.length > 0 && (
        <ul className="suggestions">
          {matches.map(([code, n]) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => {
                  onAdd(code);
                  setText('');
                }}
              >
                {code.slice(2)}
                <span className="muted small">
                  {PERSON_ROLES[code[0] as PersonRole].label} · {n}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
