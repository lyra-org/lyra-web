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

export interface LibrarySearchResponse {
  tracks: Page<TrackResponse>;
  artists: Page<ArtistResponse>;
  releases: Page<ReleaseResponse>;
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
  chain?: TrackChainPosition;
}

// Where a track sits in its release chain: tracks Lyra keeps together and in
// order whenever it picks the play order.
export interface TrackChainPosition {
  id: string;
  // 0-based.
  position: number;
}

export interface ReleaseChain {
  // Changes whenever the release's chains are replaced.
  id: string;
  track_ids: string[];
}

export interface ReleaseChainsResponse {
  chains: ReleaseChain[];
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
  controller?: Connection | null;
}

export interface CurrentPlayback {
  track_id: string;
  play_id: string;
  client_name: string | null;
  // The plugin that reported the play; null for Lyra's own clients.
  plugin_id: string | null;
  position_ms: number;
  state: PlaybackState;
  played_ms: number;
  // RFC 3339 UTC timestamp.
  updated_at: string;
  effective_position_ms: number;
  duration_ms?: number | null;
}

// An open WebSocket connection of the user's, addressed by `id` as a remote
// control command's `target`.
export interface Connection {
  id: string;
  client_name: string | null;
  supported_commands: RemoteAction[];
  // Null when the connection is idle.
  playback_id: string | null;
  remote_control_degraded: boolean;
  // RFC 3339 UTC timestamp.
  connected_at: string;
}

export type RepeatMode = "none" | "one" | "all";

export interface QueueSnapshot {
  track_ids: string[];
  current_index: number;
  repeat_mode: RepeatMode;
  shuffle_enabled: boolean;
}

