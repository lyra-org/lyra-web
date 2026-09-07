<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  import type { ReleaseResponse } from "./types";
  let openMenuId = $state<string | null>(null);
  let searchAlbum = $state<ReleaseResponse | null>(null);
</script>

<script lang="ts">
  import { refreshEntity } from "./api";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import MetadataSearchModal from "./MetadataSearchModal.svelte";

  interface Props {
    album: ReleaseResponse;
  }

  let { album }: Props = $props();

  let coverFailed = $state(false);
  let coverSrc = $derived(album.cover && !coverFailed ? album.cover.url : null);
  let artistNames = $derived(
    album.artists?.map((a) => a.name).join(", ") ?? "Unknown Artist",
  );
  let releaseYear = $derived(
    album.release_date ? album.release_date.slice(0, 4) : null,
  );

  let menuOpen = $derived(openMenuId === album.id);
  let refreshing = $state(false);

  function toggleMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = menuOpen ? null : album.id;
  }

  function handleWindowClick() {
    if (openMenuId != null) openMenuId = null;
  }

  function handleSearchMetadata(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    searchAlbum = album;
  }

  async function handleRefresh(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    if (album.id == null) return;
    refreshing = true;
    try {
      await refreshEntity(album.id);
    } catch {
      // refresh failed — spinner stops regardless
    } finally {
      refreshing = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<a href={album.id != null ? `#/albums/${album.id}` : undefined} class="block">
  <article
    class="group relative cursor-pointer overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
  >
    <div
      class="relative aspect-square w-full overflow-hidden bg-slate-200 dark:bg-neutral-600"
    >
      {#if album.cover?.blurhash}
        <BlurhashCanvas
          hash={album.cover.blurhash}
          class="absolute inset-0 h-full w-full object-cover"
        />
      {/if}
      {#if coverSrc}
        <img
          src={coverSrc}
          alt="Cover for {album.title}"
          class="relative h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
          onerror={() => (coverFailed = true)}
        />
      {:else if !album.cover?.blurhash}
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
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
      {/if}
    </div>

    <!-- Three-dot menu button -->
    <button
      type="button"
      class="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
      class:opacity-100={menuOpen || refreshing}
      onclick={toggleMenu}
    >
      {#if refreshing}
        <svg
          class="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
      {:else}
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      {/if}
    </button>

    <!-- Dropdown menu -->
    {#if menuOpen}
      <div
        role="menu"
        tabindex="-1"
        class="absolute top-10 right-1.5 z-10 min-w-40 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-600"
          onclick={handleSearchMetadata}
        >
          <svg
            class="h-4 w-4 text-slate-400 dark:text-neutral-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          Search metadata
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-600"
          onclick={handleRefresh}
        >
          <svg
            class="h-4 w-4 text-slate-400 dark:text-neutral-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0113.292-4.708M20 15a8 8 0 01-13.292 4.708"
            />
          </svg>
          Refresh metadata
        </button>
      </div>
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

{#if searchAlbum?.id === album.id}
  <MetadataSearchModal {album} onclose={() => (searchAlbum = null)} />
{/if}
