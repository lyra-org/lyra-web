// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { LibrarySyncRunKind, LibrarySyncStatus } from "./types";

const stageLabels: Record<string, string> = {
  discover: "Discovering",
  entry_sync: "Scanning",
  metadata_parse: "Importing metadata",
  metadata_apply: "Importing metadata",
  provider_refresh: "Refreshing metadata",
  local_cover_metadata: "Reading covers",
  lyrics: "Refreshing lyrics",
  provider_cover: "Refreshing covers",
  cleanup: "Cleaning up",
  purge: "Purging",
};

// What a stage is called once it's over, for the failures it left behind.
export const failureStageLabels: Record<string, string> = {
  discover: "Discovery",
  entry_sync: "File scan",
  metadata_parse: "Tags",
  metadata_apply: "Tags",
  provider_refresh: "Metadata",
  local_cover_metadata: "Local covers",
  lyrics: "Lyrics",
  provider_cover: "Covers",
  cleanup: "Cleanup",
  purge: "Purge",
};

export const runVerbs: Record<LibrarySyncRunKind, string> = {
  library_sync: "Syncing",
  library_refresh: "Refreshing",
  library_purge: "Purging",
};

const runNouns: Record<LibrarySyncRunKind, string> = {
  library_sync: "sync",
  library_refresh: "refresh",
  library_purge: "purge",
};

const runPastTense: Record<LibrarySyncRunKind, string> = {
  library_sync: "Synced",
  library_refresh: "Refreshed",
  library_purge: "Purged",
};

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function runTitle(kind: LibrarySyncRunKind): string {
  return capitalized(runNouns[kind]);
}

export function isActiveSync(s: LibrarySyncStatus | undefined): boolean {
  return (
    s?.run.status === "queued" ||
    s?.run.status === "planning" ||
    s?.run.status === "running" ||
    s?.run.status === "cancelling"
  );
}

function settledUnits(s: LibrarySyncStatus): number {
  return (
    s.progress.completed_units +
    s.progress.failed_units +
    s.progress.skipped_units
  );
}

export function syncCompletion(s: LibrarySyncStatus): number | null {
  if (s.progress.mode !== "determinate" || s.progress.total_units <= 0) {
    return null;
  }

  return Math.max(
    0,
    Math.min(100, (settledUnits(s) / s.progress.total_units) * 100),
  );
}

export function syncLabel(s: LibrarySyncStatus | undefined): string | null {
  if (!isActiveSync(s) || !s) return null;
  if (s.run.status === "cancelling") return "Cancelling";

  const verb = runVerbs[s.run.kind];
  if (s.current) {
    return stageLabels[s.current.stage] ?? verb;
  }

  if (s.run.status === "planning" || s.progress.mode === "estimating") {
    return `Planning ${runNouns[s.run.kind]}`;
  }
  return verb;
}

// How a finished run ended, or null for a library that never ran or a run
// still going.
export function runOutcome(s: LibrarySyncStatus): string | null {
  switch (s.run.status) {
    case "succeeded":
      return runPastTense[s.run.kind];
    case "failed":
      return `${runTitle(s.run.kind)} failed`;
    case "cancelled":
      return `${runTitle(s.run.kind)} cancelled`;
    default:
      return null;
  }
}

export type RunResult = "active" | "clean" | "partial" | "failed" | "cancelled";

export function runResult(s: LibrarySyncStatus): RunResult | null {
  if (isActiveSync(s)) return "active";
  switch (s.run.status) {
    case "succeeded":
      return s.failure_count > 0 ? "partial" : "clean";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

// A run's name in the history, which says more than the card's outcome has to.
export function runHistoryTitle(s: LibrarySyncStatus): string | null {
  if (runResult(s) === "partial") {
    return `Partly ${runPastTense[s.run.kind].toLowerCase()}`;
  }
  return syncLabel(s) ?? runOutcome(s);
}

export function failedItems(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "item" : "items"} failed`;
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(timestamp: string, now: number): string {
  const seconds = (new Date(timestamp).getTime() - now) / 1000;
  for (const [unit, length] of relativeUnits) {
    if (Math.abs(seconds) >= length) {
      return relativeTime.format(Math.trunc(seconds / length), unit);
    }
  }
  return "just now";
}

export function runDuration(s: LibrarySyncStatus): string | null {
  if (!s.run.started_at || !s.run.finished_at) return null;
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(s.run.finished_at).getTime() -
        new Date(s.run.started_at).getTime()) /
        1000,
    ),
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
