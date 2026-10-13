import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type PlaylistDetail, type Track } from '@/api/client';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Screen, useBottomSpace } from '@/components/Screen';
import { Sheet, SheetRow } from '@/components/Sheet';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/hooks/useTheme';
import { formatLongDuration, pluralise } from '@/lib/format';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Number(id);

  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomSpace(Spacing.lg);

  const library = useLibrary();
  const player = usePlayer();
  const { prompt, confirm } = useOverlays();

  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchDetail = async () => {
      try {
        const data = await api.getPlaylist(playlistId);
        if (cancelled) return;
        setDetail(data);
        setStatus('ready');
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Could not load this playlist.');
        setStatus('error');
      }
    };

    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [playlistId, reloadToken]);

  const tracks = useMemo(() => detail?.tracks ?? [], [detail]);
  const totalDuration = useMemo(
    () => tracks.reduce((total, track) => total + (track.duration ?? 0), 0),
    [tracks],
  );

  const removeTrack = async (track: Track) => {
    const updated = await library.removeTrackFromPlaylist(playlistId, track.id);
    setDetail(updated);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    const next = [...tracks];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    setDetail((current) => (current ? { ...current, tracks: next } : current));
    const updated = await library.reorderPlaylist(
      playlistId,
      next.map((track) => track.id),
    );
    setDetail(updated);
  };

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Playlist unavailable"
          message={error ?? undefined}
          actionLabel="Try again"
          onAction={() => setReloadToken((token) => token + 1)}
        />
      </View>
    );
  }

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="chevron-back" size={24} />
        </Pressable>
        <Pressable
          hitSlop={12}
          onPress={() =>
            confirm({
              title: `Delete "${detail.name}"?`,
              message: 'This removes the playlist for everyone. The tracks stay in the library.',
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: async () => {
                await library.deletePlaylist(playlistId);
                router.back();
              },
            })
          }
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="trash-outline" size={20} muted />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={[styles.heroArt, { backgroundColor: detail.accent }]}>
          <Icon name="musical-notes" size={44} color="rgba(255,255,255,0.92)" />
        </View>

        <View style={styles.heroText}>
          <Pressable
            onPress={() =>
              prompt({
                title: 'Rename playlist',
                initialValue: detail.name,
                confirmLabel: 'Save',
                onSubmit: async (name) => {
                  setDetail(await library.updatePlaylist(playlistId, { name }));
                },
              })
            }>
            <Text style={[styles.name, { color: theme.text }]}>{detail.name}</Text>
          </Pressable>

          {detail.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {detail.description}
            </Text>
          ) : null}

          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {pluralise(tracks.length, 'track')} · {formatLongDuration(totalDuration)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => tracks.length && player.playQueue(tracks, 0)}
          disabled={!tracks.length}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.primary, opacity: tracks.length ? 1 : 0.5 },
            pressed && styles.pressed,
          ]}>
          <Icon name="play" size={18} color={theme.onPrimary} />
          <Text style={[styles.playButtonText, { color: theme.onPrimary }]}>Play</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!tracks.length) return;
            const shuffled = [...tracks];
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
            }
            player.playQueue(shuffled, 0);
          }}
          disabled={!tracks.length}
          style={({ pressed }) => [
            styles.ghostButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              opacity: tracks.length ? 1 : 0.5,
            },
            pressed && styles.pressed,
          ]}>
          <Icon name="shuffle" size={17} />
          <Text style={[styles.ghostButtonText, { color: theme.text }]}>Shuffle</Text>
        </Pressable>

        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.ghostButton,
            { borderColor: theme.border, backgroundColor: theme.surface },
            pressed && styles.pressed,
          ]}>
          <Icon name="add" size={17} />
          <Text style={[styles.ghostButtonText, { color: theme.text }]}>Add songs</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen padBottom={false}>
      <FlatList
        data={tracks}
        keyExtractor={(track) => String(track.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: bottom }}
        ListEmptyComponent={
          <EmptyState
            icon="add-circle-outline"
            title="This playlist is empty"
            message="Add songs from the library to build it up."
            actionLabel="Add songs"
            onAction={() => setAddOpen(true)}
          />
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            active={player.currentTrack?.id === item.id}
            playing={player.isPlaying}
            onPress={() => player.playTrack(item, tracks)}
            trailing={
              <View style={styles.rowControls}>
                <Pressable
                  hitSlop={6}
                  onPress={() => void move(index, -1)}
                  disabled={index === 0}
                  style={[styles.smallButton, index === 0 && styles.disabled]}>
                  <Icon name="chevron-up" size={16} muted />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => void move(index, 1)}
                  disabled={index === tracks.length - 1}
                  style={[styles.smallButton, index === tracks.length - 1 && styles.disabled]}>
                  <Icon name="chevron-down" size={16} muted />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => void removeTrack(item)}
                  style={styles.smallButton}>
                  <Icon name="remove-circle-outline" size={17} color={theme.textMuted} />
                </Pressable>
              </View>
            }
          />
        )}
      />

      {addOpen ? (
        <AddSongsSheet
          onClose={() => setAddOpen(false)}
          existingIds={tracks.map((track) => track.id)}
          onAdd={async (track) => {
            const updated = await library.addTrackToPlaylist(playlistId, track.id);
            setDetail(updated);
          }}
        />
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
function AddSongsSheet({
  onClose,
  existingIds,
  onAdd,
}: {
  onClose: () => void;
  existingIds: number[];
  onAdd: (track: Track) => Promise<void>;
}) {
  const theme = useTheme();
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 160);
  const [added, setAdded] = useState<number[]>([]);

  const results = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    return library.tracks
      .filter((track) =>
        needle
          ? track.title.toLowerCase().includes(needle) ||
            track.artist.toLowerCase().includes(needle)
          : true,
      )
      .slice(0, 120);
  }, [library.tracks, debounced]);

  const existing = new Set([...existingIds, ...added]);

  return (
    <Sheet visible onClose={onClose} title="Add songs" maxHeightRatio={0.85} scrollable>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Filter the library…"
        autoCorrect={false}
        leading={<Icon name="search" size={18} color={theme.textMuted} />}
        rounded={false}
      />
      <ScrollView style={styles.sheetList} nestedScrollEnabled>
        {results.map((track) => {
          const inPlaylist = existing.has(track.id);
          return (
            <SheetRow
              key={track.id}
              label={track.title}
              detail={`${track.artist} · ${track.album}`}
              selected={inPlaylist}
              icon={
                <Icon
                  name={inPlaylist ? 'checkmark-circle' : 'add-circle-outline'}
                  size={20}
                  color={inPlaylist ? theme.primary : theme.textSecondary}
                />
              }
              onPress={() => {
                if (inPlaylist) return;
                setAdded((current) => [...current, track.id]);
                void onAdd(track);
              }}
            />
          );
        })}
        {!results.length ? (
          <Text style={[styles.sheetEmpty, { color: theme.textSecondary }]}>
            Nothing matched that search.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  iconButton: {
    padding: Spacing.sm,
  },
  hero: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  heroArt: {
    width: 108,
    height: 108,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  meta: {
    fontSize: 12.5,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    flexWrap: 'wrap',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    height: 42,
    borderRadius: Radius.pill,
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 42,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghostButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    padding: Spacing.xs,
  },
  disabled: {
    opacity: 0.3,
  },
  sheetList: {
    maxHeight: 360,
    marginTop: Spacing.sm,
  },
  sheetEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  pressed: {
    opacity: 0.75,
  },
});
