// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ForwardedCommand,
  PlaybackState,
  QueueResponse,
  QueueSnapshot,
  TrackResponse,
} from "./types";
import {
  ApiError,
  coverUrl,
  createPlayback,
  createPlaybackUrl,
  fetchPlayback,
  fetchPlaybackQueue,
  fetchTrackDetail,
  replacePlaybackQueue,
  reportPlaybackProgress,
} from "./api";
import { onForwardedCommand, sendHandoff } from "./ws.svelte.ts";

export interface PlaybackContext {
  tracks: TrackResponse[];
  title: string;
  coverUrl: string | null;
  coverBlurhash: string | null;
  trackArtistNames: Record<string, string>;
  // The cover follows the current track, as for a queue taken over from
  // another device.
  coverFromTrack?: boolean;
}

export interface QueuedItem {
  track: TrackResponse;
  context: PlaybackContext;
}

export type UpNextSource = "queue" | "context";

export interface UpNextItem {
  track: TrackResponse;
  context: PlaybackContext;
  source: UpNextSource;
}

let currentTrack = $state<TrackResponse | null>(null);
let playbackContext = $state<PlaybackContext | null>(null);
let playing = $state(false);
let currentTime = $state(0);
let duration = $state(0);
let loading = $state(false);
let volume = $state(1);
let shuffle = $state(false);
let shuffledIds = $state<string[]>([]);
let queue = $state<QueuedItem[]>([]);
let skippedUpNextIds = $state<Set<string>>(new Set());
// The server playback this browser drives. It is kept across tracks and
// queue changes, which replace its queue.
let playbackId: string | null = null;
let playbackQueueRevision = 0;
// The current play of the current track; null once it has ended.
let playId: string | null = null;
let reportIntervalId: ReturnType<typeof setInterval> | null = null;
let queueSyncTimer: ReturnType<typeof setTimeout> | null = null;
let handingOff = false;
// Set when the queue changed here since the server last got it.
let queueDirty = false;
// Server writes run one at a time so each sees the revision the last left.
let serverWrites: Promise<unknown> = Promise.resolve();

function shuffleTracksFrom(
  tracks: TrackResponse[],
  headId: string | null,
): string[] {
  const ids = tracks.map((t) => t.id).filter((id): id is string => !!id);
  const rest = ids.filter((id) => id !== headId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return headId && ids.includes(headId) ? [headId, ...rest] : rest;
}

function isSkipped(track: TrackResponse): boolean {
  return !!track.id && skippedUpNextIds.has(track.id);
}

function contextUpcomingTracks(): TrackResponse[] {
  if (!currentTrack?.id || !playbackContext) return [];

  if (shuffle && shuffledIds.length > 0) {
    const idx = shuffledIds.indexOf(currentTrack.id);
    if (idx < 0) return [];
    const upcoming: TrackResponse[] = [];
    for (let i = idx + 1; i < shuffledIds.length; i++) {
      const id = shuffledIds[i];
      if (skippedUpNextIds.has(id)) continue;
      const track = playbackContext.tracks.find((t) => t.id === id);
      if (track) upcoming.push(track);
    }
    return upcoming;
  }

  const currentId = currentTrack.id;
  const idx = playbackContext.tracks.findIndex((t) => t.id === currentId);
  if (idx < 0) return [];
  return playbackContext.tracks.slice(idx + 1).filter((t) => !isSkipped(t));
}

function getUpNext(): UpNextItem[] {
  const items: UpNextItem[] = [];
  for (const item of queue) {
    items.push({
      track: item.track,
      context: item.context,
      source: "queue",
    });
  }
  const context = playbackContext;
  if (context) {
    for (const track of contextUpcomingTracks()) {
      items.push({ track, context, source: "context" });
    }
  }
  return items;
}

function nextContextTrack(): TrackResponse | null {
  return contextUpcomingTracks()[0] ?? null;
}

const PLAYING_REPORT_MS = 10_000;
const PAUSED_REPORT_MS = 30_000;

const audio = new Audio();

const PLAY_ID_ALPHABET =
  "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Each play of a track, including a repeat, needs its own id so the server
// counts it as at most one listen. Generated like the server's nanoid ids.
function makePlayId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  return Array.from(bytes, (b) => PLAY_ID_ALPHABET[b & 63]).join("");
}

// The server's queue: tracks already played from the context, the current
// track, then everything up next. Capped to the server's limit.
const QUEUE_CAP = 1_000;
const QUEUE_HISTORY_CAP = 100;

