<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ArtistResponse } from "./types";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  interface Props {
    artist: ArtistResponse;
  }

  let { artist }: Props = $props();

  let coverFailed = $state(false);
  let coverSrc = $derived(
    artist.cover && !coverFailed ? artist.cover.url : null,
  );
</script>

<a
  href={artist.id != null ? `#/artists/${artist.id}` : undefined}
  class="group flex flex-col items-center"
>
  <div
    class="relative aspect-square w-full overflow-hidden rounded-full bg-slate-200 shadow-sm transition-shadow group-hover:shadow-md dark:bg-neutral-600 dark:shadow-black/30"
  >
    {#if artist.cover?.blurhash}
      <BlurhashCanvas
        hash={artist.cover.blurhash}
        class="absolute inset-0 h-full w-full object-cover"
      />
    {/if}
    {#if coverSrc}
      <img
        src={coverSrc}
        alt="Photo of {artist.name}"
        class="relative h-full w-full object-cover transition-transform group-hover:scale-105"
        loading="lazy"
        onerror={() => (coverFailed = true)}
      />
    {:else if !artist.cover?.blurhash}
      <div
        class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
    {/if}
  </div>
  <div class="mt-2 w-full px-1 text-center">
    <h3
      class="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
      title={artist.name}
    >
      {artist.name}
      {#if artist.verified}
        <span class="text-blue-500 dark:text-blue-400" title="Verified">✓</span>
      {/if}
    </h3>
  </div>
</a>
