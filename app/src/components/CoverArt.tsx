import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { artworkUrl, type Track } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { coverPalette } from '@/lib/color';
import { initials } from '@/lib/format';

type Props = {
  track: Pick<Track, 'artist' | 'album' | 'title' | 'has_artwork' | 'artwork_url'> | null;
  size: number;
  radius?: number;
  /** Use a soft square (album) or a circle (artist). */
  rounded?: boolean;
};

/**
 * Album art. Uploaded files with embedded artwork show the real picture;
 * everything else gets a stable gradient derived from the album name, so the
 * demo catalogue never looks like a grid of grey boxes.
 */
export function CoverArt({ track, size, radius, rounded = false }: Props) {
  const theme = useTheme();

  const seed = track ? `${track.artist} · ${track.album}` : 'openbeats';
  const palette = useMemo(() => coverPalette(seed), [seed]);
  const label = useMemo(
    () => (track ? initials(track.artist, track.album) : '♪'),
    [track],
  );

  const corner = rounded ? size / 2 : (radius ?? Math.max(6, size * 0.14));
  const remote = track ? artworkUrl(track as Track) : null;

  if (remote) {
    return (
      <Image
        source={{ uri: remote }}
        style={{
          width: size,
          height: size,
          borderRadius: corner,
          backgroundColor: theme.surfaceHigh,
        }}
      />
    );
  }

  return (
    <LinearGradient
      colors={palette.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, { width: size, height: size, borderRadius: corner }]}>
      <View style={styles.glow} />
      <Text
        style={[
          styles.label,
          { fontSize: Math.max(10, size * 0.3), color: 'rgba(255,255,255,0.94)' },
        ]}>
        {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '-30%',
    left: '-20%',
    width: '85%',
    height: '85%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
