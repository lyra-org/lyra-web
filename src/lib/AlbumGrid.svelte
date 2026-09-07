<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ReleaseResponse } from "./types";
  import { fetchReleases, fetchAllPages } from "./api";
  import AlbumCard from "./AlbumCard.svelte";

  let albums: ReleaseResponse[] = $state([]);
  let loading: boolean = $state(true);
  let error: string | null = $state(null);

  async function load() {
    try {
      albums = await fetchAllPages((cursor) => fetchReleases({ cursor }));
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load albums";
    } finally {
      loading = false;
    }
  }

  load();
</script>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <div
      class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
    ></div>
  </div>
{:else if error}
  <div class="py-20 text-center">
    <p class="text-sm text-red-500 dark:text-red-400">{error}</p>
  </div>
{:else if albums.length === 0}
  <div class="py-20 text-center">
    <p class="text-sm text-slate-500 dark:text-neutral-400">No albums found.</p>
  </div>
{:else}
  <div
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
  >
    {#each albums as album (album.id ?? album.title)}
      <AlbumCard {album} />
    {/each}
  </div>
{/if}
