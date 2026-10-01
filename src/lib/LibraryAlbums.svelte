<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import SortControls from "./SortControls.svelte";
  import { savedSort } from "./sort.svelte.ts";
  import PaginatedList from "./PaginatedList.svelte";
  import { fetchReleases } from "./api";
  import AlbumCard from "./AlbumCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();
  const sort = savedSort(
    untrack(() => `library/${libraryId}/albums`),
    "albums",
  );
</script>

<PaginatedList
  scope={`${libraryId}/${sort.sortBy}/${sort.sortOrder}`}
  label="albums"
  empty="No albums in this library."
  loadPage={(cursor, limit) =>
    fetchReleases({
      libraryId,
      cursor,
      limit,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    })}
>
  {#snippet toolbar()}
    <SortControls
      kind="albums"
      bind:sortBy={sort.sortBy}
      bind:sortOrder={sort.sortOrder}
    />
  {/snippet}
  {#snippet children(albums)}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {#each albums as album (album.id ?? album.title)}
        <AlbumCard {album} />
      {/each}
    </div>
  {/snippet}
</PaginatedList>
