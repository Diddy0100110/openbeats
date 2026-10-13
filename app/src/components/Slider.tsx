import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  /** Current position, in the same unit as `max`. */
  value: number;
  max: number;
  /** Fired continuously while dragging (use it for a live label). */
  onChange?: (value: number) => void;
  /** Fired once when the drag/tap ends — commit the seek here. */
  onCommit: (value: number) => void;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  disabled?: boolean;
};

/**
 * A dependency-free seek bar.
 *
 * `@react-native-community/slider` needs a native module and behaves
 * inconsistently on web, whereas `PanResponder` works identically on iOS,
 * Android and the browser. It is an imperative API, so the gesture handlers
 * read the latest props from a ref that an effect keeps up to date — that way
 * the responder is created once and never goes stale.
 */
export function Slider({
  value,
  max,
  onChange,
  onCommit,
  height = 4,
  trackColor,
  fillColor,
  disabled = false,
}: Props) {
  const theme = useTheme();

  const config = useRef({ width: 0, max, disabled, onChange, onCommit });

  useEffect(() => {
    config.current.max = max;
    config.current.disabled = disabled;
    config.current.onChange = onChange;
    config.current.onCommit = onCommit;
  }, [max, disabled, onChange, onCommit]);

  const panHandlers = useMemo(() => {
    const valueAt = (x: number) => {
      const { width, max: maximum } = config.current;
      if (width <= 0 || maximum <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, x / width));
      return ratio * maximum;
    };

    // `PanResponder` is an imperative API: its handlers are created once and
    // must stay stable, while still observing the latest props. The ref
    // indirection is deliberate, so the compiler's ref rule is silenced here.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !config.current.disabled,
      onMoveShouldSetPanResponder: () => !config.current.disabled,
      onPanResponderGrant: (event) => {
        config.current.onChange?.(valueAt(event.nativeEvent.locationX));
      },
      onPanResponderMove: (event) => {
        config.current.onChange?.(valueAt(event.nativeEvent.locationX));
      },
      onPanResponderRelease: (event) => {
        config.current.onCommit(valueAt(event.nativeEvent.locationX));
      },
      onPanResponderTerminate: (event) => {
        config.current.onCommit(valueAt(event.nativeEvent.locationX));
      },
    }).panHandlers;
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    config.current.width = event.nativeEvent.layout.width;
  };

  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const knob = height * 3.25;

  return (
    <View
      style={[styles.container, { height: Math.max(knob, 28) }]}
      onLayout={onLayout}
      {...panHandlers}>
      <View
        style={[
          styles.track,
          { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.surfaceHigh },
        ]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: fillColor ?? theme.primary,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.knob,
          {
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            backgroundColor: fillColor ?? theme.primary,
            borderColor: theme.background,
            left: `${ratio * 100}%`,
            marginLeft: -knob / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  knob: {
    position: 'absolute',
    borderWidth: 3,
  },
});
