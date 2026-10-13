import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  /** Rendered inside the field, before the text. */
  leading?: React.ReactNode;
  /** Rendered inside the field, after the text. */
  trailing?: React.ReactNode;
  rounded?: boolean;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { leading, trailing, rounded = true, style, ...rest },
  ref,
) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.surfaceHigh,
          borderColor: theme.border,
          borderRadius: rounded ? Radius.pill : Radius.md,
        },
      ]}>
      {leading}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text }, style]}
        {...rest}
      />
      {trailing}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    // Removes the default focus ring on web.
    outlineStyle: 'none',
  } as object,
});
