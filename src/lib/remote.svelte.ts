// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { ActivePlaybackSession, TrackResponse } from "./types";
import { fetchActivePlaybackSessions, fetchTrackForRemote } from "./api";
import {
  sendPlay,
  sendPause,
  sendUnpause,
  sendStop,
  sendNextTrack,
  sendPreviousTrack,
  sendSeek,
  sendSetVolume,
} from "./ws.svelte";

const POLL_MS = 2_500;
const REFRESH_AFTER_COMMAND_MS = 350;

let sessions = $state<ActivePlaybackSession[]>([]);
let tracks = $state<Record<string, TrackResponse>>({});
let loading = $state(false);
let error = $state<string | null>(null);
let lastRefreshAt = $state(0);
let isOpen = $state(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshAfterCommand: ReturnType<typeof setTimeout> | null = null;
const trackFetches = new Set<string>();
let inflightRefresh: Promise<void> | null = null;

async function loadTrack(id: string) {
  if (tracks[id] || trackFetches.has(id)) return;
  trackFetches.add(id);
  try {
    const t = await fetchTrackForRemote(id);
    tracks = { ...tracks, [id]: t };
  } catch {
    // silent: card just shows the track id
  } finally {
    trackFetches.delete(id);
  }
}

async function doRefresh() {
  loading = true;
  try {
    const list = await fetchActivePlaybackSessions();
    sessions = list;
    error = null;
    lastRefreshAt = Date.now();
    for (const s of list) {
      if (!tracks[s.track_id]) loadTrack(s.track_id);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sessions";
  } finally {
    loading = false;
  }
}

export function refresh(): Promise<void> {
  if (inflightRefresh) return inflightRefresh;
  const p = doRefresh().finally(() => {
    inflightRefresh = null;
  });
  inflightRefresh = p;
  return p;
}

function scheduleRefreshAfterCommand() {
  if (refreshAfterCommand != null) clearTimeout(refreshAfterCommand);
  refreshAfterCommand = setTimeout(() => {
    refreshAfterCommand = null;
    refresh();
  }, REFRESH_AFTER_COMMAND_MS);
}

function open() {
  if (isOpen) return;
  isOpen = true;
  refresh();
  if (pollTimer == null) {
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
  }
}

function close() {
  isOpen = false;
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (refreshAfterCommand != null) {
    clearTimeout(refreshAfterCommand);
    refreshAfterCommand = null;
  }
}

function applyOptimistic(token: string, patch: Partial<ActivePlaybackSession>) {
  sessions = sessions.map((s) =>
    s.connection_token === token ? { ...s, ...patch } : s,
  );
}

async function dispatch(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    // refresh will surface the truth
  } finally {
    scheduleRefreshAfterCommand();
  }
}

function play(token: string) {
  applyOptimistic(token, {
    state: "playing",
    updated_at: new Date().toISOString(),
  });
  return dispatch(sendPlay(token));
}

function pause(token: string) {
  applyOptimistic(token, {
    state: "paused",
    updated_at: new Date().toISOString(),
  });
  return dispatch(sendPause(token));
}

function unpause(token: string) {
  applyOptimistic(token, {
    state: "playing",
    updated_at: new Date().toISOString(),
  });
  return dispatch(sendUnpause(token));
}

function stop(token: string) {
  applyOptimistic(token, {
    state: "stopped",
    updated_at: new Date().toISOString(),
  });
  return dispatch(sendStop(token));
}

function nextTrack(token: string) {
  return dispatch(sendNextTrack(token));
}

function previousTrack(token: string) {
  return dispatch(sendPreviousTrack(token));
}

function seek(token: string, positionMs: number) {
  applyOptimistic(token, {
    position_ms: positionMs,
    effective_position_ms: positionMs,
    updated_at: new Date().toISOString(),
  });
  return dispatch(sendSeek(token, positionMs));
}

function setVolume(token: string, level: number) {
  return dispatch(sendSetVolume(token, level));
}

export function getRemote() {
  return {
    get sessions() {
      return sessions;
    },
    get tracks() {
      return tracks;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get lastRefreshAt() {
      return lastRefreshAt;
    },
    get isOpen() {
      return isOpen;
    },
    open,
    close,
    refresh,
    play,
    pause,
    unpause,
    stop,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
  };
}
