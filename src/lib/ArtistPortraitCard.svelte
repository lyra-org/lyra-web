<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { CoverResponse } from "./types";
  import ArtistMenu from "./ArtistMenu.svelte";
  import CoverImage from "./CoverImage.svelte";
  import { shownCover } from "./covers.svelte.ts";

  interface Props {
    id: string;
    name: string;
    cover?: CoverResponse | null;
    role?: string | null;
  }

  let { id, name, cover: loadedCover = null, role = null }: Props = $props();

  let menu = $state<ArtistMenu>();
  let cover = $derived(shownCover(id, loadedCover));
</script>

<a
  href={`#/artists/${id}`}
  class="group flex w-28 shrink-0 flex-col items-center"
  aria-label="Open {name}"
  oncontextmenu={(e) => menu?.open(e)}
>
  <CoverImage
    {cover}
    alt="Photo of {name}"
    class="aspect-square w-full rounded-full shadow-sm transition-shadow group-hover:shadow-md dark:shadow-black/30"
    imageClass="group-hover:scale-105"
    icon="person"
    iconClass="h-8 w-8"
    lazy
  />
  <p
    class="mt-2 w-full truncate text-center text-sm font-medium text-slate-900 group-hover:underline dark:text-neutral-100"
    title={name}
  >
    {name}
  </p>
  {#if role}
    <p
      class="mt-0.5 w-full truncate text-center text-xs text-slate-500 dark:text-neutral-400"
      title={role}
    >
      {role}
    </p>
  {/if}
</a>

<ArtistMenu bind:this={menu} artistId={id} artistName={name} />
