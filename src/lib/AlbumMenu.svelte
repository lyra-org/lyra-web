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
  import MetadataSearchModal from "./MetadataSearchModal.svelte";
  import RatingMenuItem from "./RatingMenuItem.svelte";
  import RefreshMenuItem from "./RefreshMenuItem.svelte";
  import RefreshOptionsModal from "./RefreshOptionsModal.svelte";
  import ReleaseChainsModal from "./ReleaseChainsModal.svelte";
  import type { ReleaseResponse } from "./types";

  interface Props {
    album: ReleaseResponse;
    // A refresh or edit changed what the album shows.
    onchanged?: () => void;
  }

  let { album, onchanged }: Props = $props();

  const auth = getAuth();

  let canManage = $derived(auth.hasPermission("manage_metadata"));
  let canSync = $derived(auth.hasPermission("sync_metadata"));

  let anchor = $state<MenuAnchor | null>(null);
  let refreshing = $state(false);
  let showSearch = $state(false);
  let showOptions = $state(false);
  let showEdit = $state(false);
  let showChains = $state(false);
  let showCovers = $state(false);

  export function open(e: MouseEvent) {
    e.preventDefault();
    anchor = anchorAtPointer(e);
  }

  export function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    anchor = anchor ? null : anchorBelow(e.currentTarget as Element);
  }

  export function isOpen(): boolean {
    return anchor != null;
  }

  export function isRefreshing(): boolean {
    return refreshing;
  }

  function openModal(show: () => void) {
    anchor = null;
    show();
  }

  // The refresh returns once the server has refreshed the album and synced
  // its cover, so the cover it shows now is the refreshed one.
  function showRefreshed(id: string) {
    reloadShownCover("release", id).catch(() => {});
    onchanged?.();
  }

  async function handleRefresh() {
    anchor = null;
    const id = album.id;
    refreshing = true;
    try {
      await refreshEntity(id);
    } catch {
      // A failed refresh leaves the album as it was; nothing to update.
      return;
    } finally {
      refreshing = false;
    }
    showRefreshed(id);
  }
</script>

{#if anchor}
  <ContextMenu {anchor} onclose={() => (anchor = null)}>
    <RatingMenuItem targetId={album.id} label={album.title} />
    {#if canSync || canManage}
      <div
        role="separator"
        class="my-1 h-px bg-slate-100 dark:bg-neutral-700"
      ></div>
    {/if}
    {#if canSync}
      <RefreshMenuItem
        onrefresh={handleRefresh}
        onoptions={() => openModal(() => (showOptions = true))}
      />
    {/if}
    {#if canManage}
      <MenuItem
        icon="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        onclick={() => openModal(() => (showSearch = true))}
        >Search metadata</MenuItem
      >
      <MenuItem
        icon={editIcon}
        onclick={() => openModal(() => (showEdit = true))}
        >Edit metadata</MenuItem
      >
      <MenuItem
        icon="M4 6h16M4 12h16M4 18h7m4 0l3 3m0 0l3-3m-3 3v-7"
        onclick={() => openModal(() => (showChains = true))}
        >Edit chains</MenuItem
      >
      <MenuItem
        icon={coverIcon}
        onclick={() => openModal(() => (showCovers = true))}
        >Change cover</MenuItem
      >
    {/if}
  </ContextMenu>
{/if}

{#if showSearch}
  <MetadataSearchModal
    {album}
    {onchanged}
    onclose={() => (showSearch = false)}
  />
{/if}

{#if showOptions}
  <RefreshOptionsModal
    entityId={album.id}
    hasCover
    onclose={() => (showOptions = false)}
    onrefreshed={() => showRefreshed(album.id)}
  />
{/if}

{#if showEdit}
  <MetadataEditModal
    entityId={album.id}
    {onchanged}
    onclose={() => (showEdit = false)}
  />
{/if}

{#if showChains}
  <ReleaseChainsModal
    releaseId={album.id}
    {onchanged}
    onclose={() => (showChains = false)}
  />
{/if}

{#if showCovers}
  <CoverManagerModal
    kind="release"
    entityId={album.id}
    name={album.title}
    onclose={() => (showCovers = false)}
  />
{/if}
