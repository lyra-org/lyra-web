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
  import { fetchArtists } from "./api";
  import ArtistCard from "./ArtistCard.svelte";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();
  const sort = savedSort(
    untrack(() => `library/${libraryId}/artists`),
    "artists",
  );
</script>

<PaginatedList
  scope={`${libraryId}/${sort.sortBy}/${sort.sortOrder}`}
  label="artists"
  empty="No artists in this library."
  loadPage={(cursor, limit) =>
    fetchArtists({
      libraryId,
      cursor,
      limit,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    })}
>
  {#snippet toolbar()}
    <SortControls
      kind="artists"
      bind:sortBy={sort.sortBy}
      bind:sortOrder={sort.sortOrder}
    />
  {/snippet}
  {#snippet children(artists)}
    <div
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {#each artists as artist (artist.id ?? artist.name)}
        <ArtistCard {artist} />
      {/each}
    </div>
  {/snippet}
</PaginatedList>
