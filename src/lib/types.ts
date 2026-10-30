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
  id: string;
  user_id: string;
  // Null for plugin-reported playback without a server-managed queue.
  queue_revision: number | null;
  current: CurrentPlayback | null;
  created_at: string;
  updated_at: string;
  controller?: PlaybackController | null;
}

export interface CurrentPlayback {
  track_id: string;
  client_name: string | null;
  position_ms: number;
  state: PlaybackState;
  activity_ms: number;
  // RFC 3339 UTC timestamp.
  updated_at: string;
  effective_position_ms: number;
  duration_ms?: number | null;
}

export interface PlaybackController {
  connection_token: string;
  connection_session_key: string;
  client_name: string | null;
  supported_commands: RemoteAction[];
  remote_control_degraded: boolean;
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
  cover?: CoverResponse | null;
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

export type OptionValue = boolean | number | string;

// An option a provider accepts on refresh, as declared by its plugin.
export interface OptionResponse {
  name: string;
  label: string;
  type: "boolean" | "number" | "string";
  default: OptionValue | null;
  available: boolean;
  unavailable_reason?: string | null;
}

// Option values by provider ID, then option name.
export type ProviderOptionValues = Record<string, Record<string, OptionValue>>;

export interface ProviderResponse {
  provider_id: string;
  display_name: string;
  position: number;
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

export interface ExternalIdResponse {
  provider_id: string;
  id_type: string;
  id_value: string;
  source: "manual" | "resolved";
  // The provider's value beneath a manual one.
  resolved_value?: string;
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

export interface LibraryAccessResponse {
  id: string;
  username: string;
  role?: string | null;
}

export interface PlaylistResponse {
  id: string;
  name: string;
  is_public: boolean;
  track_count: number;
  total_duration_ms: number;
  cover?: CoverResponse | null;
  description?: string | null;
  tracks?: PlaylistTrackResponse[];
  owner_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  words?: LyricsWordResponse[];
}

export interface LyricsResponse {
  id: string;
  provider_id?: string | null;
  language: string;
  scope: "personal" | "shared";
  source: "manual" | "provider";
  plain_text: string;
  has_word_cues: boolean;
  // RFC 3339 timestamp; updated only when content changes.
  updated_at: string;
  lines?: LyricsLineResponse[];
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

export type TargetListResponse = Page<string>;

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
  | "manage_server"
  | "download";

export interface MeResponse {
  id: string;
  username: string;
  role?: string | null;
  permissions?: Permission[];
}

export interface RoleResponse {
  id: string;
  name: string;
  permissions: Permission[];
  builtin: boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  role?: string | null;
}

export interface SetupStatus {
  account_required: boolean;
  plugin_selection_required: boolean;
}

export interface ServerInfoResponse {
  server_id: string;
  version: string;
  published_url?: string | null;
  setup: SetupStatus;
  auth_enabled: boolean;
}

export interface PlaybackUrlResponse {
  stream_url?: string | null;
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
  id: string;
  name: string;
  version: string;
  description: string;
  source: PluginSourceResponse;
}

// `local` plugins were placed in the plugins directory by hand and cannot be
// updated or uninstalled through the API. `invalid` plugins carry a source
// record the server could not read; they can be uninstalled or reinstalled.
export type PluginSourceResponse =
  | { kind: "local" }
  | { kind: "invalid"; error: string }
  | ({ kind: "repository" } & RepositorySourceResponse & UpdateStatus);

export interface RepositorySourceResponse {
  origin: string;
  ref?: string | null;
  version: string;
  commit: string;
  // Tag and commit installs never move; branch installs track new releases.
  pinned: boolean;
  // The release the subscribed repository offered at its last refresh or
  // daily check.
  offered?: OfferedReleaseResponse | null;
  // Why an available update waits for an admin.
  hold?: PluginHold | null;
  installed_at?: string | null;
  // Set when the daily check, not a person, installed the release.
  installed_automatically: boolean;
}

// Compares the installed version with the offered release; no forge call is
// made. Pinned plugins are always `up_to_date`. `incompatible`: no release
// runs on this server, and `requires` names the requirement excluding it.
// `unknown`: no subscription with the same origin and ref lists the plugin, or
// its repository has no offer for it, and `reason` says which.
export type UpdateStatus =
  | { status: "up_to_date" }
  | { status: "update_available" }
  | { status: "incompatible"; requires: string }
  | { status: "unknown"; reason: string };

export interface OfferedReleaseResponse {
  version: string;
  // An update request names this commit to approve the release.
  commit: string;
  scopes: string[];
}

// An update request naming the release approves an `adds_scopes` hold. The
// other holds apply no update until the plugins involved change.
export type PluginHold =
  | { reason: "adds_scopes"; gains: ScopeGainResponse[] }
  | { reason: "breaks_dependents"; dependents: PluginRequirement[] }
  | { reason: "unmet_dependencies"; dependencies: PluginRequirement[] }
  | { reason: "dependency_cycle"; plugins: string[] };

// What one plugin would newly reach.
export interface ScopeGainResponse {
  plugin: string;
  risk: PluginRisk;
  effects: PluginEffect[];
  scopes: string[];
  // Dependencies whose scopes are unknown because they are not installed.
  unresolved_dependencies: string[];
}

export interface PluginRequirement {
  id: string;
  requires: string;
}

// `high`: adds endpoints or handles credentials. `elevated`: can send data off
// the server and touch personal or library data.
export type PluginRisk = "standard" | "elevated" | "high";

export interface PluginEffect {
  kind:
    | "egress"
    | "exposes"
    | "authority"
    | "reads_personal"
    | "writes_personal"
    | "writes_library";
  // The data concerned, for the personal and library kinds.
  data?: string | null;
  // The plugins whose scopes give the effect.
  via?: string[];
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
  groups: GroupResponse[];
}

export type PluginSettingsStatus =
  | "ready"
  | "initializing"
  | "not_declared"
  | "invalid";

// Listings only include plugins that declare the requested scope.
export type PluginSettingsEntry = {
  plugin_id: string;
  name: string;
  version: string;
} & (
  | { status: "ready"; groups: GroupResponse[] }
  | { status: "initializing" }
  | { status: "invalid"; message: string }
);

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

export interface ActivePlayback {
  playback_id: string;
  track_id: string;
  user_id: string;
  client_name: string | null;
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

// Plugin repositories

// A subscription as the server stored it at its last refresh, update check or
// daily check.
export interface PluginRepository {
  id: string;
  origin: string;
  name: string;
  description: string;
  ref?: string | null;
  // `resolved_ref`, `commit` and `refreshed_at` are absent until the first
  // refresh.
  resolved_ref?: string | null;
  commit?: string | null;
  refreshed_at?: string | null;
  // What it offered at that refresh, with statuses against the plugins
  // installed now. Requested with `inc=plugins`; always set on add and
  // refresh.
  plugins?: PluginPreviewResponse[] | null;
}

// A subscription with its `plugins`, as add, refresh and `inc=plugins` return
// it.
export type CatalogRepository = PluginRepository & {
  plugins: PluginPreviewResponse[];
};

// Every subscription, as stored after refreshing them all. A failed one keeps
// what it stored before.
export interface RefreshPluginRepositoriesResponse {
  repositories: CatalogRepository[];
  failed: { id: string; error: string }[];
}

// `unknown`: the source record cannot be read, or the repository has no offer
// for the plugin. `local`: installed without a source record.
export type CatalogStatus =
  | { status: "available" }
  | UpdateStatus
  | { status: "local" };

export type PluginPreviewResponse = {
  id: string;
  name: string;
  version: string;
  description: string;
  // Capability scopes the release declares, which installing it grants.
  scopes: string[];
  access?: PluginAccessResponse | null;
  // The release an install takes; requests name it with the plugin id.
  commit?: string | null;
  // Present only when the repository index points at another repository.
  source?: { origin: string } | null;
  // Why the plugin has no installable release; `name`, `version`,
  // `description` and `scopes` are then empty. An `unknown` status's `reason`
  // can repeat it.
  error?: string | null;
} & CatalogStatus;

// What a plugin could do once installed, through its own scopes and those of
// every plugin it depends on.
export interface PluginAccessResponse {
  risk: PluginRisk;
  effects: PluginEffect[];
  scopes: { scope: string; via: string[] }[];
  unresolved_dependencies: string[];
  // Installed plugins that would reach more once this one is installed.
  widens: ScopeGainResponse[];
}

// A repository URL as resolved now, before subscribing to it.
export interface RepositoryPreview {
  origin: string;
  name: string;
  description: string;
  ref?: string | null;
  resolved_ref: string;
  commit?: string | null;
  plugins: PluginPreviewResponse[];
}

// A plugin bound to the release its preview or status showed.
export interface PreviewedPlugin {
  id: string;
  commit: string;
}

export interface InstalledPluginResponse {
  id: string;
  version: string;
  commit: string;
}

export interface FailedInstallResponse {
  id: string;
  error: string;
}

export interface HeldPluginResponse {
  id: string;
  release: OfferedReleaseResponse;
  hold: PluginHold;
}

export interface InstallPluginsResponse {
  installed: InstalledPluginResponse[];
  // Reinstalls that would leave a plugin unable to load.
  held: HeldPluginResponse[];
  failed: FailedInstallResponse[];
}

export interface UpdatePluginsResponse {
  updated: InstalledPluginResponse[];
  up_to_date: string[];
  incompatible: PluginRequirement[];
  held: HeldPluginResponse[];
  failed: FailedInstallResponse[];
}

export type ServerSettingValue = string | number | boolean | string[] | null;

interface ServerSettingProps {
  key: string;
  label: string;
  description: string;
  required: boolean;
  locked: boolean;
  source: "default" | "database" | "file";
  restart_required: boolean;
}

export type ServerSettingField = ServerSettingProps &
  (
    | { type: "string"; value: string | null; default: string | null }
    | {
        type: "number";
        value: number | null;
        default: number | null;
        min: number;
        max?: number;
      }
    | { type: "bool"; value: boolean | null; default: boolean | null }
    | { type: "string_list"; value: string[] | null; default: string[] | null }
  );

export interface ServerSettingsResponse {
  groups: { id: string; label: string; fields: ServerSettingField[] }[];
  pending_restart: string[];
  boot: { port: number; data_dir: string; db: { kind: string; path: string } };
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKeyResponse extends ApiKeyResponse {
  key: string;
}
