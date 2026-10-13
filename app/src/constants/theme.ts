/**
 * Design tokens.
 *
 * The look follows the light mockup: white surfaces, soft grey chips and a
 * violet accent. A dark palette is kept in step for later, but the app is
 * deliberately pinned to light so it matches the reference design everywhere —
 * flip `LOCKED_SCHEME` to `undefined` to follow the system again.
 */
import { Platform } from 'react-native';

export const Palette = {
  brand: '#7C5CFF',
  brandSoft: '#EFEBFF',
  mint: '#12B886',
  amber: '#F59F00',
  rose: '#F06595',
  sky: '#4DABF7',
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
  /** Tinted fill behind violet text, used by chips and icon plates. */
  primarySoft: string;
  onPrimary: string;
  danger: string;
  tabBar: string;
  overlay: string;
};

export const Colors: { dark: ThemeColors; light: ThemeColors } = {
  light: {
    background: '#FFFFFF',
    surface: '#F7F7FB',
    surfaceHigh: '#EEEFF5',
    surfacePressed: '#E3E4ED',
    border: '#E7E8F0',
    text: '#14141B',
    textSecondary: '#6E6E86',
    textMuted: '#A1A1B5',
    primary: Palette.brand,
    primarySoft: Palette.brandSoft,
    onPrimary: '#FFFFFF',
    danger: '#E5484D',
    tabBar: 'rgba(255,255,255,0.97)',
    overlay: 'rgba(20,20,27,0.45)',
  },
  dark: {
    background: '#0B0B0F',
    surface: '#15151C',
    surfaceHigh: '#1E1E28',
    surfacePressed: '#262633',
    border: '#26262F',
    text: '#FFFFFF',
    textSecondary: '#9A9AAE',
    textMuted: '#6B6B7B',
    primary: '#8E74FF',
    primarySoft: '#241D42',
    onPrimary: '#FFFFFF',
    danger: '#FF6B6B',
    tabBar: 'rgba(16,16,22,0.94)',
    overlay: 'rgba(0,0,0,0.6)',
  },
};

/** Set to 'light' or 'dark' to pin the theme, or `undefined` to follow the system. */
export const LOCKED_SCHEME: 'light' | 'dark' | undefined = 'light';

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

/** Height of the floating mini player at the bottom of the screen. */
export const MINI_PLAYER_HEIGHT = 64;
/** Height of the top tab strip. */
export const TOP_TABS_HEIGHT = 46;
export const MAX_CONTENT_WIDTH = 720;
