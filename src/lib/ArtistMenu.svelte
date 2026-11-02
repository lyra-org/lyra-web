<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { refreshEntity } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import ContextMenu, {
    anchorAtPointer,
    menuItemClass,
    type MenuAnchor,
  } from "./ContextMenu.svelte";
  import ExternalIdsModal from "./ExternalIdsModal.svelte";
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
  let showIds = $state(false);
  let showEdit = $state(false);
  let showOptions = $state(false);

  // The card's contextmenu handler.
  export function open(e: MouseEvent) {
    e.preventDefault();
    anchor = anchorAtPointer(e);
  }

  function handleExternalIds() {
    anchor = null;
    showIds = true;
  }

  async function handleRefresh() {
    anchor = null;
    try {
      await refreshEntity(artistId);
    } catch {
      // The artist page shows the refreshed metadata; nothing to report here.
    }
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
        onclick={handleExternalIds}
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
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        External IDs…
      </button>
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
    {/if}
  </ContextMenu>
{/if}

{#if showIds}
  <ExternalIdsModal
    entityId={artistId}
    noun="artist"
    onclose={() => (showIds = false)}
  />
{/if}

{#if showEdit}
  <MetadataEditModal entityId={artistId} onclose={() => (showEdit = false)} />
{/if}

{#if showOptions}
  <RefreshOptionsModal
    entityId={artistId}
    hasCover
    onclose={() => (showOptions = false)}
  />
{/if}