function queueSnapshot(): QueueSnapshot | null {
  if (!currentTrack?.id || !playbackContext) return null;
  const order =
    shuffle && shuffledIds.length > 0
      ? shuffledIds
      : playbackContext.tracks.map((t) => t.id).filter((id) => !!id);
  const idx = order.indexOf(currentTrack.id);
  const history = idx > 0 ? order.slice(0, idx).slice(-QUEUE_HISTORY_CAP) : [];
  const upNext = getUpNext().map((item) => item.track.id);
  return {
    track_ids: [...history, currentTrack.id, ...upNext].slice(0, QUEUE_CAP),
    current_index: history.length,
    repeat_mode: "none",
    shuffle_enabled: shuffle,
  };
}

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = serverWrites.then(task, task);
  serverWrites = run.catch(() => {});
  return run;
}

// Replaces the playback's queue, retrying once against the latest revision.
async function writeQueue(id: string, snapshot: QueueSnapshot) {
  let response: QueueResponse;
  try {
    response = await replacePlaybackQueue(id, playbackQueueRevision, snapshot);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e;
    const latest = await fetchPlayback(id);
    if (latest.queue_revision == null) throw e;
    response = await replacePlaybackQueue(id, latest.queue_revision, snapshot);
  }
  if (playbackId === id) playbackQueueRevision = response.revision;
}

function syncQueueSoon() {
  queueDirty = true;
  if (queueSyncTimer != null) clearTimeout(queueSyncTimer);
  queueSyncTimer = setTimeout(() => {
    queueSyncTimer = null;
    syncQueue();
  }, 300);
}

function syncQueue(): Promise<void> {
  if (queueSyncTimer != null) {
    clearTimeout(queueSyncTimer);
    queueSyncTimer = null;
  }
  return serialize(async () => {
    const id = playbackId;
    const snapshot = queueSnapshot();
    if (!queueDirty || id == null || snapshot == null || playId == null) {
      return;
    }
    queueDirty = false;
    await writeQueue(id, snapshot).catch((e) =>
      console.error("Updating the queue failed:", e),
    );
  });
}

// Points the server at the current track: reuses this browser's playback,
// adopts one handed to it, or creates one when there is none to reuse.
async function bindCurrentTrack(
  track: TrackResponse,
  trackPlayId: string,
  adopt?: { playbackId: string; revision: number },
) {
  if (adopt) {
    playbackId = adopt.playbackId;
    playbackQueueRevision = adopt.revision;
    return;
  }
  const snapshot = queueSnapshot();
  if (snapshot == null) return;
  queueDirty = false;
  if (playbackId != null) {
    try {
      await writeQueue(playbackId, snapshot);
      return;
    } catch {
      // Gone or no longer ours; start a new one.
      playbackId = null;
    }
  }
  const pb = await createPlayback(snapshot, trackPlayId, track.duration_ms);
  if (pb.queue_revision == null) {
    throw new Error("Started playback has no server-managed queue");
  }
  playbackId = pb.id;
  playbackQueueRevision = pb.queue_revision;
}

// Reports the current play. Values are taken now; the revision when sent.
function reportProgress(
  state: PlaybackState,
  handoffToken?: string,
): Promise<void> {
  const id = playbackId;
  const trackId = currentTrack?.id;
  const play = playId;
  if (id == null || !trackId || play == null) return Promise.resolve();
  const positionMs = Math.round(audio.currentTime * 1000);
  const durationMs = Number.isFinite(audio.duration)
    ? Math.round(audio.duration * 1000)
    : undefined;
  const report = serialize(() =>
    reportPlaybackProgress(id, {
      queueRevision: playbackQueueRevision,
      trackId,
      playId: play,
      positionMs,
      state,
      durationMs,
      handoffToken,
    }),
  );
  // A handoff fails when its report does; other reports are best effort.
  return handoffToken
    ? report.then(() => {})
    : report.then(
        () => {},
        () => {},
      );
}

function startReportInterval() {
  stopReportInterval();
  const ms = audio.paused ? PAUSED_REPORT_MS : PLAYING_REPORT_MS;
  const state = audio.paused ? "paused" : "playing";
  reportIntervalId = setInterval(() => reportProgress(state), ms);
}

function stopReportInterval() {
  if (reportIntervalId != null) {
    clearInterval(reportIntervalId);
    reportIntervalId = null;
  }
}

audio.addEventListener("timeupdate", () => {
  currentTime = audio.currentTime;
});

audio.addEventListener("loadedmetadata", () => {
  // audio.duration can be Infinity / NaN for streams without a known length;
  // keep the optimistic duration we set from track.duration_ms in that case.
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    duration = audio.duration;
  }
});

