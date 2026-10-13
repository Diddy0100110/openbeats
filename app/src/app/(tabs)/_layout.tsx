import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/MiniPlayer';
import { TOP_TABS, TopTabButton } from '@/components/TopTabs';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={[styles.root, { backgroundColor: theme.background }]}>
      {/* The triggers must be declared here: expo-router/ui discovers screens by
          reading this layout's JSX. Wrapping them in another component makes the
          navigator report "couldn't find any screens". */}
      <TabList asChild>
        {/* `asChild` forwards to a Slot, which cannot take an array of styles. */}
        <View
          style={StyleSheet.flatten([
            styles.strip,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.border,
              paddingTop: insets.top + Spacing.sm,
            },
          ])}>
          {TOP_TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TopTabButton icon={tab.icon} activeIcon={tab.activeIcon} label={tab.label} />
            </TabTrigger>
          ))}
        </View>
      </TabList>

      <TabSlot style={styles.slot} />

      {/* Floats over the content so lists keep their full height. */}
      <View
        style={[styles.player, { paddingBottom: insets.bottom + 6 }]}
        pointerEvents="box-none">
        <MiniPlayer />
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    flex: 1,
  },
  player: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
