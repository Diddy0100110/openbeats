import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { Icon } from '@/components/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatTime } from '@/lib/format';
import type { Track } from '@/api/client';

type Props = {
  track: Track;
  onPress: () => void;
  /** Opens the track menu; rendered as the trailing "+" button, as in the design. */
  onMenu?: () => void;
  onLongPress?: () => void;
  active?: boolean;
  playing?: boolean;
  showArtwork?: boolean;
  /** Replaces the "+" button, e.g. reorder controls inside a playlist. */
  trailing?: React.ReactNode;
  subtitle?: string;
  /** Hides the duration on narrow rows. */
  showDuration?: boolean;
};

export function TrackRow({
  track,
  onPress,
  onMenu,
  onLongPress,
  active = false,
  playing = false,
  showArtwork = true,
  trailing,
  subtitle,
  showDuration = true,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceHigh : 'transparent' },
      ]}>
      {showArtwork ? <CoverArt track={track} size={46} /> : null}

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: active ? theme.primary : theme.text }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle ?? `${track.artist} · ${track.album}`}
        </Text>
      </View>

      {active ? (
        <Icon name={playing ? 'volume-high' : 'pause'} size={16} color={theme.primary} />
      ) : null}

      {showDuration ? (
        <Text style={[styles.duration, { color: theme.textMuted }]}>{formatTime(track.duration)}</Text>
      ) : null}

      {trailing}

      {onMenu ? (
        <Pressable
          hitSlop={10}
          accessibilityLabel={`More options for ${track.title}`}
          onPress={onMenu}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.primarySoft },
            pressed && styles.pressed,
          ]}>
          <Icon name="add" size={18} color={theme.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    minHeight: 64,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  duration: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
