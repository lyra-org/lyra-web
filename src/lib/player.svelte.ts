// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { TrackResponse } from "./types";
import {
  createPlaybackUrl,
  startPlayback,
  reportPlaybackProgress,
} from "./api";

export interface PlaybackContext {
  tracks: TrackResponse[];
  title: string;
  coverUrl: string | null;
  coverBlurhash: string | null;
  trackArtistNames: Record<string, string>;
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
let playbackId: string | null = null;
let playbackQueueRevision = 0;
let reportIntervalId: ReturnType<typeof setInterval> | null = null;

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

function reportProgress(state: string) {
  if (playbackId == null) return;
  const posMs = Math.round(audio.currentTime * 1000);
  const durMs = audio.duration ? Math.round(audio.duration * 1000) : undefined;
  reportPlaybackProgress(
    playbackId,
    playbackQueueRevision,
    posMs,
    state,
    durMs,
  ).catch(() => {});
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

audio.addEventListener("play", () => {
  const wasPlaying = playing;
  playing = true;
  if (wasPlaying === false && playbackId != null) {
    reportProgress("playing");
    startReportInterval();
  }
});

audio.addEventListener("pause", () => {
  playing = false;
  reportProgress("paused");
  if (playbackId != null) {
    startReportInterval();
  }
});

audio.addEventListener("ended", () => {
  stopReportInterval();
  reportProgress("completed");
  nextTrack();
});

async function playTrackInternal(
  track: TrackResponse,
  context: PlaybackContext,
) {
  if (!track.id) return;

  if (playbackId != null) {
    stopReportInterval();
    reportProgress("stopped");
    playbackId = null;
  }

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

  try {
    const [playbackUrl, pb] = await Promise.all([
      createPlaybackUrl(track.id),
      startPlayback(track.id, track.duration_ms),
    ]);
    if (currentTrack?.id !== track.id) return;
    // Some source containers cannot stream directly. Ask for a browser-playable
    // transcode when the server only offers HLS for the original request.
    const streamUrl =
      playbackUrl.stream_url ??
      (await createPlaybackUrl(track.id, "mp3")).stream_url;
    if (currentTrack?.id !== track.id) return;
    if (!streamUrl) throw new Error("No playable audio stream available");
    audio.src = streamUrl;
    await audio.play();
    playbackId = pb.id;
    playbackQueueRevision = pb.queue_revision;
    startReportInterval();
  } catch (e) {
    console.error("Playback failed:", e);
  } finally {
    loading = false;
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
}

function removeFromQueue(index: number) {
  queue = queue.filter((_, i) => i !== index);
}

function removeFromUpNext(index: number) {
  if (index < queue.length) {
    removeFromQueue(index);
    return;
  }
  const item = getUpNext()[index];
  if (item?.source === "context" && item.track.id) {
    skippedUpNextIds = new Set([...skippedUpNextIds, item.track.id]);
  }
}

function clearQueue() {
  queue = [];
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

function stop() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (playbackId != null) {
    stopReportInterval();
    reportProgress("stopped");
    playbackId = null;
  }
  currentTrack = null;
  playbackContext = null;
  playing = false;
  currentTime = 0;
  duration = 0;
  shuffledIds = [];
  queue = [];
  skippedUpNextIds = new Set();
}

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
    get playbackId() {
      return playbackId;
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
