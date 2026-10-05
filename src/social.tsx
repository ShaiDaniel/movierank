// Everything about the signed-in co-worker in one place: who they are, suggestions and
// challenges (with comments), and their private list. Components read it with useSocial().
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addToMyList,
  castVote,
  loadComments,
  loadVotes,
  loadMyList,
  loadSuggestions,
  removeFromMyList,
  setSeenOnMyList,
  suggestionsEnabled,
  watchViewer,
  type Comment,
  type ListItem,
  type Suggestion,
  type Viewer,
  type Vote,
} from './suggestions';

interface Social {
  enabled: boolean;
  viewer: Viewer | null;
  suggestions: Suggestion[];
  comments: Record<string, Comment[]>;
  votes: Record<string, Vote[]>;
  /** Net score (ups minus downs) of a suggestion or challenge. */
  scoreOf: (id: string) => number;
  myVote: (id: string) => 1 | -1 | null;
  /** Votes up or down; voting the same way again removes the vote. */
  vote: (id: string, value: 1 | -1) => Promise<void>;
  myList: ListItem[];
  reload: () => Promise<void>;
  isOnMyList: (key: string) => boolean;
  toggleMyList: (key: string, title: string) => Promise<void>;
  setSeen: (key: string, seen: boolean) => Promise<void>;
}

const SocialContext = createContext<Social | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [votes, setVotes] = useState<Record<string, Vote[]>>({});
  const [myList, setMyList] = useState<ListItem[]>([]);

  // Loaded independently, so one failing (e.g. comments) doesn't hide the other.
  const reload = useCallback(async () => {
    const [s, c, v] = await Promise.allSettled([loadSuggestions(), loadComments(), loadVotes()]);
    if (v.status === 'fulfilled') setVotes(v.value);
    else console.error('Loading votes failed', v.reason);
    if (s.status === 'fulfilled') setSuggestions(s.value);
    else console.error('Loading suggestions failed', s.reason);
    if (c.status === 'fulfilled') setComments(c.value);
    else console.error('Loading comments failed', c.reason);
  }, []);

  useEffect(() => {
    if (!suggestionsEnabled) return;
    reload();
    let unsubscribe: (() => void) | undefined;
    watchViewer(setViewer).then((u) => (unsubscribe = u));
    return () => unsubscribe?.();
  }, [reload]);

  useEffect(() => {
    if (!viewer) return setMyList([]);
    loadMyList(viewer.uid)
      .then(setMyList)
      .catch((e) => console.error('Loading my list failed', e));
  }, [viewer]);

  const value = useMemo<Social>(() => {
    const keys = new Set(myList.map((i) => i.key));
    return {
      enabled: suggestionsEnabled,
      viewer,
      suggestions,
      comments,
      votes,
      scoreOf: (id) => (votes[id] ?? []).reduce((n, v) => n + v.value, 0),
      myVote: (id) => (votes[id] ?? []).find((v) => v.userId === viewer?.uid)?.value ?? null,
      vote: async (id, value) => {
        if (!viewer) return;
        const current = (votes[id] ?? []).find((v) => v.userId === viewer.uid)?.value ?? null;
        const next = current === value ? null : value;
        // Optimistic: show it right away, then save.
        setVotes((all) => {
          const others = (all[id] ?? []).filter((v) => v.userId !== viewer.uid);
          return { ...all, [id]: next ? [...others, { userId: viewer.uid, userName: viewer.name, value: next }] : others };
        });
        try {
          await castVote(id, next);
        } catch (e) {
          console.error('Voting failed', e);
          reload();
        }
      },
      myList,
      reload,
      isOnMyList: (key) => keys.has(key),
      toggleMyList: async (key, title) => {
        if (!viewer) return;
        if (keys.has(key)) {
          setMyList((l) => l.filter((i) => i.key !== key));
          await removeFromMyList(viewer.uid, key);
        } else {
          setMyList((l) => [...l, { key, title, addedAt: new Date(), seen: false }]);
          await addToMyList(viewer.uid, key, title);
        }
      },
      setSeen: async (key, seen) => {
        if (!viewer) return;
        setMyList((l) => l.map((i) => (i.key === key ? { ...i, seen } : i)));
        await setSeenOnMyList(viewer.uid, key, seen);
      },
    };
  }, [viewer, suggestions, comments, votes, myList, reload]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const s = useContext(SocialContext);
  if (!s) throw new Error('useSocial outside SocialProvider');
  return s;
}
