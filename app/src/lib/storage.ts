/** Tiny typed wrapper around AsyncStorage (localStorage on web). */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'openbeats:';

export function scopedKey(key: string): string {
  return `${PREFIX}${key}`;
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(key));
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(key), JSON.stringify(value));
  } catch {
    // Storage being unavailable must never break playback.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(scopedKey(key));
  } catch {
    // ignore
  }
}
