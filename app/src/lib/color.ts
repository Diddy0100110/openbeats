/**
 * Deterministic cover art.
 *
 * Tracks in the demo catalogue have no embedded artwork, so instead of a grey
 * placeholder every album gets a stable gradient derived from its name. Same
 * album -> same colours, on every device, forever.
 */

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type CoverPalette = {
  colors: [string, string, string];
  angle: number;
};

export function coverPalette(seed: string): CoverPalette {
  const hash = hashString(seed || 'openbeats');
  const base = hash % 360;
  const shift = 30 + (hash % 50);

  return {
    colors: [
      `hsl(${base}, 70%, 52%)`,
      `hsl(${(base + shift) % 360}, 66%, 34%)`,
      `hsl(${(base + 210) % 360}, 55%, 16%)`,
    ],
    angle: (hash % 4) * 30,
  };
}
