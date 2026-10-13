/**
 * Where the Python API lives.
 *
 * Resolution order:
 *   1. A user-set override, stored on the device (see the Settings screen).
 *      This means a deployed build can be pointed at any server without being
 *      rebuilt.
 *   2. `EXPO_PUBLIC_API_URL`, inlined at build time.
 *   3. In development, the host already serving the Expo bundle plus port 8000,
 *      so Expo Go works on a physical phone with no configuration.
 *   4. Localhost.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const DEFAULT_PORT = 8000;
const OVERRIDE_KEY = 'openbeats:apiBase';

function devHostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  if (!host || host === 'localhost') return null;
  return `http://${host}:${DEFAULT_PORT}`;
}

function computeBuildTimeBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;

  if (__DEV__) {
    const inferred = devHostFromExpo();
    if (inferred) return inferred;
  }

  return `http://127.0.0.1:${DEFAULT_PORT}`;
}

/** The URL baked in when this build was produced. */
export const BUILD_TIME_API_BASE = computeBuildTimeBase().replace(/\/+$/, '');

let override: string | null = null;

/** Accepts `http://x`, `https://x` or a bare `host`, always without a trailing slash. */
export function normaliseBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function getApiBase(): string {
  return override ?? BUILD_TIME_API_BASE;
}

export function hasOverride(): boolean {
  return override !== null;
}

/** Persist a new API base, or pass `null` to fall back to the built-in one. */
export function setApiBase(value: string | null): void {
  const normalised = value ? normaliseBase(value) : '';
  override = normalised || null;
  const write = normalised
    ? AsyncStorage.setItem(OVERRIDE_KEY, normalised)
    : AsyncStorage.removeItem(OVERRIDE_KEY);
  void write.catch(() => {});
}

/** Read the stored override. Call once, before the first API request. */
export async function loadApiBaseOverride(): Promise<string | null> {
  try {
    override = (await AsyncStorage.getItem(OVERRIDE_KEY)) || null;
  } catch {
    override = null;
  }
  return override;
}

/** Turn a relative API path (`/api/stream/3`) into an absolute URL. */
export function absoluteUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBase()}${path.startsWith('/') ? '' : '/'}${path}`;
}
