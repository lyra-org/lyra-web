<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fetchTracks } from "./api";
  import { playMixFromTracks } from "./mix.svelte.ts";
  import { mix } from "./mixOptions";
  import Modal from "./Modal.svelte";
  import SearchPicker from "./SearchPicker.svelte";
  import type { TrackResponse } from "./types";

  interface Props {
    from: TrackResponse;
    onclose: () => void;
  }

  let { from, onclose }: Props = $props();

  let to = $state<TrackResponse | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function search(query: string, signal: AbortSignal) {
    return (await fetchTracks({ query, limit: 8, signal })).items;
  }

  function artistNames(track: TrackResponse): string {
    return (track.artists ?? []).map((a) => a.name).join(", ");
  }

  async function play() {
    if (!to || loading) return;
    loading = true;
    error = null;
    try {
      const tracks = await mix({ seeds: [from.id, to.id], shape: "path" });
      if (tracks.length === 0) {
        error = "No path was found between these tracks.";
        return;
      }
      await playMixFromTracks(tracks, `${from.title} → ${to.title}`);
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "The path mix failed.";
    } finally {
      loading = false;
    }
  }
</script>

{#snippet trackLine(track: TrackResponse)}
  <span class="block truncate">{track.title}</span>
  <span class="block truncate text-xs text-slate-500 dark:text-neutral-400">
    {artistNames(track)}
  </span>
{/snippet}

<Modal
  title="Path mix"
  subtitle="Tracks leading from one to the other"
  width="narrow"
  {onclose}
>
  <div class="space-y-4 text-sm">
    <div>
      <div
        class="mb-1 text-xs font-medium text-slate-500 dark:text-neutral-400"
      >
        From
      </div>
      <div class="text-slate-900 dark:text-neutral-100">
        {@render trackLine(from)}
      </div>
    </div>
    <div>
      <div
        class="mb-1 text-xs font-medium text-slate-500 dark:text-neutral-400"
      >
        To
      </div>
      {#if to}
        <div
          class="flex items-start justify-between gap-3 text-slate-900 dark:text-neutral-100"
        >
          <div class="min-w-0">{@render trackLine(to)}</div>
          <button
            type="button"
            class="shrink-0 text-xs text-slate-500 underline dark:text-neutral-400"
            onclick={() => (to = null)}
          >
            Change
          </button>
        </div>
      {:else}
        <SearchPicker
          placeholder="Search for a track…"
          {search}
          exclude={[from.id]}
          onpick={(track) => (to = track)}
          row={trackLine}
        />
      {/if}
    </div>
    {#if error}
      <p role="alert" class="text-red-600 dark:text-red-400">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={!to || loading}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={play}
    >
      {loading ? "Finding a path…" : "Play path"}
    </button>
  {/snippet}
</Modal>
