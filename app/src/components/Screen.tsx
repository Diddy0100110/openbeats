import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, MINI_PLAYER_HEIGHT } from '@/constants/theme';
import { usePlayer } from '@/state/player';

/**
 * Space the floating mini player occupies at the bottom of the viewport. Lists
 * put this in `contentContainerStyle.paddingBottom` so the last row is never
 * hidden; plain screens use it as ordinary padding.
 */
export function useBottomSpace(extra = 0): number {
  const insets = useSafeAreaInsets();
  const { currentTrack } = usePlayer();
  return (currentTrack ? MINI_PLAYER_HEIGHT + 14 : 0) + insets.bottom + extra;
}

type Props = {
  children: React.ReactNode;
  /** Set to false when the child is a list that handles its own bottom padding. */
  padBottom?: boolean;
  style?: ViewStyle;
};

/** Page wrapper: readable max width, centred on wide (web) screens. */
export function Screen({ children, padBottom = true, style }: Props) {
  const bottom = useBottomSpace();

  return (
    <View style={[styles.root, style]}>
      <View style={[styles.inner, padBottom && { paddingBottom: bottom }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
