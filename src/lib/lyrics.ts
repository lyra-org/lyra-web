// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { fetchProviders } from "./api";
import type {
  LyricsCandidateSummaryResponse,
  LyricsLineResponse,
  LyricsResponse,
} from "./types";

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

function lrcTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}.` +
    String(millis).padStart(3, "0")
  );
}

function lrcLine(line: LyricsLineResponse): string {
  const words = [...(line.words ?? [])].sort(
    (a, b) => a.char_start - b.char_start,
  );
  // Word offsets count code points, which string indexes do not.
  const chars = Array.from(line.text);
  let text = "";
  let position = 0;
  for (const word of words) {
    text += chars.slice(position, word.char_start).join("");
    text += `<${lrcTimestamp(word.ts_ms)}>`;
    text += chars.slice(word.char_start, word.char_end).join("");
    position = word.char_end;
  }
  text += chars.slice(position).join("");
  return `[${lrcTimestamp(line.ts_ms)}]${text}`;
}

/** The text to edit `lyrics` as, keeping any line and word timing. The
 * server's `format=lrc` drops word timing and lines at 0 ms, so saving its
 * output would lose them. */
export function editableLyrics(lyrics: LyricsResponse): string {
  const lines = lyrics.lines ?? [];
  if (!lines.some((line) => line.ts_ms > 0)) return plainLyrics(lyrics);
  return lines.map(lrcLine).join("\n");
}

let names: Promise<Record<string, string>> | null = null;

/** Provider display names by id. */
export function lyricsProviderNames(): Promise<Record<string, string>> {
  names ??= fetchProviders().then(
    (providers) =>
      Object.fromEntries(providers.map((p) => [p.provider_id, p.display_name])),
    (error) => {
      names = null;
      throw error;
    },
  );
  return names;
}

export function lyricsSourceLabel(
  source: Pick<
    LyricsCandidateSummaryResponse,
    "scope" | "source" | "provider_id"
  >,
  providerNames: Record<string, string>,
): string {
  if (source.scope === "personal") return "Your lyrics";
  if (source.source === "manual") return "Shared lyrics";
  const id = source.provider_id ?? "";
  return providerNames[id] ?? id;
}
