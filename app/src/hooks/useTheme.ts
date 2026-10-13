import { useColorScheme } from 'react-native';

import { Colors, LOCKED_SCHEME, type ThemeColors } from '@/constants/theme';

/** Resolves the active colour palette. */
export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  const resolved = LOCKED_SCHEME ?? (scheme === 'light' ? 'light' : 'dark');
  return Colors[resolved];
}
