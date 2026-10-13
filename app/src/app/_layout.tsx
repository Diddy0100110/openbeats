import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { loadApiBaseOverride } from '@/lib/apiBase';
import { FavoritesProvider } from '@/state/favorites';
import { LibraryProvider } from '@/state/library';
import { OverlaysProvider } from '@/state/overlays';
import { PlayerProvider } from '@/state/player';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const isLight = scheme === 'light';
  const colors = isLight ? Colors.light : Colors.dark;

  // The saved API override must be read before the first request goes out.
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadApiBaseOverride()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigured(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (configured) SplashScreen.hideAsync().catch(() => {});
  }, [configured]);

  const navigationTheme = {
    ...(isLight ? DefaultTheme : DarkTheme),
    colors: {
      ...(isLight ? DefaultTheme : DarkTheme).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        {/* Providers mount only once the stored API override has been read, so
            the very first request already targets the right server. */}
        {configured ? (
          <FavoritesProvider>
            <LibraryProvider>
              <PlayerProvider>
                <OverlaysProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="player"
                      options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                    />
                    <Stack.Screen name="queue" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="playlist/[id]" />
                  </Stack>
                </OverlaysProvider>
              </PlayerProvider>
            </LibraryProvider>
          </FavoritesProvider>
        ) : null}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
