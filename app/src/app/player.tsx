import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverArt } from '@/components/CoverArt';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Slider } from '@/components/Slider';
import { MAX_CONTENT_WIDTH, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatTime, truncate } from '@/lib/format';
import { useFavorites } from '@/state/favorites';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export default function PlayerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const player = usePlayer();
  const favorites = useFavorites();
  const { openAddToPlaylist, openTrackActions } = useOverlays();

  const [scrub, setScrub] = useState<number | null>(null);

  const track = player.currentTrack;

  if (!track) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <EmptyState
          icon="musical-note-outline"
          title="Nothing is playing"
          message="Pick a track from your library to start listening."
          actionLabel="Back to library"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const artSize = Math.min(width - Spacing.xl * 2, MAX_CONTENT_WIDTH - 300, 320);
  const displayPosition = scrub ?? player.position;
  const isFavorite = favorites.isFavorite(track.id);
  const repeatColor = player.repeat === 'off' ? theme.textMuted : theme.primary;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Icon name="chevron-down" size={26} />
        </Pressable>

        <Text numberOfLines={1} style={[styles.headerLabel, { color: theme.text }]}>
          {truncate(track.title, 34)}
        </Text>

        <Pressable
          hitSlop={12}
          onPress={() => openTrackActions(track)}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Icon name="ellipsis-horizontal" size={22} muted />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.artWrap}>
          <CoverArt track={track} size={artSize} radius={Radius.xl} />
        </View>

        <View style={styles.titles}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: theme.textSecondary }]}>
            {track.artist} · {track.album}
          </Text>
        </View>

        <View style={styles.progressBlock}>
          <Slider
            value={displayPosition}
            max={player.duration || 1}
            height={5}
            onChange={setScrub}
            onCommit={(value) => {
              player.seek(value);
              setScrub(null);
            }}
            disabled={!player.duration}
          />
          <View style={styles.times}>
            <Text style={[styles.time, { color: theme.textMuted }]}>
              {formatTime(displayPosition)}
            </Text>
            <Text style={[styles.time, { color: theme.textMuted }]}>
              {player.duration
                ? `-${formatTime(Math.max(0, player.duration - displayPosition))}`
                : '--:--'}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            hitSlop={10}
            onPress={player.toggleShuffle}
            style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}>
            <Icon
              name="shuffle"
              size={21}
              color={player.shuffle ? theme.primary : theme.textMuted}
            />
          </Pressable>

          <Pressable
            hitSlop={10}
            onPress={player.previous}
            style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}>
            <Icon name="play-skip-back" size={28} />
          </Pressable>

          <Pressable
            accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}
            onPress={player.toggle}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            {player.isBuffering ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <Icon
                name={player.isPlaying ? 'pause' : 'play'}
                size={28}
                color={theme.onPrimary}
              />
            )}
          </Pressable>

          <Pressable
            hitSlop={10}
            onPress={player.next}
            style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}>
            <Icon name="play-skip-forward" size={28} />
          </Pressable>

          <Pressable
            hitSlop={10}
            onPress={player.cycleRepeat}
            style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}>
            <View>
              <Icon name="repeat" size={21} color={repeatColor} />
              {player.repeat === 'one' ? (
                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.badgeText}>1</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => favorites.toggleFavorite(track.id)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Icon
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={21}
              color={isFavorite ? theme.primary : theme.textSecondary}
            />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>
              {isFavorite ? 'Favourited' : 'Favourite'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openAddToPlaylist(track)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Icon name="add-circle-outline" size={21} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>Playlist</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/queue')}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Icon name="list" size={21} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>
              Queue ({player.queue.length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.extras}>
          <View style={styles.volumeBlock}>
            <Pressable
              hitSlop={8}
              onPress={() => player.setVolume(player.volume > 0 ? 0 : 1)}>
              <Icon
                name={player.volume === 0 ? 'volume-mute' : 'volume-low'}
                size={19}
                muted
              />
            </Pressable>
            <Slider
              value={player.volume}
              max={1}
              height={4}
              onChange={player.setVolume}
              onCommit={player.setVolume}
            />
            <Icon name="volume-high" size={19} muted />
          </View>

          <View style={styles.speeds}>
            {SPEEDS.map((speed) => {
              const active = Math.abs(player.rate - speed) < 0.01;
              return (
                <Pressable
                  key={speed}
                  onPress={() => player.setRate(speed)}
                  style={[
                    styles.speedChip,
                    { backgroundColor: active ? theme.primary : theme.primarySoft },
                  ]}>
                  <Text
                    style={[
                      styles.speedText,
                      { color: active ? theme.onPrimary : theme.primary },
                    ]}>
                    {speed}×
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {track.attribution ? (
          <Text style={[styles.attribution, { color: theme.textMuted }]}>
            {track.attribution}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerButton: {
    padding: Spacing.sm,
    minWidth: 40,
  },
  headerLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  artWrap: {
    marginTop: Spacing.sm,
    shadowColor: '#101024',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  titles: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  artist: {
    fontSize: 14.5,
    textAlign: 'center',
  },
  progressBlock: {
    width: '100%',
    gap: Spacing.xs,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  time: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.xs,
  },
  sideButton: {
    padding: Spacing.sm,
    minWidth: 46,
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: Spacing.sm,
  },
  action: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  extras: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  volumeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  speeds: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  speedChip: {
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  attribution: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.md,
    maxWidth: 420,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
