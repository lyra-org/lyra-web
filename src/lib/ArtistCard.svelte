<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ArtistResponse } from "./types";
  import ArtistMenu from "./ArtistMenu.svelte";
  import CoverImage from "./CoverImage.svelte";
  import { shownCover } from "./covers.svelte.ts";

  interface Props {
    artist: ArtistResponse;
  }

  let { artist }: Props = $props();

  let menu = $state<ArtistMenu>();
  let cover = $derived(shownCover(artist.id, artist.cover));
</script>

<a
  href={artist.id != null ? `#/artists/${artist.id}` : undefined}
  class="group flex flex-col items-center"
  oncontextmenu={(e) => menu?.open(e)}
>
  <CoverImage
    {cover}
    alt="Photo of {artist.name}"
    class="aspect-square w-full rounded-full shadow-sm transition-shadow group-hover:shadow-md dark:shadow-black/30"
    imageClass="group-hover:scale-105"
    icon="person"
    iconClass="h-12 w-12"
    lazy
  />
  <div class="mt-2 w-full px-1 text-center">
    <h3
      class="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
      title={artist.name}
    >
      {artist.name}
    </h3>
  </div>
</a>

{#if artist.id != null}
  <ArtistMenu bind:this={menu} artistId={artist.id} artistName={artist.name} />
{/if}
