<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import { fetchGenres } from "./api";
  import SortControls from "./SortControls.svelte";
  import { savedSort } from "./sort.svelte.ts";
  import PaginatedList from "./PaginatedList.svelte";
  import GenreCard from "./GenreCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();

  const sort = savedSort(
    untrack(() => `library/${libraryId}/genres`),
    "genres",
  );
</script>

<PaginatedList
  scope={`${libraryId}/${sort.sortBy}/${sort.sortOrder}`}
  label="genres"
  empty="No genres in this library yet."
  loadPage={(cursor, limit) =>
    fetchGenres({
      libraryId,
      cursor,
      limit,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    })}
>
  {#snippet toolbar()}
    <SortControls
      kind="genres"
      bind:sortBy={sort.sortBy}
      bind:sortOrder={sort.sortOrder}
    />
  {/snippet}
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
