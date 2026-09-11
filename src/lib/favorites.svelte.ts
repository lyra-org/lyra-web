// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { checkFavorites, addFavorite, removeFavorite } from "./api";
import type { CheckResponse } from "./types";

const states = $state<Record<string, boolean>>({});
const loadingIds = $state<Record<string, boolean>>({});
const togglingIds = $state<Record<string, boolean>>({});

export function getFavoriteState(targetId: string): boolean | undefined {
  return states[targetId];
}

export function isFavoriteLoading(targetId: string): boolean {
  return loadingIds[targetId] ?? false;
}

export function isFavoriteToggling(targetId: string): boolean {
  return togglingIds[targetId] ?? false;
}

const pending = new Map<string, Promise<boolean>>();
let batch: { ids: string[]; response: Promise<CheckResponse> } | undefined;

export async function loadFavorite(targetId: string): Promise<boolean> {
  if (states[targetId] !== undefined) return states[targetId];

  const existing = pending.get(targetId);
  if (existing) return existing;

  if (!batch) {
    const ids: string[] = [];
    const response = Promise.resolve().then(() => {
      if (batch?.ids === ids) batch = undefined;
      return checkFavorites(ids);
    });
    batch = { ids, response };
  }

  const { ids, response } = batch;
  ids.push(targetId);
  // The server accepts at most 500 targets per bulk check.
  if (ids.length === 500) batch = undefined;

  loadingIds[targetId] = true;
  const request = response
    .then((res) => {
      const favorited = res.favorited[targetId];
      if (favorited === undefined) {
        throw new Error("Missing favorite state");
      }
      states[targetId] = favorited;
      return favorited;
    })
    .finally(() => {
      loadingIds[targetId] = false;
      pending.delete(targetId);
    });
  pending.set(targetId, request);
  return request;
}

export async function toggleFavorite(targetId: string): Promise<boolean> {
  const current = await loadFavorite(targetId);
  const next = !current;
  states[targetId] = next;
  togglingIds[targetId] = true;
  try {
    if (next) await addFavorite(targetId);
    else await removeFavorite(targetId);
    return next;
  } catch {
    states[targetId] = current;
    throw new Error("Failed to update favorite");
  } finally {
    togglingIds[targetId] = false;
  }
}
