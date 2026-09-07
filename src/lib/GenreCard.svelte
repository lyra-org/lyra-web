<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { CoverResponse, GenreSummary } from "./types";
  import { genreCoverObjectPosition, genreGradient } from "./genreStyle";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  interface Props {
    genre: GenreSummary;
    cover?: CoverResponse | null;
  }

  let { genre, cover = null }: Props = $props();

  let gradient = $derived(genreGradient(genre.id ?? genre.name));
  let coverPosition = $derived(
    genreCoverObjectPosition(genre.id ?? genre.name),
  );
</script>

<a href="#/genres/{genre.id}" class="group block">
  <div
    class="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-200 shadow-sm transition-all group-hover:scale-[1.01] group-hover:shadow-md dark:bg-neutral-600 dark:shadow-black/30"
  >
    {#if cover?.blurhash}
      <BlurhashCanvas
        hash={cover.blurhash}
        class="absolute inset-0 h-full w-full object-cover {coverPosition}"
      />
      <div class="pointer-events-none absolute inset-0 bg-black/25"></div>
    {:else}
      <div class="absolute inset-0 bg-gradient-to-br {gradient}"></div>
    {/if}
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center p-3"
    >
      <h3
        class="line-clamp-3 text-center text-lg leading-tight font-bold sm:text-xl"
        class:text-white={!!cover?.blurhash}
        class:drop-shadow-sm={!!cover?.blurhash}
        class:text-slate-800={!cover?.blurhash}
        class:dark:text-neutral-100={!cover?.blurhash}
        title={genre.name}
      >
        {genre.name}
      </h3>
    </div>
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-black/25"
    ></div>
  </div>
</a>
