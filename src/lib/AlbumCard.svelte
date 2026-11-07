<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  import type { ReleaseResponse } from "./types";
  let searchAlbum = $state<ReleaseResponse | null>(null);
  let optionsAlbum = $state<ReleaseResponse | null>(null);
  let editAlbum = $state<ReleaseResponse | null>(null);
  let chainsAlbum = $state<ReleaseResponse | null>(null);
  let coverAlbum = $state<ReleaseResponse | null>(null);
</script>

<script lang="ts">
  import { refreshEntity } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import CoverImage from "./CoverImage.svelte";
  import CoverManagerModal from "./CoverManagerModal.svelte";
  import { reloadShownCover, shownCover } from "./covers.svelte.ts";
  import ContextMenu, {
    anchorAtPointer,
    anchorBelow,
    menuItemClass,
    type MenuAnchor,
  } from "./ContextMenu.svelte";
  import MetadataEditModal from "./MetadataEditModal.svelte";
  import MetadataSearchModal from "./MetadataSearchModal.svelte";
  import RatingMenuItem from "./RatingMenuItem.svelte";
  import RefreshMenuItem from "./RefreshMenuItem.svelte";
  import RefreshOptionsModal from "./RefreshOptionsModal.svelte";
  import ReleaseChainsModal from "./ReleaseChainsModal.svelte";

  interface Props {
    album: ReleaseResponse;
  }

  let { album }: Props = $props();

  const auth = getAuth();

  let cover = $derived(shownCover(album.id, album.cover));
  let artistNames = $derived(
    album.artists?.map((a) => a.name).join(", ") ?? "Unknown Artist",
  );
  let releaseYear = $derived(
    album.release_date ? album.release_date.slice(0, 4) : null,
  );

  let canManage = $derived(auth.hasPermission("manage_metadata"));
  let canSync = $derived(auth.hasPermission("sync_metadata"));
  let hasMenu = $derived(album.id != null);

  let menuAnchor = $state<MenuAnchor | null>(null);
  let refreshing = $state(false);

  function toggleMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    menuAnchor = menuAnchor
      ? null
      : anchorBelow(e.currentTarget as HTMLElement);
  }

  function handleContextMenu(e: MouseEvent) {
    if (!hasMenu) return;
    e.preventDefault();
    menuAnchor = anchorAtPointer(e);
  }

  function openModal(open: () => void) {
    menuAnchor = null;
    open();
  }

  async function handleRefresh() {
    menuAnchor = null;
    if (album.id == null) return;
    refreshing = true;
    try {
      await refreshEntity(album.id);
    } catch {
      // A failed refresh leaves the album as it was; nothing to update.
      return;
    } finally {
      refreshing = false;
    }
    showRefreshedCover(album.id);
  }

  // The refresh returns once the server has refreshed the album and synced
  // its cover, so the cover it shows now is the refreshed one.
  function showRefreshedCover(id: string) {
    reloadShownCover("release", id).catch(() => {});
  }
</script>

<a
  href={album.id != null ? `#/albums/${album.id}` : undefined}
  class="block"
  oncontextmenu={handleContextMenu}
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
      <button
        type="button"
        class="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
        class:opacity-100={menuAnchor != null || refreshing}
        title="Album options"
        aria-label="Album options"
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

{#if menuAnchor}
  <ContextMenu anchor={menuAnchor} onclose={() => (menuAnchor = null)}>
    {#if album.id != null}
      <RatingMenuItem targetId={album.id} label={album.title} />
    {/if}
    {#if canSync || canManage}
      <div
        role="separator"
        class="my-1 h-px bg-slate-100 dark:bg-neutral-700"
      ></div>
    {/if}
    {#if canSync}
      <RefreshMenuItem
        onrefresh={handleRefresh}
        onoptions={() => openModal(() => (optionsAlbum = album))}
      />
    {/if}
    {#if canManage}
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => openModal(() => (searchAlbum = album))}
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
        Search metadata…
      </button>
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => openModal(() => (editAlbum = album))}
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
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        Edit metadata…
      </button>
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => openModal(() => (chainsAlbum = album))}
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
            d="M4 6h16M4 12h16M4 18h7m4 0l3 3m0 0l3-3m-3 3v-7"
          />
        </svg>
        Edit chains…
      </button>
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => openModal(() => (coverAlbum = album))}
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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Change cover…
      </button>
    {/if}
  </ContextMenu>
{/if}

{#if searchAlbum?.id === album.id}
  <MetadataSearchModal {album} onclose={() => (searchAlbum = null)} />
{/if}

{#if optionsAlbum?.id === album.id && album.id != null}
  <RefreshOptionsModal
    entityId={album.id}
    hasCover
    onclose={() => (optionsAlbum = null)}
    onrefreshed={() => album.id != null && showRefreshedCover(album.id)}
  />
{/if}

{#if editAlbum?.id === album.id && album.id != null}
  <MetadataEditModal entityId={album.id} onclose={() => (editAlbum = null)} />
{/if}

{#if chainsAlbum?.id === album.id && album.id != null}
  <ReleaseChainsModal
    releaseId={album.id}
    onclose={() => (chainsAlbum = null)}
  />
{/if}

{#if coverAlbum?.id === album.id && album.id != null}
  <CoverManagerModal
    kind="release"
    entityId={album.id}
    name={album.title}
    onclose={() => (coverAlbum = null)}
  />
{/if}
