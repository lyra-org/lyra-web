// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ActivePlayback,
  Connection,
  PlaybackResponse,
  ResumablePlayback,
  TrackResponse,
} from "./types";
import {
  fetchActivePlaybacks,
  fetchConnections,
  fetchQueuePlaybacks,
  fetchTrackForRemote,
} from "./api";
import { getPlayer } from "./player.svelte.ts";
import {
  getWebSocket,
  onEvent,
  sendNextTrack,
  sendPause,
  sendPlay,
  sendPreviousTrack,
  sendSeek,
  sendSetVolume,
  sendStop,
  sendUnpause,
} from "./ws.svelte.ts";

// Plugin-reported playback expires without an event, so an open panel
// rechecks now and then.
const PANEL_POLL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 300;

const player = getPlayer();
const ws = getWebSocket();

let connections = $state<Connection[]>([]);
let playbacks = $state<ActivePlayback[]>([]);
let resumable = $state<ResumablePlayback[]>([]);
let tracks = $state<Record<string, TrackResponse>>({});
let panelOpen = $state(false);
// The device this browser handed its playback to, which the player bar
// controls until it stops playing it.
let controlledId = $state<string | null>(null);
let pendingTarget = $state<string | null>(null);
let errors = $state<Record<string, string>>({});
let now = $state(Date.now());

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const trackFetches = new Set<string>();

setInterval(() => (now = Date.now()), 250);

async function loadTrack(id: string) {
  if (tracks[id] || trackFetches.has(id)) return;
  trackFetches.add(id);
  try {
    const track = await fetchTrackForRemote(id);
    tracks = { ...tracks, [id]: track };
  } catch {
    // The card shows a placeholder.
  } finally {
    trackFetches.delete(id);
  }
}

// The newest queue each client left that nothing plays now, other than this
// browser's own.
function resumableOf(queues: PlaybackResponse[]): ResumablePlayback[] {
  const live = new Set(playbacks.map((p) => p.playback_id));
  const seen = new Set<string>();
  const kept: ResumablePlayback[] = [];
  for (const p of queues) {
    if (live.has(p.id) || p.controller != null) continue;
    if (p.id === player.playbackId) continue;
    const client = JSON.stringify([p.plugin_id, p.client_name]);
    if (seen.has(client)) continue;
    seen.add(client);
    kept.push({
      playback_id: p.id,
      client_name: p.client_name,
      plugin_id: p.plugin_id,
      current: p.current,
      updated_at: p.updated_at,
    });
  }
  return kept;
}

async function refreshPlaybacks() {
  try {
    playbacks = await fetchActivePlaybacks();
    for (const p of playbacks) loadTrack(p.track_id);
    if (panelOpen) {
      resumable = resumableOf(await fetchQueuePlaybacks());
      for (const p of resumable) if (p.current) loadTrack(p.current.track_id);
    }
  } catch (e) {
    console.error("Loading playback failed:", e);
  }
}

async function refresh() {
  try {
    connections = await fetchConnections();
  } catch (e) {
    console.error("Loading devices failed:", e);
  }
  await refreshPlaybacks();
}

function refreshPlaybacksSoon() {
  if (refreshTimer != null) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshPlaybacks();
  }, REFRESH_DEBOUNCE_MS);
}

function upsert(connection: Connection) {
  const i = connections.findIndex((c) => c.id === connection.id);
  const previous = i >= 0 ? connections[i] : null;
  connections =
    i >= 0
      ? connections.map((c) => (c.id === connection.id ? connection : c))
      : [...connections, connection];
  if (previous?.playback_id !== connection.playback_id) refreshPlaybacksSoon();
}

onEvent((event) => {
  switch (event.event) {
    case "connected":
    case "sync_required":
      refresh();
      break;
    case "connection_updated":
      upsert(event.data);
      break;
    case "connection_closed":
      connections = connections.filter((c) => c.id !== event.data.id);
      if (controlledId === event.data.id) controlledId = null;
      break;
    case "playback_state_changed":
      refreshPlaybacksSoon();
      break;
  }
});

function playbackOf(connection: Connection): ActivePlayback | null {
  if (connection.playback_id == null) return null;
  return (
    playbacks.find((p) => p.playback_id === connection.playback_id) ?? null
  );
}

function isActive(p: ActivePlayback): boolean {
  return (
    p.state === "playing" || p.state === "paused" || p.state === "buffering"
  );
}

function livePosition(p: ActivePlayback): number {
  if (p.state !== "playing") return p.effective_position_ms;
  const updated = Date.parse(p.updated_at);
  if (!Number.isFinite(updated)) return p.effective_position_ms;
  const max = p.duration_ms ?? Number.POSITIVE_INFINITY;
  return Math.min(max, p.position_ms + Math.max(0, now - updated));
}

function deviceName(connection: Connection): string {
  if (connection.id === ws.selfId) return "This browser";
  return (
    connection.client_name?.trim() || `Device ${connection.id.slice(0, 6)}`
  );
}

