import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { MAX_CONTENT_WIDTH, Radius, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Sheets with long content (like a playlist picker) can scroll. */
  scrollable?: boolean;
  maxHeightRatio?: number;
};

/** A themed bottom sheet. Used for every menu, prompt and confirmation. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  scrollable = false,
  maxHeightRatio = 0.75,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <View style={styles.inner}>
      {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + Spacing.lg,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {scrollable ? (
            <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </View>
      </View>
    </Modal>
  );
}

/** A tappable row, used for every entry inside a sheet. */
export function SheetRow({
  icon,
  label,
  detail,
  onPress,
  destructive = false,
  selected = false,
}: {
  icon?: ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfacePressed : 'transparent' },
      ]}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowLabel,
            { color: destructive ? theme.danger : selected ? theme.primary : theme.text },
          ]}>
          {label}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.rowDetail, { color: theme.textSecondary }]}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  scrollContent: {
    paddingBottom: Spacing.sm,
  },
  inner: {
    gap: Spacing.xs,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 28,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowDetail: {
    fontSize: 13,
    marginTop: 1,
  },
});
