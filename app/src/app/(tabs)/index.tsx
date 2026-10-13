import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PlaylistCard } from '@/components/PlaylistCard';
import { Screen, useBottomSpace } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';import { useTheme } from '@/hooks/useTheme';
import { formatCount, formatLongDuration, pluralise } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomSpace(Spacing.lg);

  const library = useLibrary();
  const player = usePlayer();
  const favorites = useFavorites();
  const { openTrackActions } = useOverlays();

  const recentTracks = useMemo(
    () =>
      favorites.recentIds
        .map((id) => library.trackMap.get(id))
        .filter((track): track is Track => Boolean(track))
        .slice(0, 12),
    [favorites.recentIds, library.trackMap],
  );

  const isEmpty = !library.tracks.length;
  const isLoading = library.status === 'loading' && isEmpty;

  const playAllSongs = () => player.playQueue(library.tracks, 0);

  const shuffleAll = () => {
    const shuffled = [...library.tracks];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    player.playQueue(shuffled, 0);
  };

  const header = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, { color: theme.text }]}>
            Open<Text style={{ color: theme.primary }}>Beats</Text>
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
            <Icon name="settings-outline" size={20} muted />
          </Pressable>
        </View>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>
          {library.stats
            ? `${pluralise(library.stats.tracks, 'track')} · ${pluralise(library.stats.albums, 'album')} · ${formatLongDuration(library.stats.total_duration)}`
            : 'Your shared music library'}
        </Text>

        <View style={styles.heroActions}>
          <Pressable
            onPress={shuffleAll}
            disabled={isEmpty}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary, opacity: isEmpty ? 0.5 : 1 },
              pressed && styles.pressed,
            ]}>
            <Icon name="shuffle" size={18} color={theme.onPrimary} />
            <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Shuffle all</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/upload')}
            style={({ pressed }) => [
              styles.ghostButton,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}>
            <Icon name="cloud-upload-outline" size={18} />
            <Text style={[styles.ghostButtonText, { color: theme.text }]}>Upload</Text>
          </Pressable>
        </View>
      </View>

      {recentTracks.length ? (
        <>
          <SectionHeader title="Recently played" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}>
            {recentTracks.map((track) => (
              <View key={track.id} style={styles.recentCard}>
                <TrackRow
                  track={track}
                  active={player.currentTrack?.id === track.id}
                  playing={player.isPlaying}
                  onPress={() => player.playTrack(track, recentTracks)}
                  onMenu={() => openTrackActions(track)}
                />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {library.facets.genres.length ? (
        <>
          <SectionHeader title="Browse by mood" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {library.facets.genres.map((genre) => (
              <Pressable
                key={genre.name}
                onPress={() => router.push({ pathname: '/search', params: { genre: genre.name } })}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.surfaceHigh, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, { color: theme.text }]}>{genre.name}</Text>
                <Text style={[styles.chipCount, { color: theme.textMuted }]}>
                  {genre.track_count}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {library.playlists.length ? (
        <>
          <SectionHeader
            title="Your playlists"
            actionLabel="See all"
            onAction={() => router.push('/playlists')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}>
            {library.playlists.slice(0, 10).map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                size={140}
                onPress={() => router.push(`/playlist/${playlist.id}`)}
                onLongPress={() => router.push(`/playlist/${playlist.id}`)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader
        title={isEmpty ? 'Library' : `All songs (${formatCount(library.tracks.length)})`}
        actionLabel={isEmpty || !library.tracks.length ? undefined : 'Play'}
        onAction={library.tracks.length ? playAllSongs : undefined}
      />
    </View>
  );

  return (
    <Screen padBottom={false}>
      <FlatList
        data={library.tracks}
        keyExtractor={(track) => String(track.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={library.status === 'loading' && !isEmpty}
            onRefresh={() => void library.refresh()}
            tintColor={theme.textSecondary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loader} color={theme.primary} />
          ) : library.status === 'error' ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Can't reach the library"
              message={library.error ?? undefined}
              actionLabel="Try again"
              onAction={() => void library.refresh()}
            />
          ) : (
            <EmptyState
              icon="musical-notes-outline"
              title="No tracks yet"
              message="Upload an audio file and it will appear here for everyone who opens this link."
              actionLabel="Upload audio"
              onAction={() => router.push('/upload')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <TrackRow
            index={index}
            track={item}
            active={player.currentTrack?.id === item.id}
            playing={player.isPlaying}
            showFavorite
            isFavorite={favorites.isFavorite(item.id)}
            onToggleFavorite={() => favorites.toggleFavorite(item.id)}
            onPress={() => player.playTrack(item, library.tracks)}
            onLongPress={() => openTrackActions(item)}
            onMenu={() => openTrackActions(item)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsButton: {
    padding: Spacing.sm,
  },
  brand: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 13.5,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: Radius.pill,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  horizontalList: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  recentCard: {
    width: 280,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipCount: {
    fontSize: 12,
  },
  loader: {
    marginTop: Spacing.xxxl,
  },
  pressed: {
    opacity: 0.75,
  },
});
