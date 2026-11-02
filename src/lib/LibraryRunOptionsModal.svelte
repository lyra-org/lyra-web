<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    CoverUpdate,
    LibraryResponse,
    LibrarySyncStartResponse,
  } from "./types";
  import { refreshLibrary, startLibrarySync } from "./api";
  import CoverOptionsFields from "./CoverOptionsFields.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    library: LibraryResponse & { id: string };
    run: "sync" | "refresh";
    onstarted: (response: LibrarySyncStartResponse) => void;
    onclose: () => void;
  }

  let { library, run, onstarted, onclose }: Props = $props();

  let allReleases = $state(false);
  let covers = $state<CoverUpdate>("missing");
  let bypassCoverCache = $state(false);
  let starting = $state(false);
  let error = $state<string | null>(null);

  async function handleStart() {
    starting = true;
    error = null;
    try {
      const response =
        run === "sync"
          ? await startLibrarySync(library.id, {
              releases: allReleases ? "all" : "changed",
              covers,
              bypassCoverCache,
            })
          : await refreshLibrary(library.id, { covers, bypassCoverCache });
      onstarted(response);
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to start the run";
    } finally {
      starting = false;
    }
  }
</script>

<Modal
  title={run === "sync" ? "Sync with options" : "Refresh with options"}
  subtitle={library.name}
  width="narrow"
  onclose={() => {
    if (!starting) onclose();
  }}
>
  {#if run === "sync"}
    <label
      class="flex items-center justify-between gap-3 py-1 text-sm text-slate-700 dark:text-neutral-300"
    >
      <span>
        Refresh all releases
        <span class="block text-xs text-slate-400">
          Ask the providers about every release, not only new or changed ones,
          and fetch covers for their artists too
        </span>
      </span>
      <input type="checkbox" bind:checked={allReleases} />
    </label>
  {/if}
  <section>
    <h3 class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200">
      Covers
    </h3>
    <CoverOptionsFields bind:covers bind:bypassCoverCache />
  </section>
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      disabled={starting}
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={starting}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={handleStart}
    >
      {starting ? "Starting…" : run === "sync" ? "Sync" : "Refresh"}
    </button>
  {/snippet}
</Modal>
