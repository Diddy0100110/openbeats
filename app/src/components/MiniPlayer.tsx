import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { Icon } from '@/components/Icon';
import { MINI_PLAYER_HEIGHT, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePlayer } from '@/state/player';

/** The always-present playback bar that floats above the tab bar. */
export function MiniPlayer() {
  const theme = useTheme();
  const router = useRouter();
  const { currentTrack, isPlaying, isBuffering, progress, toggle, next } = usePlayer();

  if (!currentTrack) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${currentTrack.title} by ${currentTrack.artist}`}
      onPress={() => router.push('/player')}
      style={[
        styles.root,
        { backgroundColor: theme.surfaceHigh, borderColor: theme.border },
      ]}>
      {/* Thin progress indicator pinned to the top edge. */}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>

      <View style={styles.body}>
        <CoverArt track={currentTrack} size={42} />

        <View style={styles.text}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {currentTrack.title}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: theme.textSecondary }]}>
            {currentTrack.artist}
          </Text>
        </View>

        {isBuffering ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Pressable
            hitSlop={10}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            onPress={(event) => {
              event.stopPropagation?.();
              toggle();
            }}
            style={styles.button}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
          </Pressable>
        )}

        <Pressable
          hitSlop={10}
          accessibilityLabel="Next track"
          onPress={(event) => {
            event.stopPropagation?.();
            next();
          }}
          style={styles.button}>
          <Icon name="play-skip-forward" size={20} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    height: MINI_PLAYER_HEIGHT,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    fontSize: 12,
    marginTop: 1,
  },
  button: {
    padding: Spacing.xs,
  },
});
