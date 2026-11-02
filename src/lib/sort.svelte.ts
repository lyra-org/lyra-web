// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { ListFilter } from "./api";
import { getAuth } from "./auth.svelte.ts";

export type SortKind = "albums" | "artists" | "tracks" | "genres" | "playlists";
export type SortOrder = "ascending" | "descending";

export interface Sort {
  sortBy: string;
  sortOrder: SortOrder;
}

export const sortFields: Record<SortKind, string[]> = {
  albums: [
    "name",
    "date_created",
    "release_date",
    "last_played_at",
    "listen_count",
    "total_duration",
    "rating",
    "rated_at",
    "favorited_at",
  ],
  artists: [
    "name",
    "date_created",
    "last_played_at",
    "listen_count",
    "release_count",
    "track_count",
    "total_duration",
    "rating",
    "rated_at",
    "favorited_at",
  ],
  tracks: [
    "name",
    "date_created",
    "last_played_at",
    "listen_count",
    "duration",
    "rating",
    "rated_at",
    "favorited_at",
  ],
  genres: [
    "name",
    "last_played_at",
    "listen_count",
    "release_count",
    "track_count",
    "total_duration",
  ],
  playlists: [
    "name",
    "created_at",
    "updated_at",
    "track_count",
    "total_duration",
    "favorited_at",
  ],
};

export const listFilters = {
  all: {},
  favorites: { favorite: true },
  played: { listened: true },
  unplayed: { listened: false },
  rated: { rated: true },
  unrated: { rated: false },
} satisfies Record<string, ListFilter>;

export type ListFilterKey = keyof typeof listFilters;

export const listFilterOptions: { value: ListFilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "played", label: "Played" },
  { value: "unplayed", label: "Not played" },
  { value: "rated", label: "Rated" },
  { value: "unrated", label: "Not rated" },
];

const STORAGE_PREFIX = "lyra-sort";
const FILTER_STORAGE_PREFIX = "lyra-filter";

function readSort(key: string, kind: SortKind): Sort | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      sortFields[kind].includes(stored?.sortBy) &&
      (stored.sortOrder === "ascending" || stored.sortOrder === "descending")
    ) {
      return { sortBy: stored.sortBy, sortOrder: stored.sortOrder };
    }
  } catch {
    // Unreadable or unavailable storage falls back to the defaults.
  }
  return null;
}

function writeSort(key: string, sort: Sort, defaults: Sort) {
  try {
    if (
      sort.sortBy === defaults.sortBy &&
      sort.sortOrder === defaults.sortOrder
    ) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(sort));
    }
  } catch {
    // The choice still applies for this visit when storage is unavailable.
  }
}

/**
 * Sort state for a view, remembered per user in this browser. Call it while a
 * component initializes: that component's effect saves each change.
 */
export function savedSort(
  view: string,
  kind: SortKind,
  defaults: Sort = { sortBy: "name", sortOrder: "ascending" },
): Sort {
  const key = `${STORAGE_PREFIX}:${getAuth().me?.id ?? ""}:${view}`;
  const sort = $state(readSort(key, kind) ?? { ...defaults });
  $effect(() =>
    writeSort(
      key,
      { sortBy: sort.sortBy, sortOrder: sort.sortOrder },
      defaults,
    ),
  );
  return sort;
}

/**
 * A view's filter choice, remembered like {@link savedSort}. `choices[0]` is
 * the default.
 */
export function savedFilter<K extends string>(
  view: string,
  choices: readonly K[],
): { value: K } {
  const key = `${FILTER_STORAGE_PREFIX}:${getAuth().me?.id ?? ""}:${view}`;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    // Unreadable or unavailable storage falls back to the default.
  }
  const filter = $state({
    value: choices.find((choice) => choice === stored) ?? choices[0],
  });
  $effect(() => {
    const value = filter.value;
    try {
      if (value === choices[0]) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // The choice still applies for this visit when storage is unavailable.
    }
  });
  return filter;
}
