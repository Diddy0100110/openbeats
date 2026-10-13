import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/hooks/useTheme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // The scene must be opaque: with a transparent background the previous
      // tab stays visible underneath and the screens appear to overlap.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="playlists" options={{ title: 'Playlists' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favourites' }} />
    </Tabs>
  );
}
