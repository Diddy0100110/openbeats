/** Shared library state: the catalogue, playlists, facets and stats. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  api,
  describeError,
  type Facets,
  type Playlist,
  type PlaylistDetail,
  type Stats,
  type Track,
  type TrackUpdate,
  type UploadAsset,
} from '@/api/client';

type LibraryStatus = 'loading' | 'ready' | 'error';

type LibraryContextValue = {
  status: LibraryStatus;
  error: string | null;
  tracks: Track[];
  trackMap: Map<number, Track>;
  playlists: Playlist[];
  facets: Facets;
  stats: Stats | null;
  refresh: () => Promise<void>;
  getTrack: (id: number) => Track | undefined;
  createPlaylist: (input: { name: string; description?: string; accent?: string }) => Promise<PlaylistDetail>;
  updatePlaylist: (id: number, input: { name?: string; description?: string; accent?: string }) => Promise<PlaylistDetail>;
  deletePlaylist: (id: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, trackId: number) => Promise<PlaylistDetail>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<PlaylistDetail>;
  reorderPlaylist: (playlistId: number, trackIds: number[]) => Promise<PlaylistDetail>;
  uploadTrack: (asset: UploadAsset, meta?: Record<string, string | undefined>) => Promise<Track>;
  updateTrack: (id: number, patch: TrackUpdate) => Promise<Track>;
  deleteTrack: (id: number) => Promise<void>;
};

const EMPTY_FACETS: Facets = { artists: [], albums: [], genres: [] };

/** One round-trip for everything the UI needs to render the library. */
async function fetchLibrary() {
  const [page, playlistList, facetData, statData] = await Promise.all([
    api.listTracks({ sort: 'title', order: 'asc', limit: 1000 }),
    api.listPlaylists(),
    api.facets(),
    api.stats(),
  ]);
  return {
    tracks: page.items,
    playlists: playlistList,
    facets: facetData,
    stats: statData,
  };
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [stats, setStats] = useState<Stats | null>(null);

  const trackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track] as const)),
    [tracks],
  );

  const refresh = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    try {
      const data = await fetchLibrary();
      setTracks(data.tracks);
      setPlaylists(data.playlists);
      setFacets(data.facets);
      setStats(data.stats);
      setError(null);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the library.');
      setStatus('error');
    }
  }, []);

  // Initial load. Deliberately inline (rather than just calling `refresh`) so
  // no state is set synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchLibrary();
        if (cancelled) return;
        setTracks(data.tracks);
        setPlaylists(data.playlists);
        setFacets(data.facets);
        setStats(data.stats);
        setError(null);
        setStatus('ready');
      } catch (cause) {
        if (cancelled) return;
        setError(describeError(cause));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncPlaylistSummaries = useCallback(async () => {
    try {
      setPlaylists(await api.listPlaylists());
    } catch {
      // A stale sidebar is not worth surfacing an error for.
    }
  }, []);

  const syncStats = useCallback(async () => {
    try {
      setStats(await api.stats());
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LibraryContextValue>(() => {
    const afterPlaylistWrite = async (detail: PlaylistDetail) => {
      await syncPlaylistSummaries();
      return detail;
    };

    return {
      status,
      error,
      tracks,
      trackMap,
      playlists,
      facets,
      stats,
      refresh,
      getTrack: (id: number) => trackMap.get(id),

      createPlaylist: async (input) => afterPlaylistWrite(await api.createPlaylist(input)),

      updatePlaylist: async (id, input) => afterPlaylistWrite(await api.updatePlaylist(id, input)),

      deletePlaylist: async (id) => {
        await api.deletePlaylist(id);
        await syncPlaylistSummaries();
        await syncStats();
      },

      addTrackToPlaylist: async (playlistId, trackId) =>
        afterPlaylistWrite(await api.addTrackToPlaylist(playlistId, trackId)),

      removeTrackFromPlaylist: async (playlistId, trackId) =>
        afterPlaylistWrite(await api.removeTrackFromPlaylist(playlistId, trackId)),

      reorderPlaylist: async (playlistId, trackIds) =>
        afterPlaylistWrite(await api.reorderPlaylist(playlistId, trackIds)),

      uploadTrack: async (asset, meta = {}) => {
        const created = await api.uploadTrack(asset, meta);
        setTracks((current) =>
          [...current, created].sort((a, b) => a.title.localeCompare(b.title)),
        );
        void syncStats();
        void api.facets().then(setFacets).catch(() => {});
        return created;
      },

      updateTrack: async (id, patch) => {
        const updated = await api.updateTrack(id, patch);
        setTracks((current) => current.map((track) => (track.id === id ? updated : track)));
        void api.facets().then(setFacets).catch(() => {});
        return updated;
      },

      deleteTrack: async (id) => {
        await api.deleteTrack(id);
        setTracks((current) => current.filter((track) => track.id !== id));
        await syncPlaylistSummaries();
        await syncStats();
        void api.facets().then(setFacets).catch(() => {});
      },
    };
  }, [
    status, error, tracks, trackMap, playlists, facets, stats,
    refresh, syncPlaylistSummaries, syncStats,
  ]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return context;
}
