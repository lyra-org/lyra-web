// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { TagColor, TagResponse } from "./types";
import {
  attachTag as apiAttachTag,
  detachTag as apiDetachTag,
  fetchTagTargets,
  fetchTags,
} from "./api";

let tags = $state<TagResponse[]>([]);
let targetsByTag = $state<Record<string, Set<string>>>({});
let loaded = $state(false);
let loading = $state(false);
let loadPromise: Promise<void> | null = null;

async function fetchAllTargets(tagId: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchTagTargets(tagId, cursor, 500);
    ids.push(...page.target_ids);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return ids;
}

async function loadInternal() {
  loading = true;
  try {
    const all: TagResponse[] = [];
    let cursor: string | undefined;
    do {
      const page = await fetchTags(cursor, 500);
      all.push(...page.items);
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
    const targets: Record<string, Set<string>> = {};
    await Promise.all(
      all.map(async (t) => {
        const ids = await fetchAllTargets(t.id);
        targets[t.id] = new Set(ids);
      }),
    );
    tags = all;
    targetsByTag = targets;
    loaded = true;
  } finally {
    loading = false;
    loadPromise = null;
  }
}

function load(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = loadInternal();
  return loadPromise;
}

function refresh(): Promise<void> {
  loaded = false;
  return load();
}

function tagsForTarget(targetId: string): TagResponse[] {
  return tags.filter((t) => targetsByTag[t.id]?.has(targetId));
}

function isAttached(tagId: string, targetId: string): boolean {
  return targetsByTag[tagId]?.has(targetId) ?? false;
}

async function attach(name: string, color: TagColor, targetId: string) {
  await apiAttachTag(name, color, targetId);
  await refresh();
}

async function detach(tagId: string, targetId: string) {
  await apiDetachTag(tagId, targetId);
  const updated = { ...targetsByTag };
  const set = new Set(updated[tagId] ?? []);
  set.delete(targetId);
  updated[tagId] = set;
  targetsByTag = updated;
}

export function getTags() {
  return {
    get tags() {
      return tags;
    },
    get loaded() {
      return loaded;
    },
    get loading() {
      return loading;
    },
    load,
    refresh,
    tagsForTarget,
    isAttached,
    attach,
    detach,
  };
}

export const TAG_COLORS: TagColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
];

export function tagChipClasses(color: string): string {
  switch (color) {
    case "red":
      return "bg-red-50 text-red-600/80 dark:bg-red-950/30 dark:text-red-300/80";
    case "orange":
      return "bg-orange-50 text-orange-600/80 dark:bg-orange-950/30 dark:text-orange-300/80";
    case "yellow":
      return "bg-yellow-50 text-yellow-700/80 dark:bg-yellow-950/30 dark:text-yellow-300/80";
    case "green":
      return "bg-green-50 text-green-600/80 dark:bg-green-950/30 dark:text-green-300/80";
    case "blue":
      return "bg-blue-50 text-blue-600/80 dark:bg-blue-950/30 dark:text-blue-300/80";
    case "purple":
      return "bg-purple-50 text-purple-600/80 dark:bg-purple-950/30 dark:text-purple-300/80";
    case "pink":
      return "bg-pink-50 text-pink-600/80 dark:bg-pink-950/30 dark:text-pink-300/80";
    case "gray":
    default:
      return "bg-slate-50 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400";
  }
}

export function tagSwatchClass(color: string): string {
  switch (color) {
    case "red":
      return "bg-red-300 dark:bg-red-400/70";
    case "orange":
      return "bg-orange-300 dark:bg-orange-400/70";
    case "yellow":
      return "bg-yellow-300 dark:bg-yellow-400/70";
    case "green":
      return "bg-green-300 dark:bg-green-400/70";
    case "blue":
      return "bg-blue-300 dark:bg-blue-400/70";
    case "purple":
      return "bg-purple-300 dark:bg-purple-400/70";
    case "pink":
      return "bg-pink-300 dark:bg-pink-400/70";
    case "gray":
    default:
      return "bg-slate-300 dark:bg-neutral-500";
  }
}