function controlled(): Connection | null {
  if (controlledId == null || player.currentTrack != null) return null;
  const connection = connections.find((c) => c.id === controlledId);
  if (!connection) return null;
  const p = playbackOf(connection);
  return p && isActive(p) ? connection : null;
}

function patchPlayback(connectionId: string, patch: Partial<ActivePlayback>) {
  playbacks = playbacks.map((p) =>
    p.connection_id === connectionId ? { ...p, ...patch } : p,
  );
}

async function dispatch(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    // The next refresh shows what actually happened.
  } finally {
    refreshPlaybacksSoon();
  }
}

function updatedNow(): string {
  return new Date().toISOString();
}

function togglePlay(connectionId: string) {
  const connection = connections.find((c) => c.id === connectionId);
  const p = connection ? playbackOf(connection) : null;
  if (!connection || !p) return;
  const supports = (a: string) =>
    connection.supported_commands.some((c) => c === a);
  if (p.state === "playing" || p.state === "buffering") {
    if (!supports("pause")) return;
    patchPlayback(connectionId, {
      state: "paused",
      position_ms: livePosition(p),
      effective_position_ms: livePosition(p),
      updated_at: updatedNow(),
    });
    dispatch(sendPause(connectionId));
  } else {
    patchPlayback(connectionId, { state: "playing", updated_at: updatedNow() });
    dispatch(
      supports("unpause") ? sendUnpause(connectionId) : sendPlay(connectionId),
    );
  }
}

function stop(connectionId: string) {
  patchPlayback(connectionId, { state: "stopped", updated_at: updatedNow() });
  if (controlledId === connectionId) controlledId = null;
  dispatch(sendStop(connectionId));
}

function seek(connectionId: string, positionMs: number) {
  patchPlayback(connectionId, {
    position_ms: positionMs,
    effective_position_ms: positionMs,
    updated_at: updatedNow(),
  });
  dispatch(sendSeek(connectionId, positionMs));
}

function nextTrack(connectionId: string) {
  dispatch(sendNextTrack(connectionId));
}

function previousTrack(connectionId: string) {
  dispatch(sendPreviousTrack(connectionId));
}

function setVolume(connectionId: string, level: number) {
  dispatch(sendSetVolume(connectionId, level));
}

// Moves this browser's playback to another device.
async function moveTo(connectionId: string) {
  if (pendingTarget != null) return;
  const { [connectionId]: _, ...rest } = errors;
  errors = rest;
  pendingTarget = connectionId;
  try {
    await player.handOffTo(connectionId);
    controlledId = connectionId;
  } catch (e) {
    errors = {
      ...errors,
      [connectionId]:
        e instanceof Error ? e.message : "The device didn't take over playback",
    };
  } finally {
    pendingTarget = null;
    refreshPlaybacksSoon();
  }
}

// Plays another device's queue here and stops it there. A device can't hand
// playback to the one asking, so this browser takes the queue itself.
async function playHere(connectionId: string) {
  const connection = connections.find((c) => c.id === connectionId);
  const p = connection ? playbackOf(connection) : null;
  if (!p || p.queue_revision == null) return;
  const positionMs = livePosition(p);
  const paused = p.state === "paused";
  await sendStop(connectionId).catch(() => {});
  if (controlledId === connectionId) controlledId = null;
  try {
    await player.takeOver(p.playback_id, positionMs, paused);
  } catch (e) {
    errors = {
      ...errors,
      [connectionId]:
        e instanceof Error ? e.message : "Couldn't play that queue here",
    };
  }
  refreshPlaybacksSoon();
}

// Plays a queue nothing plays now here, from where it was left.
async function resume(playbackId: string) {
  try {
    await player.takeOver(playbackId, null, false);
  } catch (e) {
    errors = {
      ...errors,
      [playbackId]:
        e instanceof Error ? e.message : "Couldn't play that queue here",
    };
  }
  refreshPlaybacksSoon();
}

function dismissError(connectionId: string) {
  const { [connectionId]: _, ...rest } = errors;
  errors = rest;
}

function openPanel() {
  if (panelOpen) return;
  panelOpen = true;
  refresh();
  pollTimer ??= setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, PANEL_POLL_MS);
}

function closePanel() {
  panelOpen = false;
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function getDevices() {
  return {
    get connections() {
      return connections;
    },
    get selfId() {
      return ws.selfId;
    },
    get online() {
      return ws.status === "connected";
    },
    // Plays that plugins report, which can be seen but not controlled.
    get externalPlaybacks() {
      return playbacks.filter((p) => p.plugin_id != null && isActive(p));
    },
    // Queues left by clients that went away, newest first, one per client.
    get resumable() {
      return resumable;
    },
    get controlled() {
      return controlled();
    },
    get pendingTarget() {
      return pendingTarget;
    },
    get errors() {
      return errors;
    },
    get panelOpen() {
      return panelOpen;
    },
    trackOf(id: string): TrackResponse | undefined {
      return tracks[id];
    },
    playbackOf,
    livePosition,
    deviceName,
    openPanel,
    closePanel,
    togglePlay,
    stop,
    seek,
    nextTrack,
    previousTrack,
    setVolume,
    moveTo,
    playHere,
    resume,
    dismissError,
  };
}
