// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { fetchShownCover } from "./api";
import type { CoverOwnerKind, CoverResponse } from "./types";

// Covers changed since the entities on screen were loaded, keyed by entity id.
// Cards, lists and pages keep the entity they loaded; reading the cover through
// here shows the change everywhere without refetching them.
const changed = $state<Record<string, CoverResponse | null>>({});

/** The cover `id` shows: the latest change, else `loaded`. */
export function shownCover(
  id: string | null | undefined,
  loaded: CoverResponse | null | undefined,
): CoverResponse | null {
  if (id != null && id in changed) return changed[id];
  return loaded ?? null;
}

export function setShownCover(id: string, cover: CoverResponse | null) {
  changed[id] = cover;
}

/** Loads the cover `id` shows now, such as after a refresh synced it. */
export async function reloadShownCover(
  kind: CoverOwnerKind,
  id: string,
): Promise<void> {
  setShownCover(id, await fetchShownCover(kind, id));
}
