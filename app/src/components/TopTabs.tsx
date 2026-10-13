import type { Href } from 'expo-router';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type TopTabSpec = {
  name: string;
  href: Href;
  label: string;
  icon: IconName;
  activeIcon: IconName;
};

/** Tab strip order and labels, shared with the layout that renders the triggers. */
export const TOP_TABS: TopTabSpec[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'favorites', href: '/favorites', label: 'Favourites', icon: 'heart-outline', activeIcon: 'heart' },
  { name: 'playlists', href: '/playlists', label: 'Playlist', icon: 'albums-outline', activeIcon: 'albums' },
  { name: 'search', href: '/search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
];

type Props = TabTriggerSlotProps & {
  icon: IconName;
  activeIcon: IconName;
  label: string;
};

/**
 * One tab in the top strip. Presentational only — the `TabTrigger` that wraps it
 * must live in the layout file, because expo-router/ui discovers screens by
 * walking that layout's JSX.
 */
export function TopTabButton({ icon, activeIcon, label, isFocused, ...rest }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      {...rest}
      accessibilityState={isFocused ? { selected: true } : {}}
      style={StyleSheet.flatten(styles.tab)}>
      <View
        style={StyleSheet.flatten([
          styles.plate,
          { backgroundColor: isFocused ? theme.primary : theme.primarySoft },
        ])}>
        <Icon
          name={isFocused ? activeIcon : icon}
          size={17}
          color={isFocused ? theme.onPrimary : theme.primary}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, { color: isFocused ? theme.text : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  plate: {
    width: 40,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
