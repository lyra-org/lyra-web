// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ClientCommand,
  EventMessage,
  ForwardedCommand,
  OutgoingMessage,
  RemoteAction,
  ResponseMessage,
  SeekCommand,
  SetVolumeCommand,
} from "./types";
import { connectionSessionKey } from "./api";
import { getAuth } from "./auth.svelte.ts";
import { getPlayer } from "./player.svelte.ts";

const CAPABILITIES: RemoteAction[] = [
  "play",
  "pause",
  "unpause",
  "stop",
  "seek",
  "next_track",
  "previous_track",
  "set_volume",
];

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const CLOSE_CODE_DUPLICATE_SESSION = 4000;
const CLOSE_CODE_REGISTRATION_REJECTED = 4001;
const TERMINAL_CLOSE_CODES = new Set([
  CLOSE_CODE_DUPLICATE_SESSION,
  CLOSE_CODE_REGISTRATION_REJECTED,
]);

type Status = "disconnected" | "connecting" | "connected";

let status = $state<Status>("disconnected");
let lastEvent = $state<EventMessage | null>(null);

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let manualDisconnect = false;
const pending = new Map<string, (msg: ResponseMessage) => void>();

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function buildUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    session_key: connectionSessionKey(),
    token,
  });
  return `${protocol}//${window.location.host}/ws?${params.toString()}`;
}

function clearReconnectTimer() {
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  if (manualDisconnect) return;
  if (!getAuth().token) return;
  const delay = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * 2 ** Math.min(reconnectAttempt, 6),
  );
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(connect, delay);
}

function isResponseMessage(m: OutgoingMessage): m is ResponseMessage {
  const r = m as ResponseMessage;
  return (
    r.type === "response" &&
    typeof r.id === "string" &&
    typeof r.status === "string"
  );
}

function isEventMessage(m: OutgoingMessage): m is EventMessage {
  return (
    (m as EventMessage).type === "event" &&
    typeof (m as EventMessage).event === "string" &&
    "data" in m
  );
}

function isForwardedCommand(m: OutgoingMessage): m is ForwardedCommand {
  return (
    (m as ForwardedCommand).type === "command" &&
    typeof (m as ForwardedCommand).action === "string"
  );
}

function handleForwardedCommand(cmd: ForwardedCommand) {
  const player = getPlayer();
  switch (cmd.action) {
    case "play":
    case "unpause":
      player.resume();
      break;
    case "pause":
      player.pause();
      break;
    case "stop":
      player.stop();
      break;
    case "next_track":
      player.nextTrack();
      break;
    case "previous_track":
      player.prevTrack();
      break;
    case "seek":
      player.seek(cmd.position_ms / 1000);
      break;
    case "set_volume":
      player.setVolume(cmd.level);
      break;
  }
}

function onMessage(ev: MessageEvent<string>) {
  let msg: OutgoingMessage;
  try {
    msg = JSON.parse(ev.data) as OutgoingMessage;
  } catch {
    return;
  }
  if (isResponseMessage(msg)) {
    const cb = pending.get(msg.id);
    if (cb) {
      pending.delete(msg.id);
      cb(msg);
    }
    return;
  }
  if (isForwardedCommand(msg)) {
    handleForwardedCommand(msg);
    return;
  }
  if (isEventMessage(msg)) {
    lastEvent = msg;
  }
}

function onOpen() {
  status = "connected";
  reconnectAttempt = 0;
  send({
    action: "declare_capabilities",
    id: makeId(),
    commands: CAPABILITIES,
  }).catch(() => {});
}

function onClose(ev: CloseEvent) {
  socket = null;
  status = "disconnected";
  for (const [id, cb] of pending.entries()) {
    cb({ type: "response", id, status: "error", error: "disconnected" });
  }
  pending.clear();
  if (TERMINAL_CLOSE_CODES.has(ev.code)) {
    manualDisconnect = true;
  }
  scheduleReconnect();
}

function send(cmd: ClientCommand): Promise<ResponseMessage> {
  return new Promise((resolve, reject) => {
    if (socket == null || socket.readyState !== WebSocket.OPEN) {
      reject(new Error("websocket not open"));
      return;
    }
    pending.set(cmd.id, resolve);
    try {
      socket.send(JSON.stringify(cmd));
    } catch (err) {
      pending.delete(cmd.id);
      reject(err);
    }
  });
}

export function connect() {
  clearReconnectTimer();
  if (socket != null) return;
  const token = getAuth().token;
  if (!token) {
    status = "disconnected";
    return;
  }
  manualDisconnect = false;
  status = "connecting";
  let ws: WebSocket;
  try {
    ws = new WebSocket(buildUrl(token));
  } catch (err) {
    console.error("websocket connect failed", err);
    status = "disconnected";
    scheduleReconnect();
    return;
  }
  socket = ws;
  ws.addEventListener("open", onOpen);
  ws.addEventListener("message", onMessage);
  ws.addEventListener("close", onClose);
  ws.addEventListener("error", () => {});
}

export function disconnect() {
  manualDisconnect = true;
  clearReconnectTimer();
  reconnectAttempt = 0;
  if (socket != null) {
    socket.close();
    socket = null;
  }
  status = "disconnected";
  pending.clear();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disconnect();
  });
}

function basicSender(
  action:
    | "play"
    | "pause"
    | "unpause"
    | "stop"
    | "next_track"
    | "previous_track",
) {
  return (target: string) => send({ action, id: makeId(), target });
}

export const sendPlay = basicSender("play");
export const sendPause = basicSender("pause");
export const sendUnpause = basicSender("unpause");
export const sendStop = basicSender("stop");
export const sendNextTrack = basicSender("next_track");
export const sendPreviousTrack = basicSender("previous_track");

export function sendSeek(target: string, positionMs: number) {
  const cmd: SeekCommand = {
    action: "seek",
    id: makeId(),
    target,
    position_ms: positionMs,
  };
  return send(cmd);
}

export function sendSetVolume(target: string, level: number) {
  const cmd: SetVolumeCommand = {
    action: "set_volume",
    id: makeId(),
    target,
    level,
  };
  return send(cmd);
}

export function getWebSocket() {
  return {
    get status() {
      return status;
    },
    get lastEvent() {
      return lastEvent;
    },
    connect,
    disconnect,
  };
}
