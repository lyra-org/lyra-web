<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fetchArtists } from "./api";
  import SearchPicker from "./SearchPicker.svelte";
  import type { ArtistResponse } from "./types";

  interface Props {
    placeholder?: string;
    // Artists already listed, left out of the results.
    exclude?: string[];
    onpick: (artist: ArtistResponse) => void;
  }

  let { placeholder = "Add an artist…", exclude, onpick }: Props = $props();

  async function search(query: string, signal: AbortSignal) {
    return (await fetchArtists({ query, limit: 8, signal })).items;
  }
</script>

<SearchPicker {placeholder} {search} {exclude} {onpick}>
  {#snippet row(artist)}
    {artist.name}
  {/snippet}
</SearchPicker>
