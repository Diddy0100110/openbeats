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
  onLongPress?: () => void;
  onMenu?: () => void;
  /** Highlighted because this is what is currently playing. */
  active?: boolean;
  playing?: boolean;
  index?: number;
  showArtwork?: boolean;
  showFavorite?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Rendered after the duration, e.g. a remove button. */
  trailing?: React.ReactNode;
  subtitle?: string;
};

export function TrackRow({
  track,
  onPress,
  onLongPress,
  onMenu,
  active = false,
  playing = false,
  index,
  showArtwork = true,
  showFavorite = false,
  isFavorite = false,
  onToggleFavorite,
  trailing,
  subtitle,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfacePressed : 'transparent' },
      ]}>
      {index != null ? (
        <View style={styles.index}>
          {active ? (
            <Icon name={playing ? 'volume-high' : 'pause'} size={16} color={theme.primary} />
          ) : (
            <Text style={[styles.indexText, { color: theme.textMuted }]}>{index + 1}</Text>
          )}
        </View>
      ) : null}

      {showArtwork ? <CoverArt track={track} size={46} /> : null}

      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: active ? theme.primary : theme.text }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle ?? `${track.artist} · ${track.album}`}
        </Text>
      </View>

      {showFavorite ? (
        <Pressable
          hitSlop={10}
          onPress={onToggleFavorite}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={19}
            color={isFavorite ? theme.primary : theme.textMuted}
          />
        </Pressable>
      ) : null}

      <Text style={[styles.duration, { color: theme.textMuted }]}>{formatTime(track.duration)}</Text>

      {trailing}

      {onMenu ? (
        <Pressable
          hitSlop={10}
          onPress={onMenu}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="ellipsis-horizontal" size={18} color={theme.textMuted} />
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
    minHeight: 62,
  },
  index: {
    width: 24,
    alignItems: 'center',
  },
  indexText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  duration: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'right',
  },
  iconButton: {
    padding: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
