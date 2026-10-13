/** Shared response shapes — these mirror the FastAPI Pydantic schemas. */

export type Track = {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  year: number | null;
  duration: number | null;
  track_number: number | null;
  mime_type: string;
  size_bytes: number | null;
  has_artwork: boolean;
  plays: number;
  origin: 'upload' | 'remote';
  attribution: string | null;
  lyrics: string | null;
  created_at: string | null;
  stream_url: string;
  artwork_url: string | null;
};

export type TrackPage = {
  items: Track[];
  total: number;
  limit: number;
  offset: number;
};

export type GroupCount = {
  name: string;
  track_count: number;
  total_duration: number | null;
};

export type Facets = {
  artists: GroupCount[];
  albums: GroupCount[];
  genres: GroupCount[];
};

export type Stats = {
  tracks: number;
  albums: number;
  artists: number;
  playlists: number;
  total_duration: number;
  total_plays: number;
};

export type Playlist = {
  id: number;
  name: string;
  description: string | null;
  accent: string;
  track_count: number;
  total_duration: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlaylistDetail = Playlist & { tracks: Track[] };

export type TrackUpdate = Partial<
  Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'year' | 'track_number' | 'lyrics' | 'attribution'>
>;

export type TrackSort =
  | 'title'
  | 'artist'
  | 'album'
  | 'genre'
  | 'duration'
  | 'plays'
  | 'created'
  | 'year';
