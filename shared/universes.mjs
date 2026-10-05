// Shared movie universes that span several TMDB collections (the MCU alone is split into
// Iron Man, Thor, Avengers, …). Membership comes from TMDB keywords or from a set of
// collections; scripts/enrich-tmdb.mjs tags each movie's "universes" during sync.
export const UNIVERSES = [
  { id: 'mcu', name: 'Marvel Cinematic Universe', keywords: [180547] },
  { id: 'dc', name: 'DC Universe', keywords: [229266, 312528] }, // DCEU + the new DCU
  { id: 'monsterverse', name: 'MonsterVerse', keywords: [380322] },
  { id: 'wizarding', name: 'Wizarding World', collections: ['Harry Potter Collection', 'Fantastic Beasts Collection'] },
  { id: 'middle-earth', name: 'Middle-earth', collections: ['The Lord of the Rings Collection', 'The Hobbit Collection'] },
];

export const UNIVERSE_NAME = Object.fromEntries(UNIVERSES.map((u) => [u.id, u.name]));
