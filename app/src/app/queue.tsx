import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { TrackRow } from '@/components/TrackRow';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatLongDuration, pluralise } from '@/lib/format';
import { useOverlays } from '@/state/overlays';
import { usePlayer } from '@/state/player';

export default function QueueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const { confirm } = useOverlays();

  const remaining = player.queue
    .slice(player.currentIndex)
    .reduce((total, track) => total + (track.duration ?? 0), 0);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Icon name="chevron-down" size={26} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>Queue</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {pluralise(player.queue.length, 'track')} · {formatLongDuration(remaining)} left
          </Text>
        </View>

        <Pressable
          onPress={() =>
            confirm({
              title: 'Clear the queue?',
              message: 'Playback stops and every track is removed from the queue.',
              confirmLabel: 'Clear',
              destructive: true,
              onConfirm: player.clearQueue,
            })
          }
          hitSlop={12}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Icon name="trash-outline" size={20} muted />
        </Pressable>
      </View>

      <FlatList
        data={player.queue}
        keyExtractor={(track, index) => `${track.id}-${index}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        ListEmptyComponent={
          <EmptyState
            icon="list-outline"
            title="The queue is empty"
            message="Play something from your library and it will show up here."
          />
        }
        renderItem={({ item, index }) => (
          <TrackRow
            index={index}
            track={item}
            active={index === player.currentIndex}
            playing={player.isPlaying}
            onPress={() => player.jumpTo(index)}
            trailing={
              <View style={styles.controls}>
                <Pressable
                  hitSlop={6}
                  onPress={() => player.move(index, index - 1)}
                  disabled={index === 0}
                  style={[styles.smallButton, index === 0 && styles.disabled]}>
                  <Icon name="chevron-up" size={17} muted />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => player.move(index, index + 1)}
                  disabled={index === player.queue.length - 1}
                  style={[
                    styles.smallButton,
                    index === player.queue.length - 1 && styles.disabled,
                  ]}>
                  <Icon name="chevron-down" size={17} muted />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => player.removeAt(index)}
                  style={styles.smallButton}>
                  <Icon name="close" size={17} color={theme.textMuted} />
                </Pressable>
              </View>
            }
          />
        )}
      />
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 1,
  },
  button: {
    padding: Spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
