<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PlaylistResponse, TagColor, TrackResponse } from "./types";
  import type { PlaybackContext } from "./player.svelte.ts";
  import { addPlaylistTracks, fetchPlaylists, fetchAllPages } from "./api";
  import { getPlayer, isMissing } from "./player.svelte.ts";
  import { getAuth } from "./auth.svelte.ts";
  import { mixSupport } from "./mixOptions";
  import { menuItemClass } from "./ContextMenu.svelte";
  import RatingMenuItem from "./RatingMenuItem.svelte";
  import RefreshMenuItem from "./RefreshMenuItem.svelte";
  import { TAG_COLORS, getTags, tagSwatchClass } from "./tags.svelte.ts";

  interface Props {
    track: TrackResponse;
    context: PlaybackContext;
    onclose: () => void;
    onexternalids: () => void;
    onedit: () => void;
    onrefresh: () => void;
    onrefreshoptions: () => void;
    onpath: () => void;
    onremap: () => void;
    // Absent outside a library, which a purge needs.
    onpurge?: () => void;
  }

  let {
    track,
    context,
    onclose,
    onexternalids,
    onedit,
    onrefresh,
    onrefreshoptions,
    onpath,
    onremap,
    onpurge,
  }: Props = $props();

  let trackId = $derived(track.id);
  let canManage = $derived(getAuth().hasPermission("manage_metadata"));
  let canSync = $derived(getAuth().hasPermission("sync_metadata"));
  let missing = $derived(isMissing(track));
  let canFixMissing = $derived(
    missing && getAuth().hasPermission("manage_libraries"),
  );

  const player = getPlayer();
  const tagsStore = getTags();

  type View = "main" | "playlists" | "tags";

  let view = $state<View>("main");

  let playlists = $state<PlaylistResponse[]>([]);
  let playlistsLoaded = $state(false);
  let adding = $state<string | null>(null);
  let added = $state<string | null>(null);

  let pathSupported = $state(false);
  mixSupport().then(
    (support) => (pathSupported = support.path),
    () => {},
  );

  let newTagName = $state("");
  let newTagColor = $state<TagColor>("blue");
  let savingTag = $state(false);

  async function loadPlaylists() {
    if (playlistsLoaded) return;
    try {
      const ownerId = getAuth().me?.id;
      playlists = await fetchAllPages((cursor) =>
        fetchPlaylists({ cursor, ownerId }),
      );
    } catch {
      // ignore
    } finally {
      playlistsLoaded = true;
    }
  }

  async function loadTags() {
    if (!tagsStore.loaded) {
      await tagsStore.load();
    }
  }

  function openPlaylists() {
    view = "playlists";
    loadPlaylists();
  }

  function openTags() {
    view = "tags";
    loadTags();
  }

  function handleAddToQueue() {
    player.addToQueue(track, context);
    onclose();
  }

  async function handleAddToPlaylist(playlistId: string) {
    if (adding != null) return;
    adding = playlistId;
    try {
      await addPlaylistTracks(playlistId, [trackId]);
      added = playlistId;
      setTimeout(onclose, 500);
    } catch {
      adding = null;
    }
  }

  async function handleToggleTag(tagId: string) {
    if (savingTag) return;
    savingTag = true;
    try {
      if (tagsStore.isAttached(tagId, trackId)) {
        await tagsStore.detach(tagId, trackId);
      } else {
        const tag = tagsStore.tags.find((t) => t.id === tagId);
        if (!tag) return;
        await tagsStore.attach(tag.tag, tag.color as TagColor, trackId);
      }
    } catch {
      // ignore
    } finally {
      savingTag = false;
    }
  }

  async function handleCreateTag(e: SubmitEvent) {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name || savingTag) return;
    savingTag = true;
    try {
      await tagsStore.attach(name, newTagColor, trackId);
      newTagName = "";
    } catch {
      // ignore
    } finally {
      savingTag = false;
    }
  }
</script>

