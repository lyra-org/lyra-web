<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { CoverResponse, GenreResponse } from "./types";
  import { fetchGenres, fetchReleases, fetchAllPages } from "./api";
  import { pickGenreHeroAlbum } from "./genreStyle";
  import GenreCard from "./GenreCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();

  type SortMode = "name" | "recent";

  let genres: GenreResponse[] = $state([]);
  let heroCovers = $state<Record<string, CoverResponse | null>>({});
  let loading = $state(true);
  let error: string | null = $state(null);
  let sortMode = $state<SortMode>("name");

  async function loadHeroCovers(id: string, genreList: GenreResponse[]) {
    const entries = await Promise.all(
      genreList.map(async (genre) => {
        const page = await fetchReleases({
          libraryId: id,
          genreId: genre.id,
          limit: 100,
        });
        const hero = pickGenreHeroAlbum(page.items, genre.id);
        return [genre.id, hero?.cover ?? null] as const;
      }),
    );
    heroCovers = Object.fromEntries(entries);
  }

  async function load(id: string, sort: SortMode) {
    loading = true;
    error = null;
    heroCovers = {};
    try {
      const genreList = await fetchAllPages((cursor) =>
        fetchGenres({
          cursor,
          libraryId: id,
          sortBy: sort === "recent" ? "last_played_at" : "name",
          sortOrder: sort === "recent" ? "descending" : "ascending",
        }),
      );
      genres = genreList;
      await loadHeroCovers(id, genreList);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load genres";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load(libraryId, sortMode);
  });
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
{:else}
  <div class="mb-4 flex items-center justify-end">
    <div
      class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]"
    >
      <button
        type="button"
        class="rounded px-3 py-1 font-medium transition-colors"
        class:bg-[#E6CEE3]={sortMode === "name"}
        class:text-slate-900={sortMode === "name"}
        class:dark:bg-[#BB7FB5]={sortMode === "name"}
        class:dark:text-white={sortMode === "name"}
        class:text-slate-600={sortMode !== "name"}
        class:hover:bg-[#E6CEE3]={sortMode !== "name"}
        class:dark:text-neutral-400={sortMode !== "name"}
        class:dark:hover:bg-[#BB7FB5]={sortMode !== "name"}
        class:dark:hover:text-white={sortMode !== "name"}
        onclick={() => (sortMode = "name")}
      >
        A–Z
      </button>
      <button
        type="button"
        class="rounded px-3 py-1 font-medium transition-colors"
        class:bg-[#E6CEE3]={sortMode === "recent"}
        class:text-slate-900={sortMode === "recent"}
        class:dark:bg-[#BB7FB5]={sortMode === "recent"}
        class:dark:text-white={sortMode === "recent"}
        class:text-slate-600={sortMode !== "recent"}
        class:hover:bg-[#E6CEE3]={sortMode !== "recent"}
        class:dark:text-neutral-400={sortMode !== "recent"}
        class:dark:hover:bg-[#BB7FB5]={sortMode !== "recent"}
        class:dark:hover:text-white={sortMode !== "recent"}
        onclick={() => (sortMode = "recent")}
      >
        Recently played
      </button>
    </div>
  </div>

  {#if genres.length === 0}
    <div class="py-20 text-center">
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        No genres in this library yet.
      </p>
      <p class="mt-1 text-xs text-slate-400 dark:text-neutral-500">
        Genres appear when album metadata is tagged.
      </p>
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {#each genres as genre (genre.id)}
        <GenreCard {genre} cover={heroCovers[genre.id] ?? null} />
      {/each}
    </div>
  {/if}
{/if}
