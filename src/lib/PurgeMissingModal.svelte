<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { LibrarySyncStartResponse, TrackResponse } from "./types";
  import { purgeLibrary } from "./api";
  import Modal from "./Modal.svelte";

  // One missing track, or else all of the library's missing files.
  type Props = {
    libraryId: string;
    onstarted: (response: LibrarySyncStartResponse) => void;
    onclose: () => void;
  } & ({ track: TrackResponse } | { libraryName: string });

  let { libraryId, onstarted, onclose, ...scope }: Props = $props();

  let track = $derived("track" in scope ? scope.track : null);
  let starting = $state(false);
  let error = $state<string | null>(null);

  async function handlePurge() {
    if (starting) return;
    starting = true;
    error = null;
    try {
      onstarted(await purgeLibrary(libraryId, track ? [track.id] : undefined));
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to start the purge";
    } finally {
      starting = false;
    }
  }
</script>

<Modal
  title={track ? "Purge missing track?" : "Purge missing files?"}
  width="narrow"
  onclose={() => {
    if (!starting) onclose();
  }}
>
  <p class="text-sm text-slate-600 dark:text-neutral-300">
    {#if "track" in scope}
      “{scope.track.title}” leaves Lyra with its favorites, ratings, listens,
      playlist entries and lyrics.
    {:else}
      Every missing file in “{scope.libraryName}” leaves Lyra, with the tracks
      only they hold and those tracks' favorites, ratings, listens, playlist
      entries and lyrics. Albums and artists left with nothing go too.
    {/if}
    This cannot be undone.
  </p>
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      disabled={starting}
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}>Cancel</button
    >
    <button
      type="button"
      disabled={starting}
      class="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
      onclick={handlePurge}>{starting ? "Starting…" : "Purge"}</button
    >
  {/snippet}
</Modal>
