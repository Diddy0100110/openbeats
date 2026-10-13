/**
 * The playback engine.
 *
 * `expo-audio`'s `AudioPlaylist` plays a native queue, which gives us
 * gapless-ish playback, real `next()`/`previous()` and loop modes for free.
 * Its source list, however, is only read when the playlist is created â€” so this
 * provider treats the **React queue as the source of truth** and rebuilds the
 * native playlist whenever that queue actually changes, restoring the current
 * track and play position afterwards.
 *
 * A consequence worth knowing: editing the queue restarts the current track at
 * its saved position. Normal next/previous/auto-advance do not touch the queue
 * at all, so they stay seamless.
 */
import {
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
} from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, mediaUrl, type Track } from '@/api/client';
import { useFavorites } from '@/state/favorites';

export type RepeatMode = 'off' | 'all' | 'one';

type Pending = { index: number; autoplay: boolean; position: number };

type PlayerContextValue = {
  queue: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  position: number;
  duration: number;
  progress: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  rate: number;

  playQueue: (tracks: Track[], startIndex?: number) => void;
  playTrack: (track: Track, context?: Track[]) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => RepeatMode;
  setVolume: (value: number) => void;
  setRate: (value: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const EMPTY: Track[] = [];

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { markPlayed } = useFavorites();
  const playlist = useAudioPlaylist({ updateInterval: 250, loop: 'none' });
  const status = useAudioPlaylistStatus(playlist);

  const [queue, setQueue] = useState<Track[]>(EMPTY);
  const [version, setVersion] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);
  const [rate, setRateState] = useState(1);

  const queueRef = useRef<Track[]>(EMPTY);
  const pendingRef = useRef<Pending>({ index: 0, autoplay: false, position: 0 });
  const liveRef = useRef({ index: 0, playing: false, position: 0 });
  const unshuffledRef = useRef<Track[] | null>(null);
  const retriedRef = useRef(false);

  // --- derived state -------------------------------------------------------
  const currentIndex = queue.length
    ? Math.min(Math.max(status.currentIndex ?? 0, 0), queue.length - 1)
    : 0;
  const currentTrack = queue[currentIndex] ?? null;
  const isPlaying = Boolean(status.playing);
  const position = status.currentTime ?? 0;

  const duration = useMemo(() => {
    const fromPlayer = status.duration ?? 0;
    if (fromPlayer > 0) return fromPlayer;
    return currentTrack?.duration ?? 0;
  }, [status.duration, currentTrack?.duration]);

  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  // Keep a render-fresh snapshot for callbacks that must not re-create.
  useEffect(() => {
    liveRef.current = { index: currentIndex, playing: isPlaying, position };
  }, [currentIndex, isPlaying, position]);

  // --- configure the audio session once ------------------------------------
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {
      // Not supported on every platform (notably web) â€” safe to ignore.
    });
  }, []);

  // --- write the queue into the native playlist ----------------------------
  useEffect(() => {
    const tracks = queueRef.current;
    const pending = pendingRef.current;

    try {
      playlist.clear();
    } catch {
      // The native object may not be attached yet; the retry below covers it.
    }

    for (const track of tracks) {
      try {
        playlist.add({ uri: mediaUrl(track), name: track.title });
      } catch {
        // ignore individual add failures
      }
    }

    if (!tracks.length) return;

    const index = Math.min(Math.max(pending.index, 0), tracks.length - 1);
    try {
      playlist.skipTo(index);
      if (pending.position > 0.5) void playlist.seekTo(pending.position);
      if (pending.autoplay) playlist.play();
    } catch {
      // ignore
    }
  }, [version, playlist]);

  // Safety net: if the native playlist stayed empty, try once more.
  useEffect(() => {
    if (retriedRef.current) return;
    if (!queueRef.current.length) return;
    if ((status.trackCount ?? 0) > 0) return;

    const timer = setTimeout(() => {
      retriedRef.current = true;
      setVersion((value) => value + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [status.trackCount]);

  // --- settings mirrored onto the native player ----------------------------
  // `AudioPlaylist` exposes loop/volume/playbackRate as writable properties —
  // that is the documented API (there are no setters). The React Compiler's
  // immutability rule cannot see that these are native shared objects, so it is
  // silenced deliberately here rather than working around a real API.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/immutability -- native property, see note above
      playlist.loop = repeat === 'one' ? 'single' : repeat === 'all' ? 'all' : 'none';
    } catch {
      // ignore
    }
  }, [repeat, playlist]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/immutability -- native property, see note above
      playlist.volume = volume;
    } catch {
      // ignore
    }
  }, [volume, playlist]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/immutability -- native property, see note above
      playlist.playbackRate = rate;
    } catch {
      // ignore
    }
  }, [rate, playlist]);

  // --- analytics: count a play after 15s of real listening -----------------
  const countedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentTrack || position < 15) return;
    if (countedRef.current === currentTrack.id) return;
    countedRef.current = currentTrack.id;
    api.registerPlay(currentTrack.id).catch(() => {});
  }, [currentTrack, position]);

  // --- keep a per-device "recently played" list ----------------------------
  const lastTrackIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentTrack) return;
    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;
    markPlayed(currentTrack.id);
  }, [currentTrack, markPlayed]);

  // --- back-fill durations we only learn at playback time ------------------
  const reportedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentTrack || currentTrack.duration) return;
    if (!status.duration || status.duration <= 0) return;
    if (reportedRef.current === currentTrack.id) return;
    reportedRef.current = currentTrack.id;
    api.reportDuration(currentTrack.id, status.duration).catch(() => {});
  }, [currentTrack, status.duration]);

  // --- actions -------------------------------------------------------------
  const commit = useCallback((next: Track[], pending: Pending) => {
    queueRef.current = next;
    pendingRef.current = pending;
    setQueue(next);
    setVersion((value) => value + 1);
  }, []);

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (!tracks.length) return;
      const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
      retriedRef.current = false;
      commit(tracks, { index, autoplay: true, position: 0 });
    },
    [commit],
  );

  const playTrack = useCallback(
    (track: Track, context?: Track[]) => {
      const list = context && context.length ? context : [track];
      const index = list.findIndex((item) => item.id === track.id);
      playQueue(list, index < 0 ? 0 : index);
    },
    [playQueue],
  );

  const resume = useCallback(() => {
    try {
      playlist.play();
    } catch {
      // ignore
    }
  }, [playlist]);

  const pause = useCallback(() => {
    try {
      playlist.pause();
    } catch {
      // ignore
    }
  }, [playlist]);

  const toggle = useCallback(() => {
    if (!queueRef.current.length) return;
    if (liveRef.current.playing) pause();
    else resume();
  }, [pause, resume]);

  const next = useCallback(() => {
    if (!queueRef.current.length) return;
    try {
      playlist.next();
    } catch {
      // ignore
    }
  }, [playlist]);

  const previous = useCallback(() => {
    if (!queueRef.current.length) return;
    try {
      // Behave like every other player: restart the track when past 3 seconds.
      if (liveRef.current.position > 3) playlist.seekTo(0);
      else playlist.previous();
    } catch {
      // ignore
    }
  }, [playlist]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= queueRef.current.length) return;
      try {
        playlist.skipTo(index);
        playlist.play();
      } catch {
        // ignore
      }
    },
    [playlist],
  );

  const seek = useCallback(
    (seconds: number) => {
      try {
        void playlist.seekTo(Math.max(0, seconds));
      } catch {
        // ignore
      }
    },
    [playlist],
  );

  const seekBy = useCallback(
    (delta: number) => {
      seek(liveRef.current.position + delta);
    },
    [seek],
  );

  /** Insert without disturbing what is currently playing. */
  const insertAt = useCallback(
    (track: Track, index: number) => {
      const current = queueRef.current;
      const next = [...current.slice(0, index), track, ...current.slice(index)];
      const wasCurrent = liveRef.current.index >= index;
      commit(next, {
        index: wasCurrent ? liveRef.current.index + 1 : liveRef.current.index,
        autoplay: liveRef.current.playing,
        position: liveRef.current.position,
      });
    },
    [commit],
  );

  const addToQueue = useCallback(
    (track: Track) => insertAt(track, queueRef.current.length),
    [insertAt],
  );

  const playNext = useCallback(
    (track: Track) => insertAt(track, liveRef.current.index + 1),
    [insertAt],
  );

  const removeAt = useCallback(
    (index: number) => {
      const current = queueRef.current;
      if (index < 0 || index >= current.length) return;

      const next = current.filter((_, position) => position !== index);
      if (!next.length) {
        commit([], { index: 0, autoplay: false, position: 0 });
        return;
      }

      const removingCurrent = index === liveRef.current.index;
      const target = removingCurrent
        ? Math.min(index, next.length - 1)
        : index < liveRef.current.index
          ? liveRef.current.index - 1
          : liveRef.current.index;

      commit(next, {
        index: target,
        autoplay: liveRef.current.playing,
        position: removingCurrent ? 0 : liveRef.current.position,
      });
    },
    [commit],
  );

  const move = useCallback(
    (from: number, to: number) => {
      const current = queueRef.current;
      if (from === to || from < 0 || from >= current.length) return;
      const target = Math.min(Math.max(to, 0), current.length - 1);

      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(target, 0, moved);

      const playingId = current[liveRef.current.index]?.id;
      const index = Math.max(0, next.findIndex((track) => track.id === playingId));

      commit(next, {
        index,
        autoplay: liveRef.current.playing,
        position: liveRef.current.position,
      });
    },
    [commit],
  );

  const clearQueue = useCallback(() => {
    commit([], { index: 0, autoplay: false, position: 0 });
  }, [commit]);

  const toggleShuffle = useCallback(() => {
    const current = queueRef.current;
    if (!current.length) {
      setShuffle((value) => !value);
      return;
    }

    const playingId = current[liveRef.current.index]?.id;

    if (!shuffle) {
      unshuffledRef.current = current;
      const nowPlaying = current[liveRef.current.index];
      const rest = current.filter((_, index) => index !== liveRef.current.index);
      for (let i = rest.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      }
      const next = nowPlaying ? [nowPlaying, ...rest] : rest;
      setShuffle(true);
      commit(next, {
        index: 0,
        autoplay: liveRef.current.playing,
        position: liveRef.current.position,
      });
      return;
    }

    const restored = unshuffledRef.current ?? current;
    const index = Math.max(0, restored.findIndex((track) => track.id === playingId));
    setShuffle(false);
    commit(restored, {
      index,
      autoplay: liveRef.current.playing,
      position: liveRef.current.position,
    });
  }, [commit, shuffle]);

  const cycleRepeat = useCallback((): RepeatMode => {
    let nextMode: RepeatMode = 'off';
    setRepeat((current) => {
      nextMode = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
      return nextMode;
    });
    return nextMode;
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.min(1, Math.max(0, value)));
  }, []);

  const setRate = useCallback((value: number) => {
    setRateState(Math.min(2, Math.max(0.5, value)));
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentTrack,
      currentIndex,
      isPlaying,
      isBuffering: Boolean(status.isBuffering),
      isLoaded: Boolean(status.isLoaded),
      position,
      duration,
      progress,
      shuffle,
      repeat,
      volume,
      rate,
      playQueue,
      playTrack,
      toggle,
      play: resume,
      pause,
      next,
      previous,
      jumpTo,
      seek,
      seekBy,
      addToQueue,
      playNext,
      removeAt,
      move,
      clearQueue,
      toggleShuffle,
      cycleRepeat,
      setVolume,
      setRate,
    }),
    [
      queue, currentTrack, currentIndex, isPlaying, status.isBuffering, status.isLoaded,
      position, duration, progress, shuffle, repeat, volume, rate,
      playQueue, playTrack, toggle, resume, pause, next, previous, jumpTo, seek, seekBy,
      addToQueue, playNext, removeAt, move, clearQueue, toggleShuffle, cycleRepeat,
      setVolume, setRate,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}
