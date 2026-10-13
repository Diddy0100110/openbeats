import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { Icon } from '@/components/Icon';
import { MINI_PLAYER_HEIGHT, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePlayer } from '@/state/player';

/** Compact playback bar pinned to the bottom, as in the reference design. */
export function MiniPlayer() {
  const theme = useTheme();
  const router = useRouter();
  const { currentTrack, isPlaying, isBuffering, progress, toggle, next, previous } = usePlayer();

  if (!currentTrack) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${currentTrack.title} by ${currentTrack.artist}`}
      onPress={() => router.push('/player')}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: '#101024',
        },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceHigh }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>

      <CoverArt track={currentTrack} size={44} />

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {currentTrack.title}
        </Text>
        <Text numberOfLines={1} style={[styles.artist, { color: theme.textSecondary }]}>
          {currentTrack.artist}
        </Text>
      </View>

      <Pressable
        hitSlop={8}
        accessibilityLabel="Previous track"
        onPress={(event) => {
          event.stopPropagation?.();
          previous();
        }}
        style={styles.button}>
        <Icon name="play-skip-back" size={20} />
      </Pressable>

      <Pressable
        hitSlop={8}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        onPress={(event) => {
          event.stopPropagation?.();
          toggle();
        }}
        style={[styles.playButton, { backgroundColor: theme.primary }]}>
        {isBuffering ? (
          <ActivityIndicator size="small" color={theme.onPrimary} />
        ) : (
          <Icon name={isPlaying ? 'pause' : 'play'} size={18} color={theme.onPrimary} />
        )}
      </Pressable>

      <Pressable
        hitSlop={8}
        accessibilityLabel="Next track"
        onPress={(event) => {
          event.stopPropagation?.();
          next();
        }}
        style={styles.button}>
        <Icon name="play-skip-forward" size={20} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: MINI_PLAYER_HEIGHT,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  progressFill: {
    height: 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    marginLeft: Spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  artist: {
    fontSize: 12,
    marginTop: 1,
  },
  button: {
    padding: Spacing.xs,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
