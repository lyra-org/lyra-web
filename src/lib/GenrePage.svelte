<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { GenreResponse } from "./types";
  import { fetchGenre, fetchReleases } from "./api";
  import { genreGradient, genreCoverObjectPosition } from "./genreStyle";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import PaginatedList from "./PaginatedList.svelte";
  import AlbumCard from "./AlbumCard.svelte";

  interface Props {
    genreId: string;
    libraryId?: string | null;
  }

  let { genreId, libraryId = null }: Props = $props();

  let genre = $state<GenreResponse | null>(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  let heroGradient = $derived(
    genre ? genreGradient(genre.id ?? genre.name) : "",
  );

  let coverPosition = $derived(
    genre ? genreCoverObjectPosition(genre.id ?? genre.name) : "object-center",
  );

  $effect(() => {
    const id = genreId;
    let cancelled = false;
    loading = true;
    error = null;
    genre = null;
    fetchGenre(id, { inc: ["parents", "children", "covers"] })
      .then((result) => {
        if (!cancelled) genre = result;
      })
      .catch((e) => {
        if (!cancelled)
          error = e instanceof Error ? e.message : "Failed to load genre";
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <div
      class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
    ></div>
  </div>
{:else if error}
  <div class="py-20 text-center">
    <p class="text-sm text-red-500 dark:text-red-400">{error}</p>
    <a
      href={libraryId ? `#/libraries/${libraryId}/genres` : "#/"}
      class="mt-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >&larr; Back</a
    >
  </div>
{:else if genre}
  <div class="mx-auto max-w-5xl">
    <div class="flex flex-col gap-6 sm:flex-row sm:items-end">
      <div class="w-48 shrink-0 sm:w-56">
        {#if genre.cover?.blurhash}
          <div
            class="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-200 shadow-md dark:bg-neutral-600 dark:shadow-black/40"
          >
            <BlurhashCanvas
              hash={genre.cover.blurhash}
              class="absolute inset-0 h-full w-full object-cover {coverPosition}"
            />
          </div>
        {:else}
          <div
            class="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br shadow-md {heroGradient} dark:shadow-black/40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-16 w-16 text-slate-400/50 dark:text-neutral-500/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        {/if}
      </div>
      <div class="flex flex-col">
        <h2 class="text-3xl font-bold text-slate-900 dark:text-neutral-100">
          {genre.name}
        </h2>
      </div>
    </div>

    {#if (genre.parents?.length ?? 0) > 0 || (genre.children?.length ?? 0) > 0}
      <div class="mt-8">
        {#if (genre.parents?.length ?? 0) > 0}
          <h3
            class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
          >
            Parent genres
          </h3>
          <div class="mb-4 flex flex-wrap gap-2">
            {#each genre.parents ?? [] as parent (parent.id)}
              <a
                href="#/genres/{parent.id}"
                class="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 transition-colors hover:border-[#BB7FB5] hover:bg-[#E6CEE3]/20 dark:border-neutral-600 dark:text-neutral-200 dark:hover:border-[#BB7FB5] dark:hover:bg-[#BB7FB5]/15"
              >
                {parent.name}
              </a>
            {/each}
          </div>
        {/if}
        {#if (genre.children?.length ?? 0) > 0}
          <h3
            class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
          >
            Subgenres
          </h3>
          <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {#each genre.children ?? [] as child (child.id)}
              <a
                href="#/genres/{child.id}"
                class="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 transition-colors hover:border-[#BB7FB5] hover:bg-[#E6CEE3]/20 dark:border-neutral-600 dark:text-neutral-200 dark:hover:border-[#BB7FB5] dark:hover:bg-[#BB7FB5]/15"
              >
                {child.name}
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="mt-8">
      <h3
        class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
      >
        Albums
      </h3>
      <PaginatedList
        scope={`${genreId}/${libraryId ?? ""}`}
        label="albums"
        empty="No albums tagged with this genre."
        loadPage={(cursor, limit) =>
          fetchReleases({
            genreId,
            libraryId: libraryId ?? undefined,
            cursor,
            limit,
            sortBy: "release_date",
            sortOrder: "descending",
          })}
      >
        {#snippet children(albums)}
          <div
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {#each albums as album (album.id)}
              <AlbumCard {album} />
            {/each}
          </div>
        {/snippet}
      </PaginatedList>
    </div>
  </div>
{/if}
