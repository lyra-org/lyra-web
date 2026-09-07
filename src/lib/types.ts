// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

export type EntityId = string;

export interface Session {
  token: string;
}

export type LoginResponse = Session;

// Generic paginated list response. Returned by the various list endpoints
// that switched from bare arrays to `{ items, next_cursor }`.
export interface Page<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface TrackResponse {
  id: string;
  title: string;
  track?: number;
  track_total?: number;
  disc?: number;
  disc_total?: number;
  duration_ms?: number;
  sort_title?: string;
  year?: number;
  releases?: ReleaseResponse[];
  artists?: ArtistResponse[];
}

export type PlaybackState =
  | "playing"
  | "paused"
  | "stopped"
  | "buffering"
  | "completed";

export interface PlaybackResponse {
  playback_session_id: string;
  track_id: string;
  user_id: string;
  position_ms: number;
  state: PlaybackState;
  activity_ms: number;
  // RFC 3339 UTC timestamp.
  updated_at: string;
  effective_position_ms: number;
  duration_ms?: number | null;
}

export type EntityType = "release" | "artist" | "track";

export interface RefreshResponse {
  refreshed: boolean;
  entity_type: EntityType;
  providers_called: string[];
}

export interface CoverResponse {
  id: string;
  url: string;
  mime_type: string;
  hash: string;
  blurhash?: string | null;
}

export interface ReleaseResponse {
  id: string;
  title: string;
  cover?: CoverResponse | null;
  release_date?: string | null;
  genres?: string[];
  sort_title?: string;
  artists?: ArtistResponse[];
  tracks?: TrackResponse[];
  entries?: EntryResponse[];
}

export interface GenreSummary {
  id: string;
  name: string;
}

export interface GenreResponse extends GenreSummary {
  parents?: GenreSummary[];
  children?: GenreSummary[];
}

export interface EntryResponse {
  id: string;
  full_path?: string | null;
  name: string;
  kind: string;
  size: number;
  // RFC 3339 timestamp of the file's last modification.
  modified_at: string;
  hash?: string | null;
  file_kind?: string | null;
  tracks?: TrackResponse[];
  releases?: ReleaseResponse[];
  artists?: ArtistResponse[];
}

export interface OptionResponse {
  name: string;
  label: string;
  type: string;
  default: boolean;
  available: boolean;
  unavailable_reason?: string | null;
}

export interface ProviderResponse {
  provider_id: string;
  display_name: string;
  priority: number;
  enabled: boolean;
  options: OptionResponse[];
}

export type SearchEntityType = "release" | "artist" | "track";

export interface ReleaseSearchResult {
  entity_type: "release";
  title: string;
  redirect_url: string;
  raw: unknown;
  artist_name?: string | null;
  release_date?: string | null;
  genres?: string[] | null;
  description?: string | null;
  sort_name?: string | null;
  sort_title?: string | null;
  ids?: Record<string, string> | null;
  cover_url?: string | null;
}

export interface ArtistSearchResult {
  entity_type: "artist";
  title: string;
  redirect_url: string;
  raw: unknown;
  artist_name?: string | null;
  sort_name?: string | null;
  description?: string | null;
  ids?: Record<string, string> | null;
  cover_url?: string | null;
}

export interface TrackSearchResult {
  entity_type: "track";
  title: string;
  redirect_url: string;
  raw: unknown;
  artist_name?: string | null;
  release_title?: string | null;
  sort_title?: string | null;
  duration_ms?: number | null;
  disc?: number | null;
  disc_total?: number | null;
  track?: number | null;
  track_total?: number | null;
  ids?: Record<string, string> | null;
  cover_url?: string | null;
}

export type SearchResult =
  | ReleaseSearchResult
  | ArtistSearchResult
  | TrackSearchResult;

export interface SearchTitleHit {
  id: string;
  title: string;
}

export interface SearchArtistHit {
  id: string;
  name: string;
}

export interface SearchResponse {
  tracks: SearchTitleHit[];
  artists: SearchArtistHit[];
  releases: SearchTitleHit[];
}

export interface ExternalIdResponse {
  provider_id: string;
  id_type: string;
  id_value: string;
  source: string;
}

export interface PlaylistTrackResponse {
  entry_id: string;
  track: TrackResponse;
  position: number;
  release?: ReleaseResponse | null;
  artists?: ArtistResponse[];
}

export interface LibraryResponse {
  id: string;
  name: string;
  directory?: string | null;
  language?: string | null;
  country?: string | null;
}

export interface PlaylistResponse {
  id: string;
  name: string;
  is_public: boolean;
  description?: string | null;
  tracks?: PlaylistTrackResponse[];
  owner_id?: string | null;
  created_at?: number | null;
  updated_at?: number | null;
}

