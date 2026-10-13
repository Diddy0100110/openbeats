/** Small formatting helpers shared by every screen. */

/** `245` -> `"4:05"`, `3725` -> `"1:02:05"`. Returns `"--:--"` for unknown. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Same as `formatTime` but omits the seconds for compact "album length" labels. */
export function formatLongDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** `"Kevin MacLeod"` + `"Goldberg Variations"` -> `"KM"` / `"GV"`. */
export function initials(...values: (string | null | undefined)[]): string {
  const letters = values
    .filter(Boolean)
    .join(' ')
    .split(/[\s\-_/]+/)
    .filter((word) => /[a-z0-9]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase());
  return letters.join('') || '♪';
}

export function truncate(value: string, max = 60): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
