<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import SortControls from "./SortControls.svelte";
  import PaginatedList from "./PaginatedList.svelte";
  import { fetchReleases } from "./api";
  import AlbumCard from "./AlbumCard.svelte";
  let sortBy = $state("name");
  let sortOrder = $state<"ascending" | "descending">("ascending");
</script>

<PaginatedList
  scope={`${sortBy}/${sortOrder}`}
  label="albums"
  empty="No albums found."
  loadPage={(cursor, limit) =>
    fetchReleases({ cursor, limit, sortBy, sortOrder })}
>
  {#snippet toolbar()}
    <SortControls kind="albums" bind:sortBy bind:sortOrder />
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