export type CreditType =
  | "artist"
  | "vocalist"
  | "instrumentalist"
  | "composer"
  | "lyricist"
  | "arranger"
  | "writer"
  | "producer"
  | "conductor"
  | "engineer"
  | "mixer"
  | "remixer";

export type ArtistCreditSourceResponse = "track" | "release";

export interface ArtistCreditResponse {
  type: CreditType;
  detail?: string | null;
  source: ArtistCreditSourceResponse;
}

export type ArtistRelationType = "voice_actor" | "member_of";
export type RelationDirectionResponse = "incoming" | "outgoing";

export type ArtistType = string;

export interface RelatedArtistResponse {
  id: string;
  name: string;
  artist_type?: ArtistType | null;
  cover?: CoverResponse | null;
}

export interface ArtistRelationResponse {
  type: ArtistRelationType;
  direction: RelationDirectionResponse;
  artist: RelatedArtistResponse;
  attributes?: string | null;
}

export interface ArtistResponse {
  id: string;
  name: string;
  verified: boolean;
  sort_name?: string | null;
  description?: string | null;
  cover?: CoverResponse | null;
  credit?: ArtistCreditResponse | null;
  relations?: ArtistRelationResponse[];
  releases?: ReleaseResponse[];
  tracks?: TrackResponse[];
}

export interface LyricsWordResponse {
  ts_ms: number;
  char_start: number;
  char_end: number;
}

export interface LyricsLineResponse {
  ts_ms: number;
  text: string;
  words: LyricsWordResponse[];
}

export type LyricsOriginResponse = "user" | "plugin";

export interface LyricsResponse {
  id: string;
  provider_id: string;
  language: string;
  origin: LyricsOriginResponse;
  plain_text: string;
  has_word_cues: boolean;
  // RFC 3339 timestamp; updated only when content changes.
  updated_at: string;
  lines: LyricsLineResponse[];
}

export type TagColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "gray";

export interface TagResponse {
  id: string;
  tag: string;
  color: string;
  // RFC 3339 creation timestamp.
  created_at: string;
}

export interface TagListResponse {
  items: TagResponse[];
  next_cursor?: string | null;
}

export interface TargetListResponse {
  target_ids: string[];
  next_cursor?: string | null;
}

export interface TargetStateResponse {
  tagged: boolean;
}

// Library sync

export type LibrarySyncRunStatus =
  | "idle"
  | "queued"
  | "planning"
  | "running"
  | "cancelling"
  | "cancelled"
  | "succeeded"
  | "failed";

export type LibrarySyncRunKind = "library_sync" | "library_refresh";

export type LibrarySyncProgressMode =
  | "indeterminate"
  | "estimating"
  | "determinate";

export type LibrarySyncTotalState = "discovering" | "estimated" | "final";

export type LibrarySyncStage =
  | "discover"
  | "entry_sync"
  | "metadata_parse"
  | "metadata_apply"
  | "provider_refresh"
  | "local_cover_metadata"
  | "lyrics"
  | "provider_cover"
  | "cleanup";

export interface LibrarySyncRun {
  status: LibrarySyncRunStatus;
  kind: LibrarySyncRunKind;
  library_id: string;
  id?: string | null;
  // RFC 3339 timestamps.
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  cancellation_requested?: boolean;
}

export interface LibrarySyncProgress {
  mode: LibrarySyncProgressMode;
  total_state: LibrarySyncTotalState;
  completed_units: number;
  failed_units: number;
  skipped_units: number;
  total_units: number;
}

export interface LibrarySyncCurrent {
  stage: LibrarySyncStage;
  subject?: string | null;
}

export interface LibrarySyncStatus {
  run: LibrarySyncRun;
  progress: LibrarySyncProgress;
  current?: LibrarySyncCurrent | null;
  active_units: number;
  failure_count: number;
  sequence: number;
}

export interface LibrarySyncStartResponse {
  started: boolean;
  run: LibrarySyncStatus;
}

