import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from '@/constants/theme';

/** Resolves the active colour palette from the system appearance. */
export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? Colors.light : Colors.dark;
}