// While a track is starting, playTrackInternal reports for it instead.
audio.addEventListener("play", () => {
  const wasPlaying = playing;
  playing = true;
  if (!loading && !wasPlaying && playbackId != null && !handingOff) {
    reportProgress("playing");
    startReportInterval();
  }
});

audio.addEventListener("pause", () => {
  playing = false;
  if (loading || handingOff) return;
  reportProgress("paused");
  if (playbackId != null) {
    startReportInterval();
  }
});

audio.addEventListener("ended", () => {
  stopReportInterval();
  reportProgress("completed");
  // The play is over, so moving on doesn't report it stopped.
  playId = null;
  nextTrack();
});

// A seek before the stream's metadata loads may be dropped.
function seekOnceLoaded(seconds: number): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    audio.currentTime = seconds;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const done = () => {
      audio.removeEventListener("loadedmetadata", done);
      audio.removeEventListener("error", failed);
      audio.currentTime = seconds;
      resolve();
    };
    const failed = () => {
      audio.removeEventListener("loadedmetadata", done);
      audio.removeEventListener("error", failed);
      reject(new Error("The stream failed to load"));
    };
    audio.addEventListener("loadedmetadata", done);
    audio.addEventListener("error", failed);
  });
}

interface StartOptions {
  positionMs?: number;
  autoplay?: boolean;
  playId?: string;
  // A playback another device handed this browser.
  adopt?: { playbackId: string; revision: number };
  handoffToken?: string;
}

async function playTrackInternal(
  track: TrackResponse,
  context: PlaybackContext,
  options: StartOptions = {},
) {
  if (!track.id) return;

  stopReportInterval();
  if (playId != null) reportProgress("stopped");

  const previousContext = playbackContext;
  currentTrack = track;
  playbackContext = context;
  if (previousContext !== context) {
    skippedUpNextIds = new Set();
  }
  loading = true;
  if (track.duration_ms) {
    duration = track.duration_ms / 1000;
  }
  const trackPlayId = options.playId ?? makePlayId();
  playId = trackPlayId;

  try {
    const [playbackUrl] = await Promise.all([
      createPlaybackUrl(track.id),
      serialize(() => bindCurrentTrack(track, trackPlayId, options.adopt)),
    ]);
    if (playId !== trackPlayId) return;
    // Some source containers cannot stream directly. Ask for a browser-playable
    // transcode when the server only offers HLS for the original request.
    const streamUrl =
      playbackUrl.stream_url ??
      (await createPlaybackUrl(track.id, "mp3")).stream_url;
    if (playId !== trackPlayId) return;
    if (!streamUrl) throw new Error("No playable audio stream available");
    audio.src = streamUrl;
    if (options.positionMs) await seekOnceLoaded(options.positionMs / 1000);
    if (playId !== trackPlayId) return;
    let started = false;
    if (options.autoplay !== false) {
      try {
        await audio.play();
        started = true;
      } catch (e) {
        // A tab the user hasn't interacted with may not autoplay; it takes
        // the playback over paused instead.
        if (!(e instanceof DOMException && e.name === "NotAllowedError")) {
          throw e;
        }
      }
    }
    if (playId !== trackPlayId) return;
    playing = started;
    await reportProgress(started ? "playing" : "paused", options.handoffToken);
    startReportInterval();
  } catch (e) {
    console.error("Playback failed:", e);
  } finally {
    if (playId === trackPlayId) loading = false;
  }
}

async function playTrack(track: TrackResponse, context: PlaybackContext) {
  skippedUpNextIds = new Set();
  if (shuffle && track.id) {
    shuffledIds = shuffleTracksFrom(context.tracks, track.id);
  }
  await playTrackInternal(track, context);
}

function toggleShuffle() {
  shuffle = !shuffle;
  if (shuffle && playbackContext) {
    shuffledIds = shuffleTracksFrom(
      playbackContext.tracks,
      currentTrack?.id ?? null,
    );
  } else {
    shuffledIds = [];
  }
  syncQueueSoon();
}