export interface CoverSearchCandidateResponse {
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface ProviderCoverSearchResponse {
  provider_id: string;
  candidates: CoverSearchCandidateResponse[];
  selected_index?: number | null;
}

export interface ReleaseCoverSearchResponse {
  release_id: string;
  results: ProviderCoverSearchResponse[];
}

export interface ArtistCoverSearchResponse {
  artist_id: string;
  results: ProviderCoverSearchResponse[];
}

export interface SyncResponse {
  started: boolean;
  provider_id: string;
}

export type Permission =
  | "admin"
  | "manage_users"
  | "manage_roles"
  | "manage_libraries"
  | "sync_metadata"
  | "manage_plugins"
  | "manage_providers"
  | "manage_metadata"
  | "download";

export interface MeResponse {
  id: string;
  username: string;
  role?: string | null;
  permissions?: Permission[];
}

export interface PublicUser {
  id: string;
  username: string;
  role?: string | null;
}

export interface ServerInfoResponse {
  server_id: string;
  version: string;
  setup_complete: boolean;
}

export interface PlaybackUrlResponse {
  stream_url: string;
  hls_url: string;
  download_url?: string | null;
  // RFC 3339 absolute media-token expiration.
  expires_at: string;
  idle_expires_after_seconds: number;
}

export type EntityParam = "track" | "release" | "artist" | "playlist";

export interface FavoriteItem {
  target_id: string;
  entity: string;
  // RFC 3339 timestamps.
  first_favorited_at: string;
  last_refreshed_at: string;
}

export type FavoriteListResponse = Page<FavoriteItem>;

export interface FavoriteStateResponse {
  favorited: boolean;
}

export interface CheckRequest {
  target_ids: string[];
}

export interface CheckResponse {
  favorited: Record<string, boolean>;
}

// Plugins

export interface PluginManifestResponse {
  schema_version: number;
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string;
}

export interface ChoiceOptionResponse {
  value: string;
  label: string;
  description?: string | null;
}

export type FieldResponse =
  | {
      type: "string";
      key: string;
      label: string;
      required: boolean;
      description?: string | null;
      value?: string | null;
    }
  | {
      type: "number";
      key: string;
      label: string;
      required: boolean;
      description?: string | null;
      value?: number | null;
      min?: number | null;
      max?: number | null;
    }
  | {
      type: "bool";
      key: string;
      label: string;
      required: boolean;
      description?: string | null;
      value?: boolean | null;
    }
  | {
      type: "choice";
      key: string;
      label: string;
      required: boolean;
      description?: string | null;
      value?: string | null;
      options: ChoiceOptionResponse[];
    };

export interface GroupResponse {
  id: string;
  label: string;
  fields: FieldResponse[];
}

export interface PluginSettingsResponse {
  plugin_id: string;
  groups: GroupResponse[];
}

export type PluginSettingsStatus =
  | "ready"
  | "initializing"
  | "not_declared"
  | "invalid";

export type PluginSettingsEntry =
  | { status: "ready"; plugin_id: string; groups: GroupResponse[] }
  | { status: "initializing"; plugin_id: string }
  | { status: "not_declared"; plugin_id: string }
  | { status: "invalid"; plugin_id: string; message: string };

export interface PluginSettingsListResponse {
  entries: PluginSettingsEntry[];
}

export type PluginSettingsScope = "server" | "user";

export type PluginSettingValue = string | number | boolean | null;

// WebSocket remote control protocol (AsyncAPI: /ws)

export type RemoteAction =
  | "play"
  | "pause"
  | "unpause"
  | "stop"
  | "seek"
  | "next_track"
  | "previous_track"
  | "set_volume";

export type ResponseStatus = "ok" | "error";

export interface DeclareCapabilitiesCommand {
  action: "declare_capabilities";
  id: string;
  commands: RemoteAction[];
}

export interface BasicRemoteCommand {
  action:
    | "play"
    | "pause"
    | "unpause"
    | "stop"
    | "next_track"
    | "previous_track";
  id: string;
  target: string;
}

export interface SeekCommand {
  action: "seek";
  id: string;
  target: string;
  position_ms: number;
}

export interface SetVolumeCommand {
  action: "set_volume";
  id: string;
  target: string;
  level: number;
}

export type ClientCommand =
  | DeclareCapabilitiesCommand
  | BasicRemoteCommand
  | SeekCommand
  | SetVolumeCommand;

export interface ResponseMessage {
  type: "response";
  id: string;
  status: ResponseStatus;
  error?: string | null;
}

export interface EventMessage {
  type: "event";
  event: string;
  data: unknown;
}

export type ForwardedCommand =
  | {
      type: "command";
      action:
        | "play"
        | "pause"
        | "unpause"
        | "stop"
        | "next_track"
        | "previous_track";
      from?: number | null;
    }
  | {
      type: "command";
      action: "seek";
      from?: number | null;
      position_ms: number;
    }
  | {
      type: "command";
      action: "set_volume";
      from?: number | null;
      level: number;
    };

export type OutgoingMessage = ResponseMessage | EventMessage | ForwardedCommand;

export interface ActivePlaybackSession {
  playback_session_id: string;
  track_id: string;
  user_id: string;
  position_ms: number;
  effective_position_ms: number;
  duration_ms?: number | null;
  state: PlaybackState;
  activity_ms: number;
  updated_at: string;
  connection_session_key?: string | null;
  connection_token?: string | null;
  supported_commands: RemoteAction[];
  remote_control_degraded: boolean;
}
