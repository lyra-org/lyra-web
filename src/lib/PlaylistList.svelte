<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PlaylistResponse } from "./types";
  import {
    fetchPlaylists,
    fetchAllPages,
    createPlaylist,
    deletePlaylist,
  } from "./api";

  let playlists: PlaylistResponse[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  let showCreate = $state(false);
  let newName = $state("");
  let creating = $state(false);

  let menuOpenId = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  async function load() {
    try {
      playlists = await fetchAllPages(fetchPlaylists);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load playlists";
    } finally {
      loading = false;
    }
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    creating = true;
    try {
      const pl = await createPlaylist(newName.trim());
      playlists = [pl, ...playlists];
      newName = "";
      showCreate = false;
    } catch {
      // ignore
    } finally {
      creating = false;
    }
  }

  async function handleDelete(id: string) {
    menuOpenId = null;
    deleting = id;
    try {
      await deletePlaylist(id);
      playlists = playlists.filter((p) => p.id !== id);
    } catch {
      // ignore
    } finally {
      deleting = null;
    }
  }

  function handleWindowClick() {
    if (menuOpenId != null) menuOpenId = null;
  }

  load();
</script>

<svelte:window onclick={handleWindowClick} />

{#if loading}
  <div class="flex items-center justify-center py-20">
    <div
      class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
    ></div>
  </div>
{:else if error}
  <div class="py-20 text-center">
    <p class="text-sm text-red-500 dark:text-red-400">{error}</p>
  </div>
{:else}
  <div class="mx-auto max-w-3xl">
    <!-- Header with create button -->
    <div class="mb-4 flex items-center justify-end">
      <button
        class="rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={() => (showCreate = !showCreate)}
      >
        {showCreate ? "Cancel" : "+ New playlist"}
      </button>
    </div>

    {#if showCreate}
      <form class="mb-4 flex gap-2" onsubmit={handleCreate}>
        <input
          type="text"
          bind:value={newName}
          placeholder="Playlist name..."
          class="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          class="rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        >
          {creating ? "Creating..." : "Create"}
        </button>
      </form>
    {/if}

    {#if playlists.length === 0}
      <div class="py-20 text-center">
        <p class="text-sm text-slate-500 dark:text-neutral-400">
          No playlists yet.
        </p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each playlists as playlist (playlist.id ?? playlist.name)}
          <div class="relative">
            <a
              href={playlist.id != null
                ? `#/playlists/${playlist.id}`
                : undefined}
              class="block"
            >
              <div
                class="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
                class:opacity-50={deleting === playlist.id}
              >
                <div class="min-w-0 flex-1">
                  <h3
                    class="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
                  >
                    {playlist.name}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-neutral-400">
                    {playlist.tracks?.length ?? 0} track{(playlist.tracks
                      ?.length ?? 0) !== 1
                      ? "s"
                      : ""}
                    {#if playlist.description}
                      <span class="text-slate-300 dark:text-neutral-600"
                        >&middot;</span
                      >
                      {playlist.description}
                    {/if}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Playlist options"
                  class="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    menuOpenId =
                      menuOpenId === playlist.id ? null : playlist.id;
                  }}
                >
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
                </button>
              </div>
            </a>

            {#if menuOpenId === playlist.id}
              <div
                role="menu"
                tabindex="-1"
                class="absolute top-12 right-2 z-10 min-w-35 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-neutral-600"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (playlist.id != null) handleDelete(playlist.id);
                  }}
                >
                  <svg
                    class="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
