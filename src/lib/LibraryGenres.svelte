<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fetchGenres } from "./api";
  import PaginatedList from "./PaginatedList.svelte";
  import GenreCard from "./GenreCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();

  type SortMode = "name" | "recent";

  let sortMode = $state<SortMode>("name");
</script>

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

<PaginatedList
  scope={`${libraryId}/${sortMode}`}
  label="genres"
  empty="No genres in this library yet."
  loadPage={(cursor, limit) =>
    fetchGenres({
      libraryId,
      cursor,
      limit,
      sortBy: sortMode === "recent" ? "last_played_at" : "name",
      sortOrder: sortMode === "recent" ? "descending" : "ascending",
    })}
>
  {#snippet children(genres)}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {#each genres as genre (genre.id)}
        <GenreCard {genre} cover={genre.cover ?? null} />
      {/each}
    </div>
  {/snippet}
</PaginatedList>
