<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { TrackResponse } from "./types";
  import { fetchTracks, remapTrack } from "./api";
  import { getPlayer } from "./player.svelte.ts";
  import Modal from "./Modal.svelte";
  import SearchPicker from "./SearchPicker.svelte";

  interface Props {
    track: TrackResponse;
    onremapped: () => void;
    onclose: () => void;
  }

  let { track, onremapped, onclose }: Props = $props();

  const player = getPlayer();

  let target = $state<TrackResponse | null>(null);
  let saving = $state(false);
  let error = $state<string | null>(null);

  function artistNames(t: TrackResponse): string {
    return t.artists?.map((a) => a.name).join(", ") ?? "Unknown Artist";
  }

  async function search(query: string, signal: AbortSignal) {
    const page = await fetchTracks({
      query,
      signal,
      limit: 10,
      filter: { available: true },
    });
    return page.items;
  }

  async function handleRemap() {
    if (!target || saving) return;
    saving = true;
    error = null;
    try {
      const remapped = await remapTrack(track.id, target.id);
      player.trackRemapped(remapped, target.id);
      onremapped();
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remap the track";
    } finally {
      saving = false;
    }
  }
</script>

{#snippet trackLine(t: TrackResponse)}
  <span class="block truncate">{t.title}</span>
  <span class="block truncate text-xs text-slate-500 dark:text-neutral-400">
    {artistNames(t)}{t.releases?.[0] ? ` · ${t.releases[0].title}` : ""}
  </span>
{/snippet}

<Modal
  title="Remap missing track"
  subtitle="Point it at the track its file became"
  width="narrow"
  onclose={() => {
    if (!saving) onclose();
  }}
>
  <div class="space-y-4 text-sm">
    <div>
      <div
        class="mb-1 text-xs font-medium text-slate-500 dark:text-neutral-400"
      >
        Missing track
      </div>
      <div class="text-slate-900 dark:text-neutral-100">
        {@render trackLine(track)}
      </div>
    </div>
    <div>
      <div
        class="mb-1 text-xs font-medium text-slate-500 dark:text-neutral-400"
      >
        Now the file of
      </div>
      {#if target}
        <div
          class="flex items-start justify-between gap-3 text-slate-900 dark:text-neutral-100"
        >
          <div class="min-w-0">{@render trackLine(target)}</div>
          <button
            type="button"
            disabled={saving}
            class="shrink-0 text-xs text-slate-500 underline dark:text-neutral-400"
            onclick={() => (target = null)}
          >
            Change
          </button>
        </div>
      {:else}
        <SearchPicker
          placeholder="Search for a playable track…"
          {search}
          onpick={(picked) => (target = picked)}
          row={trackLine}
        />
      {/if}
    </div>
    {#if target}
      <p class="text-slate-600 dark:text-neutral-300">
        “{track.title}” takes over this file and its place on the album, keeping
        its favorites, ratings, listens and playlists. “{target.title}” is
        removed, and what it holds moves across. This cannot be undone.
      </p>
    {/if}
    {#if error}
      <p role="alert" class="text-red-600 dark:text-red-400">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      disabled={saving}
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={!target || saving}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={handleRemap}
    >
      {saving ? "Remapping…" : "Remap"}
    </button>
  {/snippet}
</Modal>
