import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Screen, useBottomSpace } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/hooks/useTheme';
import { formatLongDuration, pluralise } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

type Mode = 'songs' | 'artists' | 'albums';

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useBottomSpace(Spacing.lg);
  const params = useLocalSearchParams<{ genre?: string }>();

  const library = useLibrary();
  const player = usePlayer();
  const favorites = useFavorites();
  const { openTrackActions } = useOverlays();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('songs');

  // The genre chip is driven by the URL (`?genre=Jazz`). React's documented
  // "adjust state when a prop changes" pattern keeps it in sync without an
  // effect, which would trigger a cascading render.
  const paramsGenre = params.genre ?? null;
  const [genre, setGenre] = useState<string | null>(paramsGenre);
  const [lastParamsGenre, setLastParamsGenre] = useState(paramsGenre);
  if (paramsGenre !== lastParamsGenre) {
    setLastParamsGenre(paramsGenre);
    setGenre(paramsGenre);
  }

  const debouncedQuery = useDebouncedValue(query, 180);

  const results = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();

    return library.tracks.filter((track) => {
      if (genre && track.genre !== genre) return false;
      if (!needle) return true;
      return (
        track.title.toLowerCase().includes(needle) ||
        track.artist.toLowerCase().includes(needle) ||
        track.album.toLowerCase().includes(needle) ||
        (track.genre ?? '').toLowerCase().includes(needle)
      );
    });
  }, [library.tracks, debouncedQuery, genre]);

  const grouped = useMemo(() => {
    if (mode === 'songs') return null;

    const key = mode === 'artists' ? 'artist' : 'album';
    const map = new Map<string, Track[]>();
    for (const track of results) {
      const name = track[key];
      const bucket = map.get(name);
      if (bucket) bucket.push(track);
      else map.set(name, [track]);
    }
    return [...map.entries()]
      .map(([name, tracks]) => ({
        name,
        tracks,
        duration: tracks.reduce((total, track) => total + (track.duration ?? 0), 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [results, mode]);

  const searching = Boolean(debouncedQuery.trim()) || Boolean(genre);
  const activeCount = results.length;

  const modes: { key: Mode; label: string }[] = [
    { key: 'songs', label: 'Songs' },
    { key: 'artists', label: 'Artists' },
    { key: 'albums', label: 'Albums' },
  ];

  return (
    <Screen padBottom={false}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Search</Text>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Songs, artists, albumsâ€¦"
          autoCorrect={false}
          returnKeyType="search"
          leading={<Icon name="search" size={18} color={theme.textMuted} />}
          trailing={
            query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Icon name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {library.facets.genres.map((item) => {
            const active = genre === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => setGenre(active ? null : item.name)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceHigh,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}>
                <Text
                  style={[styles.chipText, { color: active ? theme.onPrimary : theme.text }]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.modeRow}>
          {modes.map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setMode(item.key)}
                style={[
                  styles.mode,
                  { backgroundColor: active ? theme.surfaceHigh : 'transparent' },
                ]}>
                <Text
                  style={[
                    styles.modeText,
                    { color: active ? theme.text : theme.textSecondary },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {searching ? (
          <Text style={[styles.summary, { color: theme.textSecondary }]}>
            {pluralise(activeCount, 'result')}
            {genre ? ` in ${genre}` : ''}
          </Text>
        ) : null}
      </View>

      {mode === 'songs' ? (
        <FlatList
          data={results}
          keyExtractor={(track) => String(track.id)}
          contentContainerStyle={{ paddingBottom: bottom }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searching ? (
              <EmptyState
                icon="search-outline"
                title="Nothing matched"
                message="Try a different artist, album or keyword."
              />
            ) : (
              <EmptyState
                icon="sparkles-outline"
                title="Start typing"
                message="Search the whole library by song, artist, album or genre."
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
              onPress={() => player.playTrack(item, results)}
              onLongPress={() => openTrackActions(item)}
              onMenu={() => openTrackActions(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={grouped ?? []}
          keyExtractor={(group) => group.name}
          contentContainerStyle={{ paddingBottom: bottom }}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title={`No ${mode} found`}
              message="Try clearing the search or picking another genre."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => player.playQueue(item.tracks, 0)}
              style={({ pressed }) => [
                styles.groupRow,
                { borderBottomColor: theme.border },
                pressed && { backgroundColor: theme.surfacePressed },
              ]}>
              <View style={[styles.groupIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Icon name={mode === 'artists' ? 'person' : 'disc'} size={20} muted />
              </View>
              <View style={styles.groupText}>
                <Text numberOfLines={1} style={[styles.groupName, { color: theme.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>
                  {pluralise(item.tracks.length, 'track')} Â· {formatLongDuration(item.duration)}
                </Text>
              </View>
              <Icon name="play-circle-outline" size={24} color={theme.primary} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  mode: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summary: {
    fontSize: 12.5,
    marginTop: -Spacing.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupText: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  groupMeta: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
