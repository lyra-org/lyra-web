// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ApiKeyResponse,
  CreatedApiKeyResponse,
  ReleaseResponse,
  ReleaseChainsResponse,
  ReleaseCoverSearchResponse,
  ArtistCoverSearchResponse,
  ArtistResponse,
  GenreResponse,
  TrackResponse,
  PlaybackResponse,
  PlaybackState,
  ActivePlayback,
  Connection,
  QueueResponse,
  QueueSnapshot,
  RefreshResponse,
  ProviderResponse,
  ProviderOptionValues,
  CoverUpdate,
  SyncReleases,
  SearchResult,
  SearchEntityType,
  LibrarySearchResponse,
  ExternalIdResponse,
  LabelResponse,
  MetadataChange,
  MetadataFieldDiff,
  MetadataSnapshot,
  EntryResponse,
  LibraryAccessResponse,
  LibraryResponse,
  LibrarySyncStatus,
  LibrarySyncStartResponse,
  PlaylistResponse,
  PlaylistTrackResponse,
  TagResponse,
  TagListResponse,
  TagColor,
  SyncResponse,
  Session,
  LoginResponse,
  MeResponse,
  PublicUser,
  RoleResponse,
  ServerInfoResponse,
  ServerSettingsResponse,
  ServerSettingValue,
  FavoriteStateResponse,
  CheckRatingsResponse,
  CheckResponse,
  TargetListResponse,
  TargetStateResponse,
  PluginManifestResponse,
  PluginSettingsResponse,
  PluginSettingsEntry,
  PluginSettingValue,
  CatalogRepository,
  PluginRepository,
  PreviewedPlugin,
  RefreshPluginRepositoriesResponse,
  RepositoryPreview,
  InstallPluginsResponse,
  UpdatePluginsResponse,
  Page,
  PlaybackUrlResponse,
  LyricsResponse,
  MixRequest,
  MixersResponse,
} from "./types";
import { getAuth } from "./auth.svelte.ts";

const BASE = "/api";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const CONNECTION_SESSION_KEY = makeId();

// Names this browser to the user's other devices, such as "Firefox on Linux".
function browserClientName(): string | undefined {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? undefined;
}

export function connectionSessionKey(): string {
  return CONNECTION_SESSION_KEY;
}

export class ApiError extends Error {
  status: number;
  method: string;
  path: string;
  constructor(status: number, method: string, path: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getAuth().token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(
  res: Response,
  method: string,
  path: string,
  token = getAuth().token,
) {
  if (res.status === 401) {
    if (getAuth().token === token) getAuth().logout();
    throw new ApiError(401, method, path, "Unauthorized");
  }
  if (!res.ok) {
    let message = "The request failed.";
    const contentType = res.headers.get("Content-Type")?.split(";")[0].trim();
    if (contentType === "text/plain") {
      const body = await res.text().catch(() => "");
      message =
        body
          .trim()
          .replace(/^Error:\s*/, "")
          .trim() || message;
    }
    throw new ApiError(res.status, method, path, message);
  }
}

async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = getAuth().token;
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), signal });
  await handleResponse(res, "GET", path, token);
  return parseBody<T>(res);
}

export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return items;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  await handleResponse(res, "POST", path);
  return parseBody<T>(res);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  await handleResponse(res, "PATCH", path);
  return parseBody<T>(res);
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: authHeaders(
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    ),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await handleResponse(res, "PUT", path);
  return parseBody<T>(res);
}

async function del<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(
      body ? { "Content-Type": "application/json" } : undefined,
    ),
    body: body ? JSON.stringify(body) : undefined,
  });
  await handleResponse(res, "DELETE", path);
  return parseBody<T>(res);
}

// Auth & Server

export function loginUser(
  username: string,
  password: string,
): Promise<Session> {
  return post<LoginResponse>("/users/login", {
    username,
    password,
    client_name: browserClientName(),
  });
}

