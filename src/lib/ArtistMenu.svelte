<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import MenuItem, { coverIcon, editIcon } from "./MenuItem.svelte";
  import { refreshEntity } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import { reloadShownCover } from "./covers.svelte.ts";
  import ContextMenu, {
    anchorAtPointer,
    anchorBelow,
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
    // A refresh or edit changed what the artist shows.
    onchanged?: () => void;
  }

  let { artistId, artistName, onchanged }: Props = $props();

  const auth = getAuth();

  let canManage = $derived(auth.hasPermission("manage_metadata"));
  let canSync = $derived(auth.hasPermission("sync_metadata"));

  let anchor = $state<MenuAnchor | null>(null);
  let refreshing = $state(false);
  let showEdit = $state(false);
  let showOptions = $state(false);
  let showCovers = $state(false);

  // The card's contextmenu handler.
  export function open(e: MouseEvent) {
    e.preventDefault();
    anchor = anchorAtPointer(e);
  }

  export function toggle(e: MouseEvent) {
    anchor = anchor ? null : anchorBelow(e.currentTarget as Element);
  }

  export function isOpen(): boolean {
    return anchor != null;
  }

  export function isRefreshing(): boolean {
    return refreshing;
  }

  // The refresh returns once the server has refreshed the artist and synced
  // its cover, so the cover it shows now is the refreshed one.
  function showRefreshedCover() {
    reloadShownCover("artist", artistId).catch(() => {});
    onchanged?.();
  }

  async function handleRefresh() {
    anchor = null;
    refreshing = true;
    try {
      await refreshEntity(artistId);
    } catch {
      // A failed refresh leaves the artist as it was; nothing to update.
      return;
    } finally {
      refreshing = false;
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
      <MenuItem
        icon={editIcon}
        onclick={() => {
          anchor = null;
          showEdit = true;
        }}>Edit metadata</MenuItem
      >
      <MenuItem
        icon={coverIcon}
        onclick={() => {
          anchor = null;
          showCovers = true;
        }}>Change cover</MenuItem
      >
    {/if}
  </ContextMenu>
{/if}

{#if showEdit}
  <MetadataEditModal
    entityId={artistId}
    {onchanged}
    onclose={() => (showEdit = false)}
  />
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
