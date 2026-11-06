<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { refreshEntity } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import { reloadShownCover } from "./covers.svelte.ts";
  import ContextMenu, {
    anchorAtPointer,
    menuItemClass,
    type MenuAnchor,
  } from "./ContextMenu.svelte";
  import CoverManagerModal from "./CoverManagerModal.svelte";
  import MetadataEditModal from "./MetadataEditModal.svelte";
  import RatingMenuItem from "./RatingMenuItem.svelte";
  import RefreshMenuItem from "./RefreshMenuItem.svelte";
  import RefreshOptionsModal from "./RefreshOptionsModal.svelte";

  interface Props {
    artistId: string;
    artistName: string;
  }

  let { artistId, artistName }: Props = $props();

  const auth = getAuth();

  let canManage = $derived(auth.hasPermission("manage_metadata"));
  let canSync = $derived(auth.hasPermission("sync_metadata"));

  let anchor = $state<MenuAnchor | null>(null);
  let showEdit = $state(false);
  let showOptions = $state(false);
  let showCovers = $state(false);

  // The card's contextmenu handler.
  export function open(e: MouseEvent) {
    e.preventDefault();
    anchor = anchorAtPointer(e);
  }

  // The refresh returns once the server has refreshed the artist and synced
  // its cover, so the cover it shows now is the refreshed one.
  function showRefreshedCover() {
    reloadShownCover("artist", artistId).catch(() => {});
  }

  async function handleRefresh() {
    anchor = null;
    try {
      await refreshEntity(artistId);
    } catch {
      // A failed refresh leaves the artist as it was; nothing to update.
      return;
    }
    showRefreshedCover();
  }
</script>

{#if anchor}
  <ContextMenu {anchor} onclose={() => (anchor = null)}>
    <RatingMenuItem targetId={artistId} label={artistName} />
    {#if canSync || canManage}
      <div
        role="separator"
        class="my-1 h-px bg-slate-100 dark:bg-neutral-700"
      ></div>
    {/if}
    {#if canSync}
      <RefreshMenuItem
        onrefresh={handleRefresh}
        onoptions={() => {
          anchor = null;
          showOptions = true;
        }}
      />
    {/if}
    {#if canManage}
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => {
          anchor = null;
          showEdit = true;
        }}
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
        onclick={() => {
          anchor = null;
          showCovers = true;
        }}
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

{#if showEdit}
  <MetadataEditModal entityId={artistId} onclose={() => (showEdit = false)} />
{/if}

{#if showOptions}
  <RefreshOptionsModal
    entityId={artistId}
    hasCover
    onclose={() => (showOptions = false)}
    onrefreshed={showRefreshedCover}
  />
{/if}

{#if showCovers}
  <CoverManagerModal
    kind="artist"
    entityId={artistId}
    name={artistName}
    onclose={() => (showCovers = false)}
  />
{/if}
