<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import AlbumMenu from "./AlbumMenu.svelte";
  import CoverImage from "./CoverImage.svelte";
  import { shownCover } from "./covers.svelte.ts";
  import OptionsButton from "./OptionsButton.svelte";
  import type { ReleaseResponse } from "./types";

  interface Props {
    album: ReleaseResponse;
  }

  let { album }: Props = $props();

  let cover = $derived(shownCover(album.id, album.cover));
  let artistNames = $derived(
    album.artists?.map((a) => a.name).join(", ") ?? "Unknown Artist",
  );
  let releaseYear = $derived(
    album.release_date ? album.release_date.slice(0, 4) : null,
  );

  let hasMenu = $derived(album.id != null);

  let menu = $state<AlbumMenu>();
</script>

<a
  href={album.id != null ? `#/albums/${album.id}` : undefined}
  class="block"
  oncontextmenu={(e) => menu?.open(e)}
>
  <article
    class="group relative cursor-pointer overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
  >
    <CoverImage
      {cover}
      alt="Cover for {album.title}"
      class="aspect-square w-full"
      imageClass="group-hover:scale-105"
      iconClass="h-12 w-12"
      lazy
    />

    {#if hasMenu}
      <OptionsButton
        variant="overlay"
        label="Album options"
        expanded={menu?.isOpen() ?? false}
        busy={menu?.isRefreshing() ?? false}
        onclick={(e) => menu?.toggle(e)}
      />
    {/if}

    <div class="p-3">
      <h3
        class="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
        title={album.title}
      >
        {album.title}
      </h3>
      <p
        class="truncate text-xs text-slate-500 dark:text-neutral-400"
        title={artistNames}
      >
        {artistNames}
      </p>
      {#if releaseYear}
        <p class="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
          {releaseYear}
        </p>
      {/if}
    </div>
  </article>
</a>

{#if hasMenu}
  <AlbumMenu bind:this={menu} {album} />
{/if}
