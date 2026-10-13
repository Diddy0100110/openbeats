import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Screen, useBottomSpace } from '@/components/Screen';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/hooks/useTheme';
import { formatLongDuration, pluralise } from '@/lib/format';
import { useLibrary } from '@/state/library';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';
import type { Track } from '@/api/client';

type Mode = 'songs' | 'artists' | 'albums';

export default function SearchScreen() {
  const theme = useTheme();
  const bottom = useBottomSpace(Spacing.lg);
  const params = useLocalSearchParams<{ genre?: string }>();

  const library = useLibrary();
  const player = usePlayer();
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

  const modes: { key: Mode; label: string }[] = [
    { key: 'songs', label: 'Songs' },
    { key: 'artists', label: 'Artists' },
    { key: 'albums', label: 'Albums' },
  ];

  const header = (
    <View style={styles.header}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Song, artist, album…"
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

      {library.facets.genres.length ? (
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
                  { backgroundColor: active ? theme.primary : theme.primarySoft },
                ]}>
                <Text
                  style={[styles.chipText, { color: active ? theme.onPrimary : theme.primary }]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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
                style={[styles.modeText, { color: active ? theme.text : theme.textMuted }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}

        {searching ? (
          <Text style={[styles.summary, { color: theme.textMuted }]}>
            {pluralise(results.length, 'result')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen padBottom={false}>
      {mode === 'songs' ? (
        <FlatList
          data={results}
          keyExtractor={(track) => String(track.id)}
          ListHeaderComponent={header}
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
          renderItem={({ item }) => (
            <TrackRow
              track={item}
              active={player.currentTrack?.id === item.id}
              playing={player.isPlaying}
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
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: bottom }}
          keyboardShouldPersistTaps="handled"
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
                pressed && { backgroundColor: theme.surfaceHigh },
              ]}>
              <View style={[styles.groupIcon, { backgroundColor: theme.primarySoft }]}>
                <Icon
                  name={mode === 'artists' ? 'person' : 'disc'}
                  size={19}
                  color={theme.primary}
                />
              </View>
              <View style={styles.groupText}>
                <Text numberOfLines={1} style={[styles.groupName, { color: theme.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>
                  {pluralise(item.tracks.length, 'track')} · {formatLongDuration(item.duration)}
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 'auto',
    fontSize: 12.5,
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
    fontWeight: '700',
  },
  groupMeta: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
