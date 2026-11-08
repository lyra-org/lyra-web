// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { LyricsResponse } from "./types";

// The server's threshold. A line at 0 ms carries no timing.
const MIN_SYNCED_LINES = 2;

export function isSynced(lyrics: LyricsResponse): boolean {
  const timed = lyrics.lines?.filter((line) => line.ts_ms > 0) ?? [];
  return timed.length >= MIN_SYNCED_LINES;
}

export function plainLyrics(lyrics: LyricsResponse): string {
  if (lyrics.plain_text) return lyrics.plain_text;
  return (lyrics.lines ?? []).map((line) => line.text).join("\n");
}
