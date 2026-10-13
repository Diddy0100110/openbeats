/**
 * App-wide sheets: track menus, "add to playlist", text prompts and
 * confirmations.
 *
 * Everything lives in one provider so any row anywhere can call
 * `openTrackActions(track)` without each screen owning boilerplate. Using our
 * own sheets (instead of `Alert`) also keeps the UX identical on web, where
 * React Native's `Alert` is a no-op.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { CoverArt } from '@/components/CoverArt';
import { Sheet, SheetRow } from '@/components/Sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { pluralise } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useLibrary } from '@/state/library';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
};

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

type OverlaysContextValue = {
  openTrackActions: (track: Track) => void;
  openAddToPlaylist: (track: Track) => void;
  prompt: (options: PromptOptions) => void;
  confirm: (options: ConfirmOptions) => void;
};

const OverlaysContext = createContext<OverlaysContextValue | null>(null);

export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [addTarget, setAddTarget] = useState<Track | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);

  const value = useMemo<OverlaysContextValue>(
    () => ({
      openTrackActions: setTrack,
      openAddToPlaylist: setAddTarget,
      prompt: (options) => {
        setPromptValue(options.initialValue ?? '');
        setPromptState(options);
      },
      confirm: setConfirmState,
    }),
    [],
  );

  return (
    <OverlaysContext.Provider value={value}>
      {children}

      <TrackActionsSheet
        track={track}
        onClose={() => setTrack(null)}
        onAddToPlaylist={(next) => {
          setTrack(null);
          setAddTarget(next);
        }}
      />

      <AddToPlaylistSheet track={addTarget} onClose={() => setAddTarget(null)} />

      <PromptSheet
        options={promptState}
        value={promptValue}
        onChange={setPromptValue}
        onClose={() => setPromptState(null)}
        onConfirm={async () => {
          const current = promptState;
          const text = promptValue.trim();
          setPromptState(null);
          if (current && text) await current.onSubmit(text);
        }}
      />

      <ConfirmSheet options={confirmState} onClose={() => setConfirmState(null)} />
    </OverlaysContext.Provider>
  );
}

export function useOverlays(): OverlaysContextValue {
  const context = useContext(OverlaysContext);
  if (!context) throw new Error('useOverlays must be used inside <OverlaysProvider>');
  return context;
}

// ---------------------------------------------------------------------------
function TrackActionsSheet({
  track,
  onClose,
  onAddToPlaylist,
}: {
  track: Track | null;
  onClose: () => void;
  onAddToPlaylist: (track: Track) => void;
}) {
  const theme = useTheme();
  const player = usePlayer();
  const library = useLibrary();
  const favorites = useFavorites();
  const { prompt, confirm } = useOverlays();

  const isFavorite = track ? favorites.isFavorite(track.id) : false;
  const inQueue = track ? player.queue.some((item) => item.id === track.id) : false;
  const isUpload = track?.origin === 'upload';

  return (
    <Sheet visible={Boolean(track)} onClose={onClose} maxHeightRatio={0.85} scrollable>
      {track ? (
        <>
          <View style={styles.header}>
            <CoverArt track={track} size={52} />
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={[styles.headerSub, { color: theme.textSecondary }]}>
                {track.artist} · {track.album}
              </Text>
              {track.attribution ? (
                <Text numberOfLines={2} style={[styles.attribution, { color: theme.textMuted }]}>
                  {track.attribution}
                </Text>
              ) : null}
            </View>
          </View>

          <SheetRow
            label="Play now"
            icon={<Icon name="play-circle" size={20} muted />}
            onPress={() => {
              player.playTrack(track, library.tracks.length ? library.tracks : [track]);
              onClose();
            }}
          />
          <SheetRow
            label="Play next"
            icon={<Icon name="play-skip-forward" size={20} muted />}
            onPress={() => {
              player.playNext(track);
              onClose();
            }}
          />
          <SheetRow
            label={inQueue ? 'Add to queue again' : 'Add to queue'}
            icon={<Icon name="list" size={20} muted />}
            onPress={() => {
              player.addToQueue(track);
              onClose();
            }}
          />
          <SheetRow
            label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            icon={<Icon name={isFavorite ? 'heart' : 'heart-outline'} size={20} muted />}
            onPress={() => {
              favorites.toggleFavorite(track.id);
              onClose();
            }}
          />
          <SheetRow
            label="Add to playlist…"
            icon={<Icon name="add-circle-outline" size={20} muted />}
            onPress={() => onAddToPlaylist(track)}
          />
          {isUpload ? (
            <>
              <SheetRow
                label="Edit details"
                icon={<Icon name="create-outline" size={20} muted />}
                onPress={() => {
                  const current = track;
                  onClose();
                  prompt({
                    title: 'Edit track',
                    message: 'Update the title shown everywhere in the library.',
                    initialValue: current.title,
                    confirmLabel: 'Save',
                    onSubmit: async (title) => {
                    await library.updateTrack(current.id, { title });
                  },
                  });
                }}
              />
              <SheetRow
                label="Delete upload"
                destructive
                icon={<Icon name="trash-outline" size={20} color={theme.danger} />}
                onPress={() => {
                  const current = track;
                  onClose();
                  confirm({
                    title: `Delete "${current.title}"?`,
                    message: 'The audio file is removed from the server for everyone.',
                    confirmLabel: 'Delete',
                    destructive: true,
                    onConfirm: async () => {
                      for (let i = player.queue.length - 1; i >= 0; i -= 1) {
                        if (player.queue[i]!.id === current.id) player.removeAt(i);
                      }
                      await library.deleteTrack(current.id);
                    },
                  });
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
function AddToPlaylistSheet({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const theme = useTheme();
  const library = useLibrary();
  const { prompt } = useOverlays();
  const [busy, setBusy] = useState<number | null>(null);

  const add = async (playlistId: number) => {
    if (!track) return;
    setBusy(playlistId);
    try {
      await library.addTrackToPlaylist(playlistId, track.id);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      visible={Boolean(track)}
      onClose={onClose}
      title="Add to playlist"
      subtitle={track?.title}
      scrollable
      maxHeightRatio={0.7}>
      <SheetRow
        label="New playlist…"
        icon={<Icon name="add" size={20} color={theme.primary} />}
        onPress={() => {
          const current = track;
          onClose();
          if (!current) return;
          prompt({
            title: 'New playlist',
            placeholder: 'Playlist name',
            confirmLabel: 'Create',
            onSubmit: async (name) => {
              const created = await library.createPlaylist({ name });
              await library.addTrackToPlaylist(created.id, current.id);
            },
          });
        }}
      />

      {library.playlists.map((playlist) => (
        <SheetRow
          key={playlist.id}
          label={playlist.name}
          detail={pluralise(playlist.track_count, 'track')}
          icon={
            busy === playlist.id ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Icon name="list" size={20} muted />
            )
          }
          onPress={() => void add(playlist.id)}
        />
      ))}

      {!library.playlists.length ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          You have no playlists yet — create the first one above.
        </Text>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
function PromptSheet({
  options,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  options: PromptOptions | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const theme = useTheme();

  return (
    <Sheet
      visible={Boolean(options)}
      onClose={onClose}
      title={options?.title}
      subtitle={options?.message}
      maxHeightRatio={0.6}>
      <Input
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder={options?.placeholder ?? 'Type here…'}
        returnKeyType="done"
        onSubmitEditing={() => void onConfirm()}
        rounded={false}
      />
      <View style={styles.actions}>
        <Text
          onPress={onClose}
          style={[styles.actionText, { color: theme.textSecondary }]}>
          Cancel
        </Text>
        <Text
          onPress={() => (value.trim() ? void onConfirm() : undefined)}
          style={[
            styles.actionText,
            styles.actionPrimary,
            { color: value.trim() ? theme.primary : theme.textMuted },
          ]}>
          {options?.confirmLabel ?? 'Save'}
        </Text>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
function ConfirmSheet({
  options,
  onClose,
}: {
  options: ConfirmOptions | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Sheet
      visible={Boolean(options)}
      onClose={onClose}
      title={options?.title}
      subtitle={options?.message}
      maxHeightRatio={0.55}>
      <View style={styles.actions}>
        <Text onPress={onClose} style={[styles.actionText, { color: theme.textSecondary }]}>
          Cancel
        </Text>
        {busy ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Text
            onPress={() => void run()}
            style={[
              styles.actionText,
              styles.actionPrimary,
              { color: options?.destructive ? theme.danger : theme.primary },
            ]}>
            {options?.confirmLabel ?? 'Confirm'}
          </Text>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    paddingBottom: Spacing.md,
    marginBottom: Spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  attribution: {
    fontSize: 11,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingTop: Spacing.lg,
    minHeight: 48,
    borderRadius: Radius.md,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionPrimary: {
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
});
