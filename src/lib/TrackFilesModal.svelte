<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { EntryResponse, TrackResponse } from "./types";
  import { fetchTrackEntries } from "./api";
  import Modal from "./Modal.svelte";

  interface Props {
    track: TrackResponse;
    onclose: () => void;
  }

  let { track, onclose }: Props = $props();

  let files = $state<EntryResponse[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let copiedId = $state<string | null>(null);

  async function load(id: string) {
    try {
      files = await fetchTrackEntries(id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load file info";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load(track.id);
  });

  async function copy(file: EntryResponse) {
    if (file.full_path == null) return;
    error = null;
    try {
      await navigator.clipboard.writeText(file.full_path);
      copiedId = file.id;
    } catch {
      copiedId = null;
      error = "Unable to copy. Select the path and copy it manually.";
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1000) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = -1;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit += 1;
    }
    return `${value.toFixed(1)} ${units[unit]}`;
  }

  function details(file: EntryResponse): string {
    const modified = new Date(file.modified_at).toLocaleDateString();
    return [
      ...(file.missing_at ? ["Missing"] : []),
      formatSize(file.size),
      `Modified ${modified}`,
    ].join(" · ");
  }
</script>

<Modal title="File info" subtitle={track.title} width="narrow" {onclose}>
  <div class="space-y-4 text-sm">
    {#if loading}
      <p class="text-slate-500 dark:text-neutral-400">Loading…</p>
    {:else}
      {#each files as file (file.id)}
        <div>
          <div class="flex items-start justify-between gap-3">
            <p
              class="min-w-0 font-mono wrap-anywhere text-slate-900 dark:text-neutral-100"
            >
              {file.full_path ?? file.name}
            </p>
            {#if file.full_path != null}
              <button
                type="button"
                class="shrink-0 text-xs text-slate-500 underline dark:text-neutral-400"
                onclick={() => copy(file)}
              >
                {copiedId === file.id ? "Copied" : "Copy"}
              </button>
            {/if}
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {details(file)}
          </p>
        </div>
      {:else}
        {#if !error}
          <p class="text-slate-500 dark:text-neutral-400">
            No files are available for this track.
          </p>
        {/if}
      {/each}
    {/if}
    {#if error}
      <p role="alert" class="text-red-600 dark:text-red-400">{error}</p>
    {/if}
  </div>
</Modal>
