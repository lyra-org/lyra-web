// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { untrack } from "svelte";

/** What a detail page shows, loaded for the ID in its route. Create it while
 * the page initializes. */
export class PageResource<T> {
  value = $state<T | null>(null);
  loading = $state(true);
  error = $state<string | null>(null);

  #id: () => string;
  #fetch: (id: string) => Promise<T>;
  #failure: string;
  // Only the latest request may land, so that a slow response for the page
  // left behind never shows on the one navigated to.
  #latest = 0;

  constructor(
    id: () => string,
    fetch: (id: string) => Promise<T>,
    failure: string,
  ) {
    this.#id = id;
    this.#fetch = fetch;
    this.#failure = failure;
    $effect(() => {
      const current = id();
      untrack(() => this.#load(current));
    });
  }

  async #load(id: string) {
    const request = ++this.#latest;
    this.loading = true;
    this.error = null;
    this.value = null;
    try {
      const value = await this.#fetch(id);
      if (request === this.#latest) this.value = value;
    } catch (e) {
      if (request === this.#latest) {
        this.error = e instanceof Error ? e.message : this.#failure;
      }
    } finally {
      if (request === this.#latest) this.loading = false;
    }
  }

  /** Catches up with a change, keeping the page up and its scroll position.
   * A failure leaves it showing what it had. */
  reload = async () => {
    // A load in flight already reads the current state.
    if (this.loading) return;
    const request = ++this.#latest;
    try {
      const value = await this.#fetch(this.#id());
      if (request === this.#latest) {
        this.value = value;
        this.error = null;
      }
    } catch {
      // Nothing to update.
    }
  };
}
