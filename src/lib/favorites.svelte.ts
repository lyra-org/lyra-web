// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { checkFavorites, addFavorite, removeFavorite } from "./api";
import { createTargetStates } from "./targetStates.svelte.ts";

const favorites = createTargetStates((ids) =>
  checkFavorites(ids).then((res) => res.favorited),
);

export const getFavoriteState = favorites.get;
export const isFavoriteLoading = favorites.isLoading;
export const isFavoriteToggling = favorites.isSaving;
export const loadFavorite = favorites.load;

export async function toggleFavorite(targetId: string): Promise<boolean> {
  const next = !(await loadFavorite(targetId));
  try {
    await favorites.update(targetId, next, () =>
      next ? addFavorite(targetId) : removeFavorite(targetId),
    );
  } catch {
    throw new Error("Failed to update favorite");
  }
  return next;
}
