import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Screen, useBottomSpace } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { pluralise } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

type Tab = 'favorites' | 'recent';

export default function FavoritesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useBottomSpace(Spacing.lg);

  const library = useLibrary();
  const player = usePlayer();
  const favorites = useFavorites();
  const { openTrackActions } = useOverlays();

  const [tab, setTab] = useState<Tab>('favorites');

  const favoriteTracks = useMemo(
    () =>
      favorites.favoriteIds
        .map((id) => library.trackMap.get(id))
        .filter((track): track is Track => Boolean(track)),
    [favorites.favoriteIds, library.trackMap],
  );

  const recentTracks = useMemo(
    () =>
      favorites.recentIds
        .map((id) => library.trackMap.get(id))
        .filter((track): track is Track => Boolean(track)),
    [favorites.recentIds, library.trackMap],
  );

  const data = tab === 'favorites' ? favoriteTracks : recentTracks;
  const clearCurrent = tab === 'favorites' ? favorites.clearFavorites : favorites.clearRecent;

  return (
    <Screen padBottom={false}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Your music</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Saved on this device only Â· {pluralise(data.length, 'track')}
        </Text>

        <View style={styles.tabRow}>
          {(
            [
              { key: 'favorites' as Tab, label: 'Favourites', icon: 'heart' as const },
              { key: 'recent' as Tab, label: 'Recently played', icon: 'time' as const },
            ]
          ).map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceHigh,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}>
                <Icon
                  name={item.icon}
                  size={15}
                  color={active ? theme.onPrimary : theme.textSecondary}
                />
                <Text style={[styles.tabText, { color: active ? theme.onPrimary : theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}

          {data.length ? (
            <Pressable onPress={clearCurrent} style={styles.clear}>
              <Text style={[styles.clearText, { color: theme.textMuted }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(track) => String(track.id)}
        contentContainerStyle={{ paddingBottom: bottom }}
        ListEmptyComponent={
          tab === 'favorites' ? (
            <EmptyState
              icon="heart-outline"
              title="No favourites yet"
              message="Tap the heart on any track and it will show up here â€” privately, on this device."
              actionLabel="Browse the library"
              onAction={() => router.push('/')}
            />
          ) : (
            <EmptyState
              icon="time-outline"
              title="Nothing played yet"
              message="Tracks you listen to will appear here so you can pick up where you left off."
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
            onPress={() => player.playTrack(item, data)}
            onLongPress={() => openTrackActions(item)}
            onMenu={() => openTrackActions(item)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clear: {
    marginLeft: 'auto',
    padding: Spacing.sm,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
