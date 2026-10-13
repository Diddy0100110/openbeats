import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PlaylistCard } from '@/components/PlaylistCard';
import { Screen, useBottomSpace } from '@/components/Screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatLongDuration } from '@/lib/format';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import { api, type Playlist } from '@/api/client';
export default function PlaylistsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottom = useBottomSpace(Spacing.lg);

  const library = useLibrary();
  const player = usePlayer();
  const { prompt, confirm } = useOverlays();

  const columns = width >= 760 ? 3 : 2;
  const horizontalPadding = Spacing.lg * 2;
  const gaps = Spacing.md * (columns - 1);
  const cardSize = Math.floor(
    (Math.min(width, 900) - horizontalPadding - gaps) / columns,
  );

  const createPlaylist = () => {
    prompt({
      title: 'New playlist',
      message: 'Playlists are shared with everyone who opens this link.',
      placeholder: 'Playlist name',
      confirmLabel: 'Create',
      onSubmit: async (name) => {
        const created = await library.createPlaylist({ name });
        router.push(`/playlist/${created.id}`);
      },
    });
  };

  const openMenu = (playlist: Playlist) => {
    confirm({
      title: `"${playlist.name}"`,
      message: `${playlist.track_count} tracks · ${formatLongDuration(playlist.total_duration)}`,
      confirmLabel: 'Delete playlist',
      destructive: true,
      onConfirm: () => library.deletePlaylist(playlist.id),
    });
  };

  const playPlaylist = async (playlist: Playlist) => {
    const detail = await api.getPlaylist(playlist.id);
    if (detail.tracks.length) player.playQueue(detail.tracks, 0);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>Playlists</Text>
        <Pressable
          onPress={createPlaylist}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <Icon name="add" size={18} color={theme.onPrimary} />
          <Text style={[styles.newButtonText, { color: theme.onPrimary }]}>New</Text>
        </Pressable>
      </View>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Shared with everyone who opens the link
      </Text>
    </View>
  );

  const data = useMemo(() => library.playlists, [library.playlists]);

  return (
    <Screen padBottom={false}>
      <FlatList
        data={data}
        key={`cols-${columns}`}
        numColumns={columns}
        keyExtractor={(playlist) => String(playlist.id)}
        ListHeaderComponent={header}
        columnWrapperStyle={columns > 1 ? styles.column : undefined}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={library.status === 'loading'}
            onRefresh={() => void library.refresh()}
            tintColor={theme.textSecondary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="albums-outline"
            title="No playlists yet"
            message="Group tracks into playlists — they are stored on the server, so everyone sees them."
            actionLabel="Create playlist"
            onAction={createPlaylist}
          />
        }
        renderItem={({ item }) => (
          <PlaylistCard
            playlist={item}
            size={cardSize}
            onPress={() => router.push(`/playlist/${item.id}`)}
            onLongPress={() => openMenu(item)}
            onPlay={() => void playPlaylist(item)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  column: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  pressed: {
    opacity: 0.75,
  },
});
