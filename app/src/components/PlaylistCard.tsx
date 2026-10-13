import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { usePlayer } from '@/state/player';
import { coverPalette } from '@/lib/color';
import { formatLongDuration, pluralise } from '@/lib/format';
import type { Playlist } from '@/api/client';

type Props = {
  playlist: Playlist;
  onPress: () => void;
  onLongPress?: () => void;
  onPlay?: () => void;
  size?: number;
};

/** A playlist tile: gradient artwork, name, and a hoverable play button. */
export function PlaylistCard({ playlist, onPress, onLongPress, onPlay, size = 132 }: Props) {
  const theme = useTheme();
  const palette = coverPalette(playlist.name);
  const { currentTrack } = usePlayer();

  const accents = [playlist.accent, palette.colors[1], palette.colors[2]] as const;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.root, { width: size }, pressed && styles.pressed]}>
      <View style={styles.artWrap}>
        <LinearGradient
          colors={accents}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.art, { width: size, height: size }]}>
          <View style={styles.glow} />
          <Icon name="musical-notes" size={Math.round(size * 0.28)} color="rgba(255,255,255,0.9)" />
        </LinearGradient>

        {onPlay ? (
          <Pressable
            accessibilityLabel={`Play ${playlist.name}`}
            onPress={onPlay}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <Icon name="play" size={18} color={theme.onPrimary} />
          </Pressable>
        ) : null}
      </View>

      <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
        {playlist.name}
      </Text>
      <Text numberOfLines={1} style={[styles.meta, { color: theme.textSecondary }]}>
        {pluralise(playlist.track_count, 'track')}
        {playlist.total_duration ? ` · ${formatLongDuration(playlist.total_duration)}` : ''}
      </Text>
      {currentTrack ? null : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.sm,
  },
  artWrap: {
    position: 'relative',
  },
  art: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '-25%',
    left: '-15%',
    width: '80%',
    height: '80%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  playButton: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  name: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: -4,
  },
  pressed: {
    opacity: 0.75,
  },
});