{#if view === "main"}
  <button
    type="button"
    disabled={missing}
    title={missing ? "This track's file is missing" : undefined}
    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-200 dark:hover:bg-neutral-600 dark:disabled:hover:bg-transparent"
    onclick={handleAddToQueue}
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
        d="M4 6h11M4 12h11M4 18h7M17 16v6M14 19h6"
      />
    </svg>
    Add to queue
  </button>
  {#if pathSupported && !missing}
    <button type="button" class={menuItemClass} onclick={onpath}>
      <svg
        class="h-4 w-4 text-slate-400 dark:text-neutral-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"
        />
      </svg>
      Path to…
    </button>
  {/if}
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-600"
    onclick={openPlaylists}
  >
    <span class="flex items-center gap-2">
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
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
      Add to playlist
    </span>
    <svg
      class="h-3 w-3 text-slate-400 dark:text-neutral-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </button>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-600"
    onclick={openTags}
  >
    <span class="flex items-center gap-2">
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
          d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
      Tags
    </span>
    <svg
      class="h-3 w-3 text-slate-400 dark:text-neutral-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </button>
  <RatingMenuItem targetId={trackId} label={track.title} />
  {#if canSync || canManage || canFixMissing}
    <div
      role="separator"
      class="my-1 h-px bg-slate-100 dark:bg-neutral-700"
    ></div>
  {/if}
  {#if canSync}
    <RefreshMenuItem {onrefresh} onoptions={onrefreshoptions} />
  {/if}
  {#if canManage}
    <button type="button" class={menuItemClass} onclick={onexternalids}>
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
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      External IDs…
    </button>
    <button type="button" class={menuItemClass} onclick={onedit}>
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
  {/if}
  {#if canFixMissing}
    <button type="button" class={menuItemClass} onclick={onremap}>
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
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
      Remap…
    </button>
    {#if onpurge}
      <button type="button" class={menuItemClass} onclick={onpurge}>
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
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
          />
        </svg>
        Purge…
      </button>
    {/if}
  {/if}
{:else if view === "playlists"}
  <button
    type="button"
    class="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-600"
    onclick={() => (view = "main")}
  >
    <svg
      class="h-3 w-3"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
    Add to playlist
  </button>
  <div class="my-1 h-px bg-slate-100 dark:bg-neutral-700"></div>
  {#if !playlistsLoaded}
    <div class="px-3 py-2 text-xs text-slate-400 dark:text-neutral-500">
      Loading...
    </div>
  {:else if playlists.length === 0}
    <div class="px-3 py-2 text-xs text-slate-400 dark:text-neutral-500">
      No playlists yet
    </div>
  {:else}
    <div class="max-h-56 overflow-y-auto">
      {#each playlists as pl}
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-600"
          onclick={() => pl.id != null && handleAddToPlaylist(pl.id)}
          disabled={adding != null}
        >
          {#if added === pl.id}
            <svg
              class="h-4 w-4 text-green-500 dark:text-green-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          {:else}
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
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          {/if}
          {pl.name}
        </button>
      {/each}
    </div>
  {/if}
{:else if view === "tags"}
  <button
    type="button"
    class="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-600"
    onclick={() => (view = "main")}
  >
    <svg
      class="h-3 w-3"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
    Tags
  </button>
  <div class="my-1 h-px bg-slate-100 dark:bg-neutral-700"></div>
  {#if !tagsStore.loaded && tagsStore.loading}
    <div class="px-3 py-2 text-xs text-slate-400 dark:text-neutral-500">
      Loading...
    </div>
  {:else if tagsStore.tags.length > 0}
    <div class="max-h-40 overflow-y-auto">
      {#each tagsStore.tags as tag}
        {@const attached = tagsStore.isAttached(tag.id, trackId)}
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-600"
          onclick={() => handleToggleTag(tag.id)}
          disabled={savingTag}
        >
          <span class="flex items-center gap-2">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full {tagSwatchClass(
                tag.color,
              )}"
            ></span>
            {tag.tag}
          </span>
          {#if attached}
            <svg
              class="h-4 w-4 text-green-500 dark:text-green-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
    <div class="my-1 h-px bg-slate-100 dark:bg-neutral-700"></div>
  {/if}
  <form class="px-3 py-2" onsubmit={handleCreateTag}>
    <div class="text-xs font-medium text-slate-500 dark:text-neutral-400">
      New tag
    </div>
    <input
      type="text"
      bind:value={newTagName}
      placeholder="Tag name..."
      maxlength="128"
      class="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm focus:border-slate-400 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
    />
    <div class="mt-2 flex flex-wrap gap-1">
      {#each TAG_COLORS as color}
        <button
          type="button"
          class="h-5 w-5 rounded-full {tagSwatchClass(
            color,
          )} ring-offset-1 dark:ring-offset-[#1b1d1e]"
          class:ring-2={newTagColor === color}
          class:ring-slate-500={newTagColor === color}
          class:dark:ring-neutral-300={newTagColor === color}
          aria-label={color}
          title={color}
          onclick={() => (newTagColor = color)}
        ></button>
      {/each}
    </div>
    <button
      type="submit"
      disabled={!newTagName.trim() || savingTag}
      class="mt-2 w-full rounded bg-[#E6CEE3] px-2 py-1 text-xs font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
    >
      {savingTag ? "Saving..." : "Create & attach"}
    </button>
  </form>
{/if}
