/** Typed client for the OpenBeats Python API. */
import { absoluteUrl, getApiBase } from '@/lib/apiBase';
import type {
  Facets,
  Playlist,
  PlaylistDetail,
  Stats,
  Track,
  TrackPage,
  TrackSort,
  TrackUpdate,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT = 20_000;

async function request<T>(path: string, init: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(absoluteUrl(path), {
      ...init,
      signal: controller.signal,
      headers:
        init.body instanceof FormData
          ? init.headers
          : { Accept: 'application/json', ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const payload = await response.json();
        if (typeof payload?.detail === 'string') detail = payload.detail;
        else if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) detail = payload.detail[0].msg;
      } catch {
        // keep the generic message
      }
      throw new ApiError(response.status, detail);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'The API took too long to respond.');
    }
    throw new ApiError(0, `Cannot reach the API at ${getApiBase()}. Is it running?`);
  } finally {
    clearTimeout(timer);
  }
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export type UploadAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  file?: File | null;
};

export const api = {
  /** Current API origin (respects a device-set override). */
  get baseUrl(): string {
    return getApiBase();
  },

  health: () => request<{ status: string; app: string; version: string; storage: string }>('/api/health', {}, 8000),

  stats: () => request<Stats>('/api/tracks/stats'),

  facets: () => request<Facets>('/api/tracks/facets'),

  listTracks: (params: {
    q?: string;
    artist?: string;
    album?: string;
    genre?: string;
    sort?: TrackSort;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}) => request<TrackPage>(`/api/tracks${query({ limit: 1000, ...params })}`),

  /** Fetch a set of tracks in a caller-defined order. */
  tracksByIds: (ids: number[]) =>
    ids.length
      ? request<TrackPage>(`/api/tracks${query({ ids: ids.join(',') })}`)
      : Promise.resolve<TrackPage>({ items: [], total: 0, limit: 0, offset: 0 }),

  getTrack: (id: number) => request<Track>(`/api/tracks/${id}`),

  updateTrack: (id: number, patch: TrackUpdate) =>
    request<Track>(`/api/tracks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  deleteTrack: (id: number) => request<void>(`/api/tracks/${id}`, { method: 'DELETE' }),

  registerPlay: (id: number) => request<Track>(`/api/tracks/${id}/play`, { method: 'POST' }),

  /** Back-fill a duration the player discovered, so lists stop showing "--:--". */
  reportDuration: (id: number, duration: number) =>
    request<Track>(`/api/tracks/${id}/duration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    }),

  uploadTrack: (
    asset: UploadAsset,
    meta: { title?: string; artist?: string; album?: string; genre?: string } = {},
  ) => {
    const form = new FormData();
    const name = asset.name ?? `upload-${Date.now()}.mp3`;

    if (asset.file) {
      form.append('file', asset.file, name);
    } else {
      // React Native needs this {uri,name,type} shape instead of a Blob.
      form.append('file', {
        uri: asset.uri,
        name,
        type: asset.mimeType ?? 'audio/mpeg',
      } as unknown as Blob);
    }
    for (const [key, value] of Object.entries(meta)) {
      if (value) form.append(key, value);
    }

    return request<Track>('/api/tracks/upload', { method: 'POST', body: form }, 180_000);
  },

  listPlaylists: () => request<Playlist[]>('/api/playlists'),

  getPlaylist: (id: number) => request<PlaylistDetail>(`/api/playlists/${id}`),

  createPlaylist: (input: { name: string; description?: string; accent?: string }) =>
    request<PlaylistDetail>('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),

  updatePlaylist: (id: number, input: { name?: string; description?: string; accent?: string }) =>
    request<PlaylistDetail>(`/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),

  deletePlaylist: (id: number) => request<void>(`/api/playlists/${id}`, { method: 'DELETE' }),

  addTrackToPlaylist: (playlistId: number, trackId: number) =>
    request<PlaylistDetail>(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId }),
    }),

  removeTrackFromPlaylist: (playlistId: number, trackId: number) =>
    request<PlaylistDetail>(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),

  reorderPlaylist: (playlistId: number, trackIds: number[]) =>
    request<PlaylistDetail>(`/api/playlists/${playlistId}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_ids: trackIds }),
    }),
};

export const mediaUrl = (track: Track): string => absoluteUrl(track.stream_url);
export const artworkUrl = (track: Track): string | null =>
  track.artwork_url ? absoluteUrl(track.artwork_url) : null;

export type { Facets, Playlist, PlaylistDetail, Stats, Track, TrackPage, TrackSort, TrackUpdate };
