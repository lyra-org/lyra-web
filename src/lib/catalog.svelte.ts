// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

// Bumped when a change leaves the page showing entities that no longer exist.
// The app loads the current page again.
let revision = $state(0);

export function catalogRevision(): number {
  return revision;
}

export function catalogChanged() {
  revision += 1;
}
