// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ReleaseResponse,
  ReleaseCoverSearchResponse,
  ArtistCoverSearchResponse,
  ArtistResponse,
  GenreResponse,
  TrackResponse,
  PlaybackResponse,
  PlaybackState,
  ActivePlayback,
  RefreshResponse,
  ProviderResponse,
  SearchResult,
  SearchResponse,
  SearchEntityType,
  ExternalIdResponse,
  EntryResponse,
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
  FavoriteListResponse,
  FavoriteStateResponse,
  CheckResponse,
  EntityParam,
  TargetListResponse,
  TargetStateResponse,
  PluginManifestResponse,
  PluginSettingsResponse,
  PluginSettingsListResponse,
  PluginSettingValue,
  PluginRepositoriesResponse,
  RepositoryWithPreviewResponse,
  InstallPluginsResponse,
  Page,
  PlaybackUrlResponse,
  LyricsResponse,
} from "./types";
import { getAuth } from "./auth.svelte";

const BASE = "/api";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const CONNECTION_SESSION_KEY = makeId();

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

function handleResponse(
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
    throw new ApiError(
      res.status,
      method,
      path,
      `${method} ${path} failed: ${res.status} ${res.statusText}`,
    );
  }
}

async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

async function get<T>(path: string): Promise<T> {
  const token = getAuth().token;
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  handleResponse(res, "GET", path, token);
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
  handleResponse(res, "POST", path);
  return parseBody<T>(res);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  handleResponse(res, "PATCH", path);
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
  handleResponse(res, "PUT", path);
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
  handleResponse(res, "DELETE", path);
  return parseBody<T>(res);
}

// Auth & Server

export function loginUser(
  username: string,
  password: string,
): Promise<Session> {
  return post<LoginResponse>("/users/login", { username, password });
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

export function fetchReleases(opts?: {
  libraryId?: string;
  genreId?: string;
  cursor?: string;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  limit?: number;
}): Promise<Page<ReleaseResponse>> {
  const params = new URLSearchParams({ inc: "artists,covers" });
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.genreId) params.set("genre_id", opts.genreId);
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  return get<Page<ReleaseResponse>>(`/releases?${params}`);
}

export function fetchRelease(id: string): Promise<ReleaseResponse> {
  return get<ReleaseResponse>(
    `/releases/${id}?inc=artists,tracks,covers,track_artists`,
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

function mixQueryString(opts?: { limit?: number; instant?: boolean }): string {
  const params = new URLSearchParams({ inc: MIX_INC });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.instant != null) params.set("instant", String(opts.instant));
  return params.toString();
}

export function fetchMeMix(opts?: {
  limit?: number;
}): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/me/mix?${qs}`);
}

export function fetchTrackMix(
  trackId: string,
  opts?: { limit?: number; instant?: boolean },
): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/tracks/${trackId}/mix?${qs}`);
}

export function fetchReleaseMix(
  releaseId: string,
  opts?: { limit?: number },
): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/releases/${releaseId}/mix?${qs}`);
}

export function fetchArtistMix(
  artistId: string,
  opts?: { limit?: number },
): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/artists/${artistId}/mix?${qs}`);
}