function togglePlayback() {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function resume() {
  if (currentTrack) audio.play();
}

function pause() {
  if (currentTrack) audio.pause();
}

function nextTrack() {
  if (queue.length > 0) {
    const next = queue[0];
    queue = queue.slice(1);
    if (shuffle && next.track.id) {
      shuffledIds = shuffleTracksFrom(next.context.tracks, next.track.id);
    }
    playTrackInternal(next.track, next.context);
    return;
  }
  const next = nextContextTrack();
  if (next && playbackContext) {
    playTrackInternal(next, playbackContext);
    return;
  }
  stop();
}

function addToQueue(track: TrackResponse, context: PlaybackContext) {
  if (!track.id) return;
  if (currentTrack == null) {
    playTrack(track, context);
    return;
  }
  queue = [...queue, { track, context }];
  syncQueueSoon();
}

function removeFromQueue(index: number) {
  queue = queue.filter((_, i) => i !== index);
  syncQueueSoon();
}

function removeFromUpNext(index: number) {
  if (index < queue.length) {
    removeFromQueue(index);
    return;
  }
  const item = getUpNext()[index];
  if (item?.source === "context" && item.track.id) {
    skippedUpNextIds = new Set([...skippedUpNextIds, item.track.id]);
    syncQueueSoon();
  }
}

function clearQueue() {
  queue = [];
  syncQueueSoon();
}

function clearUpNext() {
  queue = [];
  if (!playbackContext) return;
  const skipped = new Set(skippedUpNextIds);
  for (const track of playbackContext.tracks) {
    if (track.id && track.id !== currentTrack?.id) {
      skipped.add(track.id);
    }
  }
  skippedUpNextIds = skipped;
  syncQueueSoon();
}

function prevTrack() {
  if (!currentTrack || !playbackContext) return;
  if (shuffle && shuffledIds.length > 0) {
    const idx = shuffledIds.indexOf(currentTrack.id);
    if (idx <= 0) return;
    const prev = playbackContext.tracks.find(
      (t) => t.id === shuffledIds[idx - 1],
    );
    if (prev) playTrackInternal(prev, playbackContext);
    return;
  }
  const idx = playbackContext.tracks.findIndex(
    (t) => t.id === currentTrack!.id,
  );
  if (idx <= 0) return;
  playTrackInternal(playbackContext.tracks[idx - 1], playbackContext);
}

// Resolves once the server has the final "stopped" report. The playback
// stays with this browser to hold whatever plays next.
function stop(): Promise<void> {
  stopReportInterval();
  const report = playId != null ? reportProgress("stopped") : Promise.resolve();
  clearLocal();
  return report;
}

// Clears what this browser plays without reporting it.
function clearLocal() {
  stopReportInterval();
  if (queueSyncTimer != null) {
    clearTimeout(queueSyncTimer);
    queueSyncTimer = null;
  }
  playId = null;
  loading = false;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  currentTrack = null;
  playbackContext = null;
  playing = false;
  currentTime = 0;
  duration = 0;
  shuffledIds = [];
  queue = [];
  skippedUpNextIds = new Set();
}

// Hands the playback to another of the user's devices. Resolves once that
// device has taken it over, then stops playing here; throws when it didn't.
async function handOffTo(target: string): Promise<void> {
  if (handingOff) throw new Error("Playback is already moving");
  if (!currentTrack || playId == null || loading) {
    throw new Error("Nothing is playing here");
  }
  handingOff = true;
  try {
    await syncQueue();
    stopReportInterval();
    // The server hands over the play it last heard about.
    await reportProgress(audio.paused ? "paused" : "playing");
    const id = playbackId;
    if (id == null) throw new Error("Playback isn't ready yet");
    const response = await sendHandoff(target, id, playbackQueueRevision);
    if (response.status !== "ok") {
      throw new Error(response.error ?? "The device didn't take over playback");
    }
    // The playback is the target's now; a fresh one holds the next play here.
    playbackId = null;
    clearLocal();
  } catch (e) {
    if (playId != null) startReportInterval();
    throw e;
  } finally {
    handingOff = false;
  }
}

function placeholderTrack(id: string): TrackResponse {
  return { id, title: "" };
}

function artistNamesOf(track: TrackResponse): string {
  return (track.artists ?? []).map((a) => a.name).join(", ");
}

// Loads the tracks of a queue taken from another device a few at a time.
async function fillContextTracks(context: PlaybackContext, loadedId: string) {
  const pending = context.tracks
    .map((t, i) => ({ id: t.id, i }))
    .filter(({ id }) => id !== loadedId);
  const worker = async () => {
    for (let next = pending.shift(); next; next = pending.shift()) {
      if (playbackContext !== context) return;
      try {
        const track = await fetchTrackDetail(next.id);
        if (playbackContext !== context) return;
        context.tracks[next.i] = track;
        context.trackArtistNames[track.id] = artistNamesOf(track);
      } catch {
        // The row keeps its placeholder.
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

// Plays a server queue here, from `positionMs` of its current track.
async function playQueue(
  snapshot: QueueSnapshot & { revision: number },
  options: StartOptions & { adoptPlayback?: string },
) {
  // A track queued twice would confuse the up-next order, so keep one.
  const currentId = snapshot.track_ids[snapshot.current_index];
  const ids = snapshot.track_ids.filter(
    (id, i) => snapshot.track_ids.indexOf(id) === i,
  );
  const current = await fetchTrackDetail(currentId);
  const context: PlaybackContext = {
    tracks: ids.map((id) =>
      id === currentId ? current : placeholderTrack(id),
    ),
    title: "",
    coverUrl: null,
    coverBlurhash: null,
    trackArtistNames: { [current.id]: artistNamesOf(current) },
    coverFromTrack: true,
  };
  queue = [];
  skippedUpNextIds = new Set();
  shuffle = snapshot.shuffle_enabled;
  shuffledIds = shuffle ? ids : [];
  await playTrackInternal(current, context, {
    ...options,
    adopt: options.adoptPlayback
      ? { playbackId: options.adoptPlayback, revision: snapshot.revision }
      : undefined,
  });
  if (playbackContext) fillContextTracks(playbackContext, currentId);
}

// Continues a playback another device handed this browser. Reporting
// progress with the command's token completes the handoff.
async function acceptHandoff(
  cmd: Extract<ForwardedCommand, { action: "handoff_queue" }>,
) {
  try {
    const [snapshot, playback] = await Promise.all([
      fetchPlaybackQueue(cmd.playback_id, cmd.queue_revision),
      fetchPlayback(cmd.playback_id),
    ]);
    await playQueue(snapshot, {
      adoptPlayback: cmd.playback_id,
      playId: cmd.play_id ?? undefined,
      positionMs: playback.current?.effective_position_ms,
      autoplay: playback.current?.state !== "paused",
      handoffToken: cmd.handoff_token,
    });
  } catch (e) {
    console.error("Taking over playback failed:", e);
  }
}

// Plays another device's queue here as this browser's own playback.
async function takeOver(
  sourcePlaybackId: string,
  positionMs: number,
  paused: boolean,
) {
  const snapshot = await fetchPlaybackQueue(sourcePlaybackId);
  await playQueue(snapshot, { positionMs, autoplay: !paused });
}

onForwardedCommand((cmd) => {
  switch (cmd.action) {
    case "play":
    case "unpause":
      resume();
      break;
    case "pause":
      pause();
      break;
    case "stop":
      stop();
      break;
    case "next_track":
      nextTrack();
      break;
    case "previous_track":
      prevTrack();
      break;
    case "seek":
      seek(cmd.position_ms / 1000);
      break;
    case "set_volume":
      setVolume(cmd.level);
      break;
    case "handoff_queue":
      acceptHandoff(cmd);
      break;
  }
});

function seek(time: number) {
  audio.currentTime = time;
}

function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  audio.volume = volume;
}

function isCurrentTrack(track: TrackResponse): boolean {
  return !!currentTrack?.id && currentTrack.id === track.id;
}

export function getPlayer() {
  return {
    get currentTrack() {
      return currentTrack;
    },
    get playbackContext() {
      return playbackContext;
    },
    get playing() {
      return playing;
    },
    get currentTime() {
      return currentTime;
    },
    get duration() {
      return duration;
    },
    get loading() {
      return loading;
    },
    get volume() {
      return volume;
    },
    get currentCover(): { url: string | null; blurhash: string | null } {
      if (!playbackContext) return { url: null, blurhash: null };
      if (!playbackContext.coverFromTrack) {
        return {
          url: playbackContext.coverUrl,
          blurhash: playbackContext.coverBlurhash,
        };
      }
      const cover = currentTrack?.releases?.[0]?.cover;
      return {
        url: cover ? coverUrl(cover.id) : null,
        blurhash: cover?.blurhash ?? null,
      };
    },
    get shuffle() {
      return shuffle;
    },
    get currentArtistNames() {
      if (!currentTrack?.id || !playbackContext) return "";
      return playbackContext.trackArtistNames[currentTrack.id] ?? "";
    },
    get queue() {
      return queue;
    },
    get upNext() {
      return getUpNext();
    },
    playTrack,
    handOffTo,
    takeOver,
    togglePlayback,
    toggleShuffle,
    resume,
    pause,
    stop,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    isCurrentTrack,
    addToQueue,
    removeFromQueue,
    removeFromUpNext,
    clearQueue,
    clearUpNext,
  };
}
