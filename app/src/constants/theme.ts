/**
 * Design tokens. The palette is dark-first (music apps live in dark rooms) with
 * a full light variant, and every screen reads from here so the look stays
 * consistent.
 */
import { Platform } from 'react-native';

export const Palette = {
  brand: '#7C5CFF',
  brandSoft: '#9B87FF',
  mint: '#00D3A7',
  amber: '#FFB020',
  rose: '#FF5C8A',
  sky: '#4FA8FF',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceHigh: string;
  surfacePressed: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  tabBar: string;
  overlay: string;
};

export type ThemeColorName = keyof ThemeColors;

export const Colors: { dark: ThemeColors; light: ThemeColors } = {
  dark: {
    background: '#0B0B0F',
    surface: '#15151C',
    surfaceHigh: '#1E1E28',
    surfacePressed: '#262633',
    border: '#26262F',
    text: '#FFFFFF',
    textSecondary: '#9A9AAE',
    textMuted: '#6B6B7B',
    primary: Palette.brand,
    onPrimary: '#FFFFFF',
    danger: '#FF5C5C',
    tabBar: 'rgba(16,16,22,0.92)',
    overlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F8',
    surfaceHigh: '#EBEBF1',
    surfacePressed: '#E0E0E8',
    border: '#E3E3EB',
    text: '#0B0B0F',
    textSecondary: '#62626F',
    textMuted: '#8E8E9C',
    primary: Palette.brand,
    onPrimary: '#FFFFFF',
    danger: '#D93A3A',
    tabBar: 'rgba(255,255,255,0.92)',
    overlay: 'rgba(0,0,0,0.4)',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  web: {
    sans: 'var(--font-display)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
});

/** Height reserved for the tab bar so lists can pad their bottom correctly. */
export const TAB_BAR_HEIGHT = 60;
/** Height of the floating mini player that sits on top of the tab bar. */
export const MINI_PLAYER_HEIGHT = 62;
export const MAX_CONTENT_WIDTH = 900;