export function fetchGenreMix(
  genreId: string,
  opts?: { limit?: number },
): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/genres/${genreId}/mix?${qs}`);
}

export function fetchPlaylistMix(
  playlistId: string,
  opts?: { limit?: number },
): Promise<TrackResponse[]> {
  const qs = mixQueryString(opts);
  return get<TrackResponse[]>(`/playlists/${playlistId}/mix?${qs}`);
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
        user_id: playback.user_id,
        connection_token: playback.controller?.connection_token,
        connection_session_key: playback.controller?.connection_session_key,
        supported_commands: playback.controller?.supported_commands ?? [],
        remote_control_degraded:
          playback.controller?.remote_control_degraded ?? false,
      });
    }
    cursor = page.next_cursor;
  } while (cursor);
  return sessions;
}

// Artists

export function fetchArtists(opts?: {
  libraryId?: string;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  cursor?: string;
  limit?: number;
}): Promise<Page<ArtistResponse>> {
  const params = new URLSearchParams({ inc: "covers" });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  return get<Page<ArtistResponse>>(`/artists?${params}`);
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

export function startPlayback(
  trackId: string,
  durationMs?: number | null,
  positionMs?: number | null,
  state?: PlaybackState | null,
): Promise<PlaybackResponse> {
  return post<PlaybackResponse>("/playbacks", {
    track_ids: [trackId],
    current_index: 0,
    repeat_mode: "none",
    shuffle_enabled: false,
    connection_session_key: CONNECTION_SESSION_KEY,
    duration_ms: durationMs ?? undefined,
    position_ms: positionMs ?? undefined,
    state: state ?? undefined,
  });
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
  return get<Page<PlaybackResponse>>(`/playbacks?${params}`);
}

export function reportPlaybackProgress(
  playbackId: string,
  queueRevision: number,
  positionMs: number,
  state: PlaybackState | string,
  durationMs?: number | null,
): Promise<PlaybackResponse> {
  return post<PlaybackResponse>(
    `/playbacks/${encodeURIComponent(playbackId)}/progress`,
    {
      queue_revision: queueRevision,
      connection_session_key: CONNECTION_SESSION_KEY,
      position_ms: positionMs,
      state,
      duration_ms: durationMs ?? undefined,
    },
  );
}

// Entity refresh & lock

export function refreshEntity(
  id: string,
  forceRefresh?: boolean,
  replaceCover?: boolean,
): Promise<RefreshResponse> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("force_refresh", "true");
  if (replaceCover) params.set("replace_cover", "true");
  const qs = params.toString();
  return post<RefreshResponse>(
    `/entities/${id}/refresh${qs ? `?${qs}` : ""}`,
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

export function updateProviderPriority(
  id: string,
  priority: number,
): Promise<ProviderResponse> {
  return put<ProviderResponse>(
    `/providers/${encodeURIComponent(id)}/priority`,
    {
      priority,
    },
  );
}

export function searchProvider(
  providerId: string,
  query: string,
  type: SearchEntityType,
  forceRefresh?: boolean,
  includeCoverUrls?: boolean,
): Promise<SearchResult[]> {
  return post<SearchResult[]>(
    `/providers/${encodeURIComponent(providerId)}/search`,
    {
      type,
      q: query,
      force_refresh: forceRefresh ?? undefined,
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

// Cross-entity search

export function searchAll(
  query: string,
  limit?: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  if (limit != null) params.set("limit", String(limit));
  return get<SearchResponse>(`/search?${params}`);
}

// Libraries

export function fetchLibraries(): Promise<LibraryResponse[]> {
  return get<LibraryResponse[]>("/libraries");
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

export function refreshLibrary(
  id: string,
  forceRefresh?: boolean,
  replaceCover?: boolean,
): Promise<LibrarySyncStartResponse> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("force_refresh", "true");
  if (replaceCover) params.set("replace_cover", "true");
  const qs = params.toString();
  return post<LibrarySyncStartResponse>(
    `/libraries/${id}/refresh${qs ? `?${qs}` : ""}`,
    {},
  );
}

export function fetchLibrarySyncStatus(id: string): Promise<LibrarySyncStatus> {
  return get<LibrarySyncStatus>(`/libraries/${id}/sync`);
}

export function startLibrarySync(
  id: string,
): Promise<LibrarySyncStartResponse> {
  return post<LibrarySyncStartResponse>(`/libraries/${id}/sync`, {});
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
  handleResponse(res, "GET", path);
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

export function fetchPlaylists(
  cursor?: string,
  limit?: number,
  sort?: { sortBy: string; sortOrder: "ascending" | "descending" },
): Promise<Page<PlaylistResponse>> {
  const params = new URLSearchParams();
  if (sort) {
    params.set("sort_by", sort.sortBy);
    params.set("sort_order", sort.sortOrder);
  }
  if (limit != null) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
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
  newPosition: number,
): Promise<PlaylistTrackResponse[]> {
  return patch<PlaylistTrackResponse[]>(
    `/playlists/${id}/tracks/${encodeURIComponent(entryId)}`,
    { new_position: newPosition },
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
  return get<TagListResponse>(`/tags${qs ? `?${qs}` : ""}`);
}

export function fetchTag(id: string): Promise<TagResponse> {
  return get<TagResponse>(`/tags/${id}`);
}

export function attachTag(
  tag: string,
  color: TagColor,
  targetId: string,
): Promise<void> {
  return post<void>("/tags", {
    tag,
    color,
    target_id: targetId,
  });
}

export function updateTag(
  id: string,
  data: { tag?: string; color?: TagColor },
): Promise<TagResponse> {
  return patch<TagResponse>(`/tags/${id}`, data);
}

export function deleteTag(id: string): Promise<void> {
  return del<void>(`/tags/${id}`);
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
  return get<TargetListResponse>(`/tags/${id}/targets${qs ? `?${qs}` : ""}`);
}

export function checkTagTarget(
  tagId: string,
  targetId: string,
): Promise<TargetStateResponse> {
  return get<TargetStateResponse>(
    `/tags/${tagId}/targets/${encodeURIComponent(targetId)}`,
  );
}

export function detachTag(tagId: string, targetId: string): Promise<void> {
  return del<void>(`/tags/${tagId}/targets/${encodeURIComponent(targetId)}`);
}

// Favorites

export function fetchFavorites(
  entity: EntityParam,
  cursor?: string,
  limit?: number,
): Promise<FavoriteListResponse> {
  const params = new URLSearchParams({ entity });
  if (cursor) params.set("cursor", cursor);
  if (limit != null) params.set("limit", String(limit));
  return get<FavoriteListResponse>(`/favorites?${params}`);
}

export function checkFavorite(
  targetId: string,
): Promise<FavoriteStateResponse> {
  return get<FavoriteStateResponse>(
    `/favorites/${encodeURIComponent(targetId)}`,
  );
}

export function checkFavorites(targetIds: string[]): Promise<CheckResponse> {
  return post<CheckResponse>("/favorites/check", { target_ids: targetIds });
}

export function addFavorite(targetId: string): Promise<void> {
  return put<void>(`/favorites/${encodeURIComponent(targetId)}`);
}

export function removeFavorite(targetId: string): Promise<void> {
  return del<void>(`/favorites/${encodeURIComponent(targetId)}`);
}

// Tracks

export function fetchTracks(opts?: {
  libraryId?: string;
  sortBy?: string;
  sortOrder?: "ascending" | "descending";
  cursor?: string;
  limit?: number;
}): Promise<Page<TrackResponse>> {
  const params = new URLSearchParams({
    inc: "releases,artists,release_covers",
  });
  if (opts?.sortBy) params.set("sort_by", opts.sortBy);
  if (opts?.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts?.libraryId) params.set("library_id", opts.libraryId);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  return get<Page<TrackResponse>>(`/tracks?${params}`);
}

export async function fetchLyrics(
  trackId: string,
): Promise<LyricsResponse | null> {
  const res = await fetch(`${BASE}/tracks/${trackId}/lyrics?format=json`, {
    headers: authHeaders(),
  });
  if (res.status === 404 || res.status === 406) return null;
  handleResponse(res, "GET", `/tracks/${trackId}/lyrics`);
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
  forceRefresh?: boolean,
): Promise<ReleaseCoverSearchResponse> {
  return post<ReleaseCoverSearchResponse>(
    `/releases/${releaseId}/covers/search`,
    {
      provider: provider ?? undefined,
      force_refresh: forceRefresh ?? undefined,
    },
  );
}

export function searchArtistCovers(
  artistId: string,
  provider?: string,
  forceRefresh?: boolean,
): Promise<ArtistCoverSearchResponse> {
  return post<ArtistCoverSearchResponse>(`/artists/${artistId}/covers/search`, {
    provider: provider ?? undefined,
    force_refresh: forceRefresh ?? undefined,
  });
}

// Users

export function fetchRoles(): Promise<RoleResponse[]> {
  return get<RoleResponse[]>("/roles");
}

export function updateUserRole(userId: string, role: string): Promise<void> {
  return put<void>(`/users/${encodeURIComponent(userId)}/role`, { role });
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

export function fetchAllPluginSettings(): Promise<PluginSettingsListResponse> {
  return get<PluginSettingsListResponse>("/plugins/settings");
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

export function fetchAllUserPluginSettings(): Promise<PluginSettingsListResponse> {
  return get<PluginSettingsListResponse>("/me/plugins/settings");
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

export function fetchPluginRepositories(): Promise<PluginRepositoriesResponse> {
  return get<PluginRepositoriesResponse>("/plugins/repositories");
}

export function refreshPluginRepository(
  repositoryId: string,
): Promise<RepositoryWithPreviewResponse> {
  return post<RepositoryWithPreviewResponse>(
    `/plugins/repositories/${encodeURIComponent(repositoryId)}/refresh`,
    {},
  );
}

// `plugins` is required on purpose: omitting it installs every plugin the
// repository provides.
export function installPlugins(opts: {
  url: string;
  ref?: string | null;
  plugins: string[];
}): Promise<InstallPluginsResponse> {
  return post<InstallPluginsResponse>("/plugins/install", {
    url: opts.url,
    ref: opts.ref ?? undefined,
    plugins: opts.plugins,
  });
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
