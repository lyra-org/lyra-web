// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { checkFavorite, addFavorite, removeFavorite } from "./api";

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

export async function loadFavorite(targetId: string): Promise<boolean> {
  if (states[targetId] !== undefined) return states[targetId];

  loadingIds[targetId] = true;
  try {
    const res = await checkFavorite(targetId);
    states[targetId] = res.favorited;
    return res.favorited;
  } catch {
    states[targetId] = false;
    return false;
  } finally {
    loadingIds[targetId] = false;
  }
}

export async function toggleFavorite(targetId: string): Promise<boolean> {
  const current = states[targetId] ?? false;
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
