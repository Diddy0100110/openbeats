// Import the single icon set directly: importing from '@expo/vector-icons'
// pulls every icon font (~5 MB) into the web bundle.
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/useTheme';

export type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Falls back to the theme's primary text colour. */
  muted?: boolean;
};

export function Icon({ name, size = 22, color, muted = false }: Props) {
  const theme = useTheme();
  const resolved = color ?? (muted ? theme.textSecondary : theme.text);
  return <Ionicons name={name} size={size} color={resolved} />;
}
