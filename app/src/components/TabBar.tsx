import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { MiniPlayer } from '@/components/MiniPlayer';
import { TAB_BAR_HEIGHT, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const TAB_ICONS: Record<string, { icon: IconName; active: IconName }> = {
  index: { icon: 'home-outline', active: 'home' },
  search: { icon: 'search-outline', active: 'search' },
  playlists: { icon: 'albums-outline', active: 'albums' },
  favorites: { icon: 'heart-outline', active: 'heart' },
};

/** Custom tab bar: mini player on top, navigation underneath. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />

      <View style={[styles.bar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const icons = TAB_ICONS[route.name] ?? {
            icon: 'ellipse-outline',
            active: 'ellipse',
          };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}>
              <Icon
                name={focused ? icons.active : icons.icon}
                size={23}
                color={focused ? theme.primary : theme.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? theme.primary : theme.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
  },
});