// Revokes the current session on the server. Failures are ignored so that
// signing out still works when the server is unreachable.
export async function endSession(): Promise<void> {
  const token = getAuth().token;
  if (token == null) return;
  await fetch(`${BASE}/users/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export function fetchMe(): Promise<MeResponse> {
  return get<MeResponse>("/me?inc=permissions");
}

export function fetchServerInfo(): Promise<ServerInfoResponse> {
  return get<ServerInfoResponse>("/server/public");
}

export function updateServerSetup(opts: {
  plugin_selection_skipped: boolean;
}): Promise<void> {
  return patch<void>("/server/setup", opts);
}

// Releases (formerly "albums" in this UI)

// Search returns these list shapes, so its pages continue on the list endpoints.
const RELEASE_LIST_INC = "artists,covers";
const ARTIST_LIST_INC = "covers";
const TRACK_LIST_INC = "releases,artists,release_covers";

// Narrows a track, release or artist list by the user's favorites, listens or
// ratings.
export interface ListFilter {
  favorite?: boolean;
  listened?: boolean;
  rated?: boolean;
}

function setListFilter(params: URLSearchParams, filter?: ListFilter) {
  if (filter?.favorite != null) params.set("favorite", String(filter.favorite));
  if (filter?.listened != null) params.set("listened", String(filter.listened));
  if (filter?.rated != null) params.set("rated", String(filter.rated));
}

export function fetchReleases(opts?: {
  libraryId?: string;
  query?: string;
  signal?: AbortSignal;
  genreId?: string;
  cursor?: string;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  filter?: ListFilter;
  limit?: number;
}): Promise<Page<ReleaseResponse>> {
  const params = new URLSearchParams({ inc: RELEASE_LIST_INC });
  if (opts?.query != null) params.set("query", opts.query);
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.genreId) params.set("genre_id", opts.genreId);
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  setListFilter(params, opts?.filter);
  return get<Page<ReleaseResponse>>(`/releases?${params}`, opts?.signal);
}

export function fetchRelease(id: string): Promise<ReleaseResponse> {
  return get<ReleaseResponse>(
    `/releases/${id}?inc=artists,tracks,covers,track_artists`,
  );
}

export function fetchReleaseChains(id: string): Promise<ReleaseChainsResponse> {
  return get<ReleaseChainsResponse>(
    `/releases/${encodeURIComponent(id)}/chains`,
  );
}

// Replaces every chain on the release; each chain lists its track ids in play
// order.
export function replaceReleaseChains(
  id: string,
  chains: string[][],
): Promise<ReleaseChainsResponse> {
  return put<ReleaseChainsResponse>(
    `/releases/${encodeURIComponent(id)}/chains`,
    { chains },
  );
}

export function fetchGenres(opts?: {
  libraryId?: string;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  cursor?: string;
  limit?: number;
}): Promise<Page<GenreResponse>> {
  const params = new URLSearchParams({ inc: "covers" });
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const query = params.toString();
  return get<Page<GenreResponse>>(`/genres${query ? `?${query}` : ""}`);
}

export function fetchGenre(
  id: string,
  opts?: { inc?: ("parents" | "children" | "covers")[] },
): Promise<GenreResponse> {
  const params = new URLSearchParams();
  if (opts?.inc?.length) params.set("inc", opts.inc.join(","));
  const query = params.toString();
  return get<GenreResponse>(`/genres/${id}${query ? `?${query}` : ""}`);
}

export function fetchTrack(id: string): Promise<TrackResponse> {
  return get<TrackResponse>(`/tracks/${id}`);
}

export function fetchTrackDetail(id: string): Promise<TrackResponse> {
  return get<TrackResponse>(
    `/tracks/${id}?inc=releases,artists,release_covers,artist_covers`,
  );
}

export function fetchTrackWithArtists(id: string): Promise<TrackResponse> {
  return get<TrackResponse>(`/tracks/${id}?inc=artists`);
}

const MIX_INC = "releases,artists,release_covers";

export function fetchMix(request: MixRequest): Promise<TrackResponse[]> {
  return post<TrackResponse[]>(`/mix?inc=${MIX_INC}`, request);
}

export function fetchMixers(): Promise<MixersResponse> {
  return get<MixersResponse>("/mixers");
}

export async function fetchTrackForRemote(id: string): Promise<TrackResponse> {
  const track = await get<TrackResponse>(`/tracks/${id}?inc=artists,releases`);
  const firstRelease = track.releases?.[0];
  if (firstRelease && !firstRelease.cover) {
    try {
      const r = await get<ReleaseResponse>(
        `/releases/${firstRelease.id}?inc=covers`,
      );
      firstRelease.cover = r.cover ?? null;
    } catch {
      // leave cover absent — UI falls back to placeholder
    }
  }
  return track;
}

export async function fetchActivePlaybacks(): Promise<ActivePlayback[]> {
  const sessions: ActivePlayback[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await fetchPlaybacks(true, cursor, true);
    for (const playback of page.items) {
      if (playback.current == null) continue;
      sessions.push({
        ...playback.current,
        playback_id: playback.id,
        queue_revision: playback.queue_revision,
        connection_id: playback.controller?.id ?? null,
      });
    }
    cursor = page.next_cursor;
  } while (cursor);
  return sessions;
}

export function fetchConnections(): Promise<Connection[]> {
  return get<Connection[]>("/me/connections");
}

// A single-use ticket that opens one WebSocket, so the session token stays out
// of the socket URL.
export async function createConnectionTicket(): Promise<string> {
  const { ticket } = await post<{ ticket: string; expires_at: string }>(
    "/me/connections/tickets",
    {},
  );
  return ticket;
}

// Artists

export function fetchArtists(opts?: {
  libraryId?: string;
  query?: string;
  signal?: AbortSignal;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  cursor?: string;
  filter?: ListFilter;
  limit?: number;
}): Promise<Page<ArtistResponse>> {
  const params = new URLSearchParams({ inc: ARTIST_LIST_INC });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.query != null) params.set("query", opts.query);
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  setListFilter(params, opts?.filter);
  return get<Page<ArtistResponse>>(`/artists?${params}`, opts?.signal);
}

export function fetchArtist(id: string): Promise<ArtistResponse> {
  return get<ArtistResponse>(
    `/artists/${id}?inc=releases,relations,covers,relation_covers,release_artists,release_covers`,
  );
}

// Covers

export function coverUrl(coverId: string): string {
  return `${BASE}/covers/${coverId}`;
}

// Streaming & Download
//
// Streaming/download endpoints require bearer auth, which the browser's
// <audio> element cannot send. Call createPlaybackUrl() to mint a
// scoped media_token URL usable as an audio src.

export function createPlaybackUrl(
  trackId: string,
  format?: "mp3",
): Promise<PlaybackUrlResponse> {
  const query = format ? `?format=${format}` : "";
  return post<PlaybackUrlResponse>(
    `/tracks/${trackId}/playback-url${query}`,
    {},
  );
}

// Playback

export function createPlayback(
  queue: QueueSnapshot,
  playId: string,
  durationMs?: number | null,
  positionMs?: number | null,
  state?: PlaybackState | null,
): Promise<PlaybackResponse> {
  return post<PlaybackResponse>("/me/playbacks", {
    ...queue,
    play_id: playId,
    connection_session_key: CONNECTION_SESSION_KEY,
    duration_ms: durationMs ?? undefined,
    position_ms: positionMs ?? undefined,
    state: state ?? undefined,
  });
}

export function fetchPlayback(id: string): Promise<PlaybackResponse> {
  return get<PlaybackResponse>(`/me/playbacks/${encodeURIComponent(id)}`);
}

// Pass `revision` to require exactly that revision, as a handoff does.
export function fetchPlaybackQueue(
  playbackId: string,
  revision?: number,
): Promise<QueueResponse> {
  const query = revision != null ? `?revision=${revision}` : "";
  return get<QueueResponse>(
    `/me/playbacks/${encodeURIComponent(playbackId)}/queue${query}`,
  );
}

export function replacePlaybackQueue(
  playbackId: string,
  expectedRevision: number,
  queue: QueueSnapshot,
): Promise<QueueResponse> {
  return put<QueueResponse>(
    `/me/playbacks/${encodeURIComponent(playbackId)}/queue`,
    { expected_revision: expectedRevision, ...queue },
  );
}

export function fetchPlaybacks(
  active?: boolean,
  cursor?: string | null,
  includeController = false,
): Promise<Page<PlaybackResponse>> {
  const params = new URLSearchParams();
  if (active != null) params.set("active", String(active));
  if (cursor) params.set("cursor", cursor);
  if (includeController) params.set("inc", "controller");
  return get<Page<PlaybackResponse>>(`/me/playbacks?${params}`);
}

export interface PlaybackProgress {
  queueRevision: number;
  trackId: string;
  playId: string;
  positionMs: number;
  state: PlaybackState;
  durationMs?: number | null;
  // From a handoff_queue command; this report completes the handoff.
  handoffToken?: string;
}

export function reportPlaybackProgress(
  playbackId: string,
  progress: PlaybackProgress,
): Promise<PlaybackResponse> {
  return post<PlaybackResponse>(
    `/me/playbacks/${encodeURIComponent(playbackId)}/progress`,
    {
      queue_revision: progress.queueRevision,
      track_id: progress.trackId,
      play_id: progress.playId,
      connection_session_key: CONNECTION_SESSION_KEY,
      position_ms: progress.positionMs,
      state: progress.state,
      duration_ms: progress.durationMs ?? undefined,
      handoff_token: progress.handoffToken,
    },
  );
}

// Entity refresh & lock

export interface CoverOptions {
  covers?: CoverUpdate;
  // Rejected by the server alongside `covers: "skip"`.
  bypassCoverCache?: boolean;
}

// Leaves out values matching the server's defaults.
function coverParams(options: CoverOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (options.covers && options.covers !== "missing")
    params.set("covers", options.covers);
  if (options.bypassCoverCache) params.set("bypass_cover_cache", "true");
  return params;
}

function withQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function refreshEntity(
  id: string,
  options: CoverOptions & { providerOptions?: ProviderOptionValues } = {},
): Promise<RefreshResponse> {
  const params = coverParams(options);
  // Namespaced so each provider receives only its own options.
  for (const [providerId, values] of Object.entries(
    options.providerOptions ?? {},
  )) {
    for (const [name, value] of Object.entries(values)) {
      params.set(`${providerId}.${name}`, String(value));
    }
  }
  return post<RefreshResponse>(
    withQuery(`/entities/${id}/refresh`, params),
    {},
  );
}

export function lockEntity(id: string): Promise<unknown> {
  return put<unknown>(`/entities/${id}/lock`);
}

export function unlockEntity(id: string): Promise<unknown> {
  return del<unknown>(`/entities/${id}/lock`);
}

// Providers

export function fetchProviders(): Promise<ProviderResponse[]> {
  return get<ProviderResponse[]>("/providers");
}

// Returns every provider in priority order after the update.
export function updateProvider(
  providerId: string,
  update: { position?: number; enabled?: boolean },
): Promise<ProviderResponse[]> {
  return patch<ProviderResponse[]>(
    `/providers/${encodeURIComponent(providerId)}`,
    update,
  );
}

export function searchProvider(
  providerId: string,
  query: string,
  type: SearchEntityType,
  bypassCoverCache?: boolean,
  includeCoverUrls?: boolean,
): Promise<SearchResult[]> {
  return post<SearchResult[]>(
    `/providers/${encodeURIComponent(providerId)}/search`,
    {
      type,
      q: query,
      bypass_cover_cache: bypassCoverCache ?? undefined,
      include_cover_urls: includeCoverUrls ?? undefined,
    },
  );
}

export function syncProvider(providerId: string): Promise<SyncResponse> {
  return post<SyncResponse>(
    `/providers/${encodeURIComponent(providerId)}/sync`,
    {},
  );
}

// External IDs

export function fetchExternalIds(
  entityId: string,
): Promise<ExternalIdResponse[]> {
  return get<ExternalIdResponse[]>(`/entities/${entityId}/external-ids`);
}

export function setExternalId(
  entityId: string,
  providerId: string,
  idType: string,
  idValue: string,
): Promise<ExternalIdResponse> {
  return put<ExternalIdResponse>(
    `/entities/${entityId}/external-ids/${encodeURIComponent(providerId)}/${encodeURIComponent(idType)}`,
    { id_value: idValue },
  );
}

// Removes a manual external ID so the provider's value takes effect again.
export function inheritExternalId(
  entityId: string,
  providerId: string,
  idType: string,
): Promise<void> {
  return del<void>(
    `/entities/${entityId}/external-ids/${encodeURIComponent(providerId)}/${encodeURIComponent(idType)}`,
  );
}

// Metadata editing

export function fetchEntityMetadata(
  entityId: string,
): Promise<MetadataSnapshot> {
  return get<MetadataSnapshot>(`/entities/${entityId}/metadata`);
}

export function previewEntityMetadata(
  entityId: string,
  changes: MetadataChange[],
): Promise<MetadataFieldDiff[]> {
  return post<MetadataFieldDiff[]>(`/entities/${entityId}/metadata/preview`, {
    changes,
  });
}

// Fails with 409 when the metadata no longer matches `expected`, the diff a
// preview returned.
export function applyEntityMetadata(
  entityId: string,
  changes: MetadataChange[],
  expected: MetadataFieldDiff[],
): Promise<MetadataSnapshot> {
  return patch<MetadataSnapshot>(`/entities/${entityId}/metadata`, {
    changes,
    expected,
  });
}

export function fetchArtistSummary(id: string): Promise<ArtistResponse> {
  return get<ArtistResponse>(`/artists/${id}`);
}

export function fetchLabels(): Promise<LabelResponse[]> {
  return get<LabelResponse[]>("/labels");
}

// Libraries

export function fetchLibraries(): Promise<LibraryResponse[]> {
  return get<LibraryResponse[]>("/libraries");
}

export function deleteLibrary(id: string): Promise<void> {
  return del<void>(`/libraries/${id}`);
}

export function createLibrary(
  name: string,
  directory: string,
  language?: string | null,
  country?: string | null,
): Promise<LibraryResponse> {
  return post<LibraryResponse>("/libraries", {
    name,
    directory,
    language: language ?? undefined,
    country: country ?? undefined,
  });
}

export function updateLibrary(
  id: string,
  data: {
    name?: string | null;
    language?: string | null;
    country?: string | null;
  },
): Promise<LibraryResponse> {
  return patch<LibraryResponse>(`/libraries/${id}`, data);
}

export function fetchLibraryAccess(
  id: string,
): Promise<LibraryAccessResponse[]> {
  return get<LibraryAccessResponse[]>(`/libraries/${id}/access`);
}

// The server accepts either a user ID or a username.
export function grantLibraryAccess(id: string, user: string): Promise<void> {
  return post<void>(`/libraries/${id}/access`, { user_id: user });
}

export function revokeLibraryAccess(id: string, userId: string): Promise<void> {
  return del<void>(`/libraries/${id}/access/${encodeURIComponent(userId)}`);
}

export function refreshLibrary(
  id: string,
  options: CoverOptions = {},
): Promise<LibrarySyncStartResponse> {
  return post<LibrarySyncStartResponse>(
    withQuery(`/libraries/${id}/refresh`, coverParams(options)),
    {},
  );
}

export function fetchLibrarySyncStatus(id: string): Promise<LibrarySyncStatus> {
  return get<LibrarySyncStatus>(`/libraries/${id}/sync`);
}

// While a sync or refresh of the library runs, starts nothing, ignores the
// options, and answers with the running one.
export function startLibrarySync(
  id: string,
  options: CoverOptions & { releases?: SyncReleases } = {},
): Promise<LibrarySyncStartResponse> {
  const params = coverParams(options);
  if (options.releases && options.releases !== "changed")
    params.set("releases", options.releases);
  return post<LibrarySyncStartResponse>(
    withQuery(`/libraries/${id}/sync`, params),
    {},
  );
}

export function fetchSyncRun(runId: string): Promise<LibrarySyncStatus> {
  return get<LibrarySyncStatus>(`/sync/runs/${encodeURIComponent(runId)}`);
}

export function cancelSyncRun(runId: string): Promise<LibrarySyncStatus> {
  return post<LibrarySyncStatus>(
    `/sync/runs/${encodeURIComponent(runId)}/cancel`,
    {},
  );
}

interface SseFrame {
  event?: string;
  id?: string;
  data: string;
}

export interface SyncRunStreamOptions {
  after?: number;
  signal?: AbortSignal;
  onSnapshot: (snapshot: LibrarySyncStatus) => void;
}

function parseSseFrame(frame: string): SseFrame | null {
  const data: string[] = [];
  let event: string | undefined;
  let id: string | undefined;

  for (const line of frame.split("\n")) {
    if (line.length === 0 || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    if (field === "id") id = value;
    if (field === "data") data.push(value);
  }

  if (data.length === 0) return null;
  return { event, id, data: data.join("\n") };
}

function normalizeSseBuffer(buffer: string): string {
  return buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export async function streamSyncRun(
  runId: string,
  options: SyncRunStreamOptions,
): Promise<void> {
  const params = new URLSearchParams();
  if (options.after != null && options.after > 0) {
    params.set("after", String(options.after));
  }
  const qs = params.toString();
  const path = `/sync/runs/${encodeURIComponent(runId)}/events${
    qs ? `?${qs}` : ""
  }`;
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders({ Accept: "text/event-stream" }),
    cache: "no-store",
    signal: options.signal,
  });
  await handleResponse(res, "GET", path);
  if (res.body == null) {
    throw new Error("Sync event stream is not readable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer = normalizeSseBuffer(
        buffer + decoder.decode(value, { stream: !done }),
      );

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = parseSseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (
          frame != null &&
          (frame.event == null || frame.event === "snapshot")
        ) {
          options.onSnapshot(JSON.parse(frame.data) as LibrarySyncStatus);
        }
        boundary = buffer.indexOf("\n\n");
      }

      if (done) break;
    }

    const frame = parseSseFrame(buffer.trim());
    if (frame != null && (frame.event == null || frame.event === "snapshot")) {
      options.onSnapshot(JSON.parse(frame.data) as LibrarySyncStatus);
    }
  } finally {
    reader.releaseLock();
  }
}

// Playlists

export function fetchPlaylists(opts?: {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  ownerId?: string;
  favorite?: boolean;
}): Promise<Page<PlaylistResponse>> {
  const params = new URLSearchParams();
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.ownerId) params.set("owner_id", opts.ownerId);
  if (opts?.favorite != null) params.set("favorite", String(opts.favorite));
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  return get<Page<PlaylistResponse>>(`/playlists?${params}`);
}

export function fetchPlaylist(id: string): Promise<PlaylistResponse> {
  return get<PlaylistResponse>(`/playlists/${id}?inc=tracks,artists,releases`);
}

export function createPlaylist(
  name: string,
  description?: string | null,
  isPublic?: boolean | null,
): Promise<PlaylistResponse> {
  return post<PlaylistResponse>("/playlists", {
    name,
    description: description ?? undefined,
    is_public: isPublic ?? undefined,
  });
}

export function updatePlaylist(
  id: string,
  data: {
    name?: string | null;
    description?: string | null;
    is_public?: boolean | null;
  },
): Promise<PlaylistResponse> {
  return patch<PlaylistResponse>(`/playlists/${id}`, data);
}

export function deletePlaylist(id: string): Promise<void> {
  return del<void>(`/playlists/${id}`);
}

export function addPlaylistTracks(
  id: string,
  trackIds: string[],
): Promise<PlaylistTrackResponse[]> {
  return post<PlaylistTrackResponse[]>(`/playlists/${id}/tracks`, {
    track_ids: trackIds,
  });
}

export function removePlaylistTracks(
  id: string,
  entryIds: string[],
): Promise<PlaylistTrackResponse[]> {
  return post<PlaylistTrackResponse[]>(`/playlists/${id}/tracks/remove`, {
    entry_ids: entryIds,
  });
}

export function removePlaylistTrack(
  id: string,
  entryId: string,
): Promise<PlaylistTrackResponse[]> {
  return del<PlaylistTrackResponse[]>(
    `/playlists/${id}/tracks/${encodeURIComponent(entryId)}`,
  );
}

export function movePlaylistTrack(
  id: string,
  entryId: string,
  position: number,
): Promise<PlaylistTrackResponse[]> {
  return patch<PlaylistTrackResponse[]>(
    `/playlists/${id}/tracks/${encodeURIComponent(entryId)}`,
    { position },
  );
}

// Tags

export function fetchTags(
  cursor?: string,
  limit?: number,
): Promise<TagListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  return get<TagListResponse>(`/me/tags${qs ? `?${qs}` : ""}`);
}

export function fetchTag(id: string): Promise<TagResponse> {
  return get<TagResponse>(`/me/tags/${id}`);
}

export function attachTag(
  tag: string,
  color: TagColor,
  targetId: string,
): Promise<void> {
  return post<void>("/me/tags", {
    tag,
    color,
    target_id: targetId,
  });
}

export function updateTag(
  id: string,
  data: { tag?: string; color?: TagColor },
): Promise<TagResponse> {
  return patch<TagResponse>(`/me/tags/${id}`, data);
}

export function deleteTag(id: string): Promise<void> {
  return del<void>(`/me/tags/${id}`);
}

export function fetchTagTargets(
  id: string,
  cursor?: string,
  limit?: number,
): Promise<TargetListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  return get<TargetListResponse>(`/me/tags/${id}/targets${qs ? `?${qs}` : ""}`);
}

export function checkTagTarget(
  tagId: string,
  targetId: string,
): Promise<TargetStateResponse> {
  return get<TargetStateResponse>(
    `/me/tags/${tagId}/targets/${encodeURIComponent(targetId)}`,
  );
}

export function detachTag(tagId: string, targetId: string): Promise<void> {
  return del<void>(`/me/tags/${tagId}/targets/${encodeURIComponent(targetId)}`);
}

// Favorites

export function checkFavorite(
  targetId: string,
): Promise<FavoriteStateResponse> {
  return get<FavoriteStateResponse>(
    `/me/favorites/${encodeURIComponent(targetId)}`,
  );
}

export function checkFavorites(targetIds: string[]): Promise<CheckResponse> {
  return post<CheckResponse>("/me/favorites/check", { target_ids: targetIds });
}

export function addFavorite(targetId: string): Promise<void> {
  return put<void>(`/me/favorites/${encodeURIComponent(targetId)}`);
}

export function removeFavorite(targetId: string): Promise<void> {
  return del<void>(`/me/favorites/${encodeURIComponent(targetId)}`);
}

// Ratings

export function checkRatings(
  targetIds: string[],
): Promise<CheckRatingsResponse> {
  return post<CheckRatingsResponse>("/me/ratings/check", {
    target_ids: targetIds,
  });
}

export function setRating(targetId: string, rating: number): Promise<void> {
  return put<void>(`/me/ratings/${encodeURIComponent(targetId)}`, { rating });
}

export function removeRating(targetId: string): Promise<void> {
  return del<void>(`/me/ratings/${encodeURIComponent(targetId)}`);
}

// Tracks

export function fetchTracks(opts?: {
  libraryId?: string;
  query?: string;
  signal?: AbortSignal;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  cursor?: string;
  filter?: ListFilter;
  limit?: number;
}): Promise<Page<TrackResponse>> {
  const params = new URLSearchParams({ inc: TRACK_LIST_INC });
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.query != null) params.set("query", opts.query);
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  setListFilter(params, opts?.filter);
  return get<Page<TrackResponse>>(`/tracks?${params}`, opts?.signal);
}

// The first page of each list for `query`. Each `next_cursor` continues on
// that type's list endpoint with the same query.
export function searchLibrary(opts: {
  query: string;
  limit: number;
  signal?: AbortSignal;
}): Promise<LibrarySearchResponse> {
  const params = new URLSearchParams({
    query: opts.query,
    limit: String(opts.limit),
    paginate: "true",
    track_inc: TRACK_LIST_INC,
    artist_inc: ARTIST_LIST_INC,
    release_inc: RELEASE_LIST_INC,
  });
  return get<LibrarySearchResponse>(`/search?${params}`, opts.signal);
}

export async function fetchLyrics(
  trackId: string,
): Promise<LyricsResponse | null> {
  const res = await fetch(`${BASE}/tracks/${trackId}/lyrics?format=json`, {
    headers: authHeaders(),
  });
  if (res.status === 404 || res.status === 406) return null;
  await handleResponse(res, "GET", `/tracks/${trackId}/lyrics`);
  return parseBody<LyricsResponse>(res);
}

// Entries

export function fetchEntries(): Promise<EntryResponse[]> {
  return get<EntryResponse[]>("/entries");
}

export function fetchEntry(id: string): Promise<EntryResponse> {
  return get<EntryResponse>(`/entries/${id}`);
}

// Release cover search

export function searchReleaseCovers(
  releaseId: string,
  provider?: string,
  bypassCoverCache?: boolean,
): Promise<ReleaseCoverSearchResponse> {
  return post<ReleaseCoverSearchResponse>(
    `/releases/${releaseId}/covers/search`,
    {
      provider: provider ?? undefined,
      bypass_cover_cache: bypassCoverCache ?? undefined,
    },
  );
}

export function searchArtistCovers(
  artistId: string,
  provider?: string,
  bypassCoverCache?: boolean,
): Promise<ArtistCoverSearchResponse> {
  return post<ArtistCoverSearchResponse>(`/artists/${artistId}/covers/search`, {
    provider: provider ?? undefined,
    bypass_cover_cache: bypassCoverCache ?? undefined,
  });
}

// Users

export function fetchRoles(): Promise<RoleResponse[]> {
  return get<RoleResponse[]>("/roles");
}

export function updateUserRole(userId: string, role: string): Promise<void> {
  return put<void>(`/users/${encodeURIComponent(userId)}/role`, { role });
}

export function setUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  return put<void>(`/users/${encodeURIComponent(userId)}/password`, {
    password,
  });
}

export function fetchUsers(): Promise<PublicUser[]> {
  return get<PublicUser[]>("/users");
}

export function deleteUser(userId: string): Promise<void> {
  return del<void>(`/users/${encodeURIComponent(userId)}`);
}

export function createUser(
  username: string,
  password: string,
): Promise<PublicUser> {
  return post<PublicUser>("/users", { username, password });
}

// Plugins

export function fetchPlugins(): Promise<PluginManifestResponse[]> {
  return get<PluginManifestResponse[]>("/plugins");
}

export function fetchAllPluginSettings(): Promise<PluginSettingsEntry[]> {
  return get<PluginSettingsEntry[]>("/plugins/settings");
}

export function updatePluginSettings(
  pluginId: string,
  values: Record<string, PluginSettingValue>,
): Promise<PluginSettingsResponse> {
  return patch<PluginSettingsResponse>(
    `/plugins/${encodeURIComponent(pluginId)}/settings`,
    { values },
  );
}

export function deletePluginSettings(pluginId: string): Promise<void> {
  return del<void>(`/plugins/${encodeURIComponent(pluginId)}/settings`);
}

export function restartPlugin(pluginId: string): Promise<void> {
  return post<void>(`/plugins/${encodeURIComponent(pluginId)}/restart`, {});
}

// Each plugin names the release its status offered, which approves the scopes
// that release adds. Omitting `plugins` sends `{}`, which updates every
// repository-managed plugin whose update is not held.
export function updatePlugins(
  plugins?: PreviewedPlugin[],
): Promise<UpdatePluginsResponse> {
  return post<UpdatePluginsResponse>("/plugins/update", { plugins });
}

export function uninstallPlugin(pluginId: string): Promise<void> {
  return del<void>(`/plugins/${encodeURIComponent(pluginId)}`);
}

export function fetchAllUserPluginSettings(): Promise<PluginSettingsEntry[]> {
  return get<PluginSettingsEntry[]>("/me/plugins/settings");
}

export function updateUserPluginSettings(
  pluginId: string,
  values: Record<string, PluginSettingValue>,
): Promise<PluginSettingsResponse> {
  return patch<PluginSettingsResponse>(
    `/me/plugins/${encodeURIComponent(pluginId)}/settings`,
    { values },
  );
}

export function deleteUserPluginSettings(pluginId: string): Promise<void> {
  return del<void>(`/me/plugins/${encodeURIComponent(pluginId)}/settings`);
}

// Plugin repositories

export function fetchPluginRepositories(opts?: {
  inc?: "plugins"[];
}): Promise<PluginRepository[]> {
  const params = new URLSearchParams();
  if (opts?.inc?.length) params.set("inc", opts.inc.join(","));
  const query = params.toString();
  return get<PluginRepository[]>(
    `/plugins/repositories${query ? `?${query}` : ""}`,
  );
}

export function resolvePluginRepository(opts: {
  url: string;
  ref?: string | null;
}): Promise<RepositoryPreview> {
  return post<RepositoryPreview>("/plugins/resolve", {
    url: opts.url,
    ref: opts.ref ?? undefined,
  });
}

export function addPluginRepository(opts: {
  url: string;
  ref?: string | null;
}): Promise<CatalogRepository> {
  return post<CatalogRepository>("/plugins/repositories", {
    url: opts.url,
    ref: opts.ref ?? undefined,
  });
}

export function removePluginRepository(repositoryId: string): Promise<void> {
  return del<void>(`/plugins/repositories/${encodeURIComponent(repositoryId)}`);
}

export function refreshPluginRepository(
  repositoryId: string,
): Promise<CatalogRepository> {
  return post<CatalogRepository>(
    `/plugins/repositories/${encodeURIComponent(repositoryId)}/refresh`,
    {},
  );
}

export function refreshPluginRepositories(): Promise<RefreshPluginRepositoriesResponse> {
  return post<RefreshPluginRepositoriesResponse>(
    "/plugins/repositories/refresh",
    {},
  );
}

// `plugins` is required on purpose: omitting it installs every plugin the
// repository provides.
export function installRepositoryPlugins(
  repositoryId: string,
  plugins: PreviewedPlugin[],
): Promise<InstallPluginsResponse> {
  return post<InstallPluginsResponse>(
    `/plugins/repositories/${encodeURIComponent(repositoryId)}/install`,
    { plugins },
  );
}

export function fetchServerSettings(): Promise<ServerSettingsResponse> {
  return get<ServerSettingsResponse>("/server/settings");
}

export function updateServerSettings(
  values: Record<string, ServerSettingValue>,
): Promise<ServerSettingsResponse> {
  return patch<ServerSettingsResponse>("/server/settings", { values });
}

export function resetServerSettings(): Promise<ServerSettingsResponse> {
  return del<ServerSettingsResponse>("/server/settings");
}

// A wrong current password answers 401, which would normally sign the user
// out. Sign out only if the session itself is no longer valid.
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const path = "/me";
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (res.status === 401) {
    await fetchMe();
    throw new ApiError(401, "PATCH", path, "Incorrect current password");
  }
  await handleResponse(res, "PATCH", path);
}

export function fetchApiKeys(): Promise<ApiKeyResponse[]> {
  return get<ApiKeyResponse[]>("/me/api-keys");
}

export function createApiKey(name: string): Promise<CreatedApiKeyResponse> {
  return post<CreatedApiKeyResponse>("/me/api-keys", { name });
}

export function revokeApiKey(id: string): Promise<void> {
  return del<void>(`/me/api-keys/${encodeURIComponent(id)}`);
}
