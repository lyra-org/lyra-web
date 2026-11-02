// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { checkRatings, setRating, removeRating } from "./api";
import { createTargetStates } from "./targetStates.svelte.ts";

// A 1-5 rating, or null when unrated.
const ratings = createTargetStates((ids) =>
  checkRatings(ids).then((res) => res.ratings),
);

export const getRating = ratings.get;
export const isRatingLoading = ratings.isLoading;
export const isRatingSaving = ratings.isSaving;
export const loadRating = ratings.load;

/** Sets the caller's rating, or clears it when `rating` is null. */
export async function rate(
  targetId: string,
  rating: number | null,
): Promise<void> {
  try {
    await ratings.update(targetId, rating, () =>
      rating == null ? removeRating(targetId) : setRating(targetId, rating),
    );
  } catch {
    throw new Error("Failed to update rating");
  }
}
