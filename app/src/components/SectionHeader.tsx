import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
};

export function SectionHeader({ title, actionLabel, onAction, style }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: theme.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
  },
});