export interface QueueResponse extends QueueSnapshot {
  revision: number;
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

// One value a `choice` option takes.
export interface OptionChoice {
  value: string;
  label: string;
}

// An option a provider accepts on refresh, or a mixer on a mix, as declared by
// its plugin.
export interface OptionResponse {
  name: string;
  label: string;
  type: "boolean" | "number" | "string" | "choice";
  // The values a `choice` takes, in display order.
  options?: OptionChoice[];
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

export type MixSeedType = "track" | "release" | "artist" | "genre" | "playlist";

// What one of a mixer's handlers takes.
export interface MixHandlerResponse {
  seeds: MixSeedType[];
  max_seeds: number;
  exclude: boolean;
  query: boolean;
}

export interface MixerResponse {
  mixer_id: string;
  display_name: string;
  position: number;
  enabled: boolean;
  options: OptionResponse[];
  blend: MixHandlerResponse | null;
  path: MixHandlerResponse | null;
}

export interface MixersResponse {
  builtin: { blend: MixHandlerResponse };
  mixers: MixerResponse[];
}

export interface MixRequest {
  // Public IDs of tracks, releases, artists, genres or playlists.
  seeds?: string[];
  from_history?: boolean;
  // Leads the mix with its single track seed.
  pin_seed?: boolean;
  // A description of the mix, alone or alongside seeds.
  q?: string;
  // A path leads from the first of two track seeds to the second.
  shape?: "blend" | "path";
  limit?: number;
  // Option values keyed `<mixer_id>.<name>`.
  options?: Record<string, OptionValue>;
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

// Editable metadata of a release, track or artist, as returned by
// GET /entities/:id/metadata. `fields` lists exactly the fields the entity
// supports.
export type MetadataEntityType = "release" | "track" | "artist";

export type MetadataFieldName =
  | "release_title"
  | "track_title"
  | "artist_name"
  | "sort_title"
  | "sort_name"
  | "release_type"
  | "release_date"
  | "genres"
  | "labels"
  | "credits"
  | "year"
  | "disc"
  | "disc_total"
  | "track"
  | "track_total"
  | "artist_type"
  | "description"
  | "relations";

export interface MetadataFieldState {
  value: unknown;
  source: "manual" | "resolved";
}

export interface MetadataSnapshot {
  entity_id: string;
  entity_type: MetadataEntityType;
  fields: Partial<Record<MetadataFieldName, MetadataFieldState>>;
}

export type MetadataChange =
  | { field: MetadataFieldName; operation: "set"; value: unknown }
  | { field: MetadataFieldName; operation: "inherit" };

export interface MetadataFieldDiff {
  field: MetadataFieldName;
  before: MetadataFieldState;
  after: MetadataFieldState;
}

export type ReleaseType =
  | "album"
  | "single"
  | "ep"
  | "compilation"
  | "soundtrack"
  | "live"
  | "remix"
  | "broadcast"
  | "other"
  | "unknown";

export interface MetadataCreditValue {
  artist_id: string;
  type: CreditType;
  detail: string | null;
}

export interface MetadataLabelValue {
  id: string;
  name: string;
  catalog_number: string | null;
}

// A relation into the edited artist from `artist_id`, such as a band's member
// or a character's voice actor.
export interface MetadataRelationValue {
  artist_id: string;
  type: ArtistRelationType;
  attributes: string | null;
}

export interface LabelResponse {
  id: string;
  name: string;
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

export type ArtistType =
  | "person"
  | "group"
  | "character"
  | "orchestra"
  | "choir";

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

// The covers a refresh or sync fetches: none, only where none is set (the
// server's default), or replacing the ones already set.
export type CoverUpdate = "skip" | "missing" | "replace";

// The releases a library sync asks the providers about: those the scan found
// new or changed (the server's default), or every release.
export type SyncReleases = "changed" | "all";

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

export interface FavoriteStateResponse {
  favorited: boolean;
}

export interface CheckRequest {
  target_ids: string[];
}

export interface CheckResponse {
  favorited: Record<string, boolean>;
}

// A 1-5 rating for each submitted ID, null where unrated or not visible.
export interface CheckRatingsResponse {
  ratings: Record<string, number | null>;
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

// What one plugin would newly reach. `risk` judges everything it would reach
// then, `previous_risk` everything it reaches as installed.
export interface ScopeGainResponse {
  plugin: string;
  risk: PluginRisk;
  previous_risk: PluginRiskLevel;
  effects: PluginEffect[];
  scopes: string[];
  // Dependencies whose scopes are unknown because they are not installed.
  unresolved_dependencies: string[];
}

export interface PluginRequirement {
  id: string;
  requires: string;
}

// `high`: adds endpoints, handles credentials, or can send data off the server
// and touch every user's personal data. `elevated`: can send data off the
// server and touch personal or library data.
export type PluginRiskLevel = "standard" | "elevated" | "high";

export interface PluginRisk {
  level: PluginRiskLevel;
  // What sets `level`; empty at `standard`.
  reasons: PluginRiskReason[];
}

// `users`: `acting` for the users the plugin acts for, `all` for every user.
export type PluginUsers = "acting" | "all";

// `kind`, `data` and `users` are for logic; `description` is an English list
// item for display.
export interface PluginEffect {
  kind:
    | "egress"
    | "exposes"
    | "authority"
    | "reads_personal"
    | "writes_personal"
    | "writes_library";
  // A stable data id, such as `listening_history`, for the personal and
  // library kinds.
  data?: string | null;
  // Whose personal data it reaches, for the personal kinds.
  users?: PluginUsers | null;
  // The scopes giving the effect, each with the plugin declaring it.
  via: { plugin: string; scope: string }[];
  description: string;
}

// An effect, combined with sending data off the server where it needs it,
// that raises a plugin's risk.
export interface PluginRiskReason {
  kind:
    | "exposes"
    | "authority"
    | "sends_personal"
    | "changes_personal"
    | "changes_library";
  data?: string | null;
  users?: PluginUsers | null;
  description: string;
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
  | "set_volume"
  | "handoff_queue";

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

export interface HandoffQueueCommand {
  action: "handoff_queue";
  id: string;
  target: string;
  playback_id: string;
  queue_revision: number;
}

export type ClientCommand =
  | DeclareCapabilitiesCommand
  | BasicRemoteCommand
  | SeekCommand
  | SetVolumeCommand
  | HandoffQueueCommand;

export interface ResponseMessage {
  type: "response";
  id: string;
  status: ResponseStatus;
  error?: string | null;
}

export type EventMessage = { type: "event" } & (
  | { event: "connected" | "connection_updated"; data: Connection }
  | { event: "connection_closed"; data: { id: string } }
  | { event: "sync_required"; data: Record<string, never> }
  | { event: "playback_state_changed"; data: unknown }
);

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
      from?: string | null;
    }
  | {
      type: "command";
      action: "seek";
      from?: string | null;
      position_ms: number;
    }
  | {
      type: "command";
      action: "set_volume";
      from?: string | null;
      level: number;
    }
  | {
      type: "command";
      action: "handoff_queue";
      from?: string | null;
      playback_id: string;
      queue_revision: number;
      // The current track's play, which this connection continues.
      play_id?: string | null;
      handoff_token: string;
    };

export type OutgoingMessage = ResponseMessage | EventMessage | ForwardedCommand;

// A playback with a current track, flattened for listing devices.
export interface ActivePlayback extends CurrentPlayback {
  playback_id: string;
  // Null for plugin-reported playback without a server-managed queue.
  queue_revision: number | null;
  // The connection driving the playback, if any.
  connection_id: string | null;
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
  // Each scope reached, with the plugins declaring it.
  reached_scopes: { scope: string; via: string[] }[];
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
