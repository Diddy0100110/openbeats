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

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { PlaylistCard } from '@/components/PlaylistCard';
import { Screen, useBottomSpace } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatCount, formatLongDuration, pluralise } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
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
        .slice(0, 8),
    [favorites.recentIds, library.trackMap],
  );

  const isEmpty = !library.tracks.length;
  const isLoading = library.status === 'loading' && isEmpty;

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
      <View style={styles.brandRow}>
        <Text style={[styles.brand, { color: theme.text }]}>
          Open<Text style={{ color: theme.primary }}>Beats</Text>
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityLabel="Settings"
          style={({ pressed }) => [
            styles.settingsButton,
            { backgroundColor: theme.primarySoft },
            pressed && styles.pressed,
          ]}>
          <Icon name="settings-outline" size={19} color={theme.primary} />
        </Pressable>
      </View>

      {/* Search shortcut, mirroring the search field in the reference design. */}
      <Pressable
        onPress={() => router.push('/search')}
        style={({ pressed }) => [
          styles.searchField,
          { backgroundColor: theme.surfaceHigh, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Icon name="search" size={18} color={theme.textMuted} />
        <Text style={[styles.searchText, { color: theme.textMuted }]}>
          Song, artist, album…
        </Text>
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable
          onPress={shuffleAll}
          disabled={isEmpty}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary, opacity: isEmpty ? 0.45 : 1 },
            pressed && styles.pressed,
          ]}>
          <Icon name="shuffle" size={17} color={theme.onPrimary} />
          <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Shuffle all</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/upload')}
          style={({ pressed }) => [
            styles.ghostButton,
            { borderColor: theme.border, backgroundColor: theme.surface },
            pressed && styles.pressed,
          ]}>
          <Icon name="cloud-upload-outline" size={17} />
          <Text style={[styles.ghostButtonText, { color: theme.text }]}>Upload</Text>
        </Pressable>
      </View>

      {library.stats ? (
        <Text style={[styles.stats, { color: theme.textMuted }]}>
          {pluralise(library.stats.tracks, 'track')} · {pluralise(library.stats.albums, 'album')} ·{' '}
          {formatLongDuration(library.stats.total_duration)}
        </Text>
      ) : null}

      {recentTracks.length ? (
        <>
          <SectionHeader title="Recently played" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}>
            {recentTracks.map((track) => (
              <View key={track.id} style={styles.recentCard}>
                <TrackRow
                  track={track}
                  showDuration={false}
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
            contentContainerStyle={styles.horizontal}>
            {library.facets.genres.map((genre) => (
              <Pressable
                key={genre.name}
                onPress={() => router.push({ pathname: '/search', params: { genre: genre.name } })}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.primarySoft },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, { color: theme.primary }]}>{genre.name}</Text>
                <Text style={[styles.chipCount, { color: theme.primary }]}>
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
            title="Playlists"
            actionLabel="See all"
            onAction={() => router.push('/playlists')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}>
            {library.playlists.slice(0, 8).map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                size={132}
                onPress={() => router.push(`/playlist/${playlist.id}`)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader
        title={isEmpty ? 'Library' : `All songs (${formatCount(library.tracks.length)})`}
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
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            active={player.currentTrack?.id === item.id}
            playing={player.isPlaying}
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  brand: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 46,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchText: {
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 42,
    borderRadius: Radius.pill,
  },
  primaryButtonText: {
    fontSize: 14.5,
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
  stats: {
    fontSize: 12.5,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  horizontal: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  recentCard: {
    width: 268,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 36,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  loader: {
    marginTop: Spacing.xxxl,
  },
  pressed: {
    opacity: 0.75,
  },
});
