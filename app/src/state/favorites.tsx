/**
 * Favourites and "recently played" live on the device, not the server.
 *
 * The library itself is intentionally shared and account-less, so each visitor
 * still gets their own personal shortcuts without anyone having to log in.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loadJSON, saveJSON } from '@/lib/storage';

const FAVORITES_KEY = 'favorites';
const RECENT_KEY = 'recent';
const RECENT_LIMIT = 40;

type FavoritesContextValue = {
  ready: boolean;
  favoriteIds: number[];
  recentIds: number[];
  isFavorite: (trackId: number) => boolean;
  toggleFavorite: (trackId: number) => void;
  markPlayed: (trackId: number) => void;
  clearRecent: () => void;
  clearFavorites: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedFavorites, storedRecent] = await Promise.all([
        loadJSON<number[]>(FAVORITES_KEY, []),
        loadJSON<number[]>(RECENT_KEY, []),
      ]);
      if (cancelled) return;
      setFavoriteIds(Array.isArray(storedFavorites) ? storedFavorites : []);
      setRecentIds(Array.isArray(storedRecent) ? storedRecent : []);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = useCallback((trackId: number) => {
    setFavoriteIds((current) => {
      const next = current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [trackId, ...current];
      void saveJSON(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const markPlayed = useCallback((trackId: number) => {
    setRecentIds((current) => {
      const next = [trackId, ...current.filter((id) => id !== trackId)].slice(0, RECENT_LIMIT);
      void saveJSON(RECENT_KEY, next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentIds([]);
    void saveJSON(RECENT_KEY, []);
  }, []);

  const clearFavorites = useCallback(() => {
    setFavoriteIds([]);
    void saveJSON(FAVORITES_KEY, []);
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ready,
      favoriteIds,
      recentIds,
      isFavorite: (trackId: number) => favoriteSet.has(trackId),
      toggleFavorite,
      markPlayed,
      clearRecent,
      clearFavorites,
    }),
    [ready, favoriteIds, recentIds, favoriteSet, toggleFavorite, markPlayed, clearRecent, clearFavorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return context;
}
