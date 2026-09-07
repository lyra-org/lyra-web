<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import PaginatedList from "./PaginatedList.svelte";
  import { fetchReleases } from "./api";
  import AlbumCard from "./AlbumCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();
</script>

<PaginatedList
  scope={libraryId}
  label="albums"
  empty="No albums in this library."
  loadPage={(cursor, limit) => fetchReleases({ libraryId, cursor, limit })}
>
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
