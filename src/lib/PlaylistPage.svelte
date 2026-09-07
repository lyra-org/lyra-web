<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PlaylistResponse, PlaylistTrackResponse } from "./types";
  import {
    fetchPlaylist,
    deletePlaylist,
    updatePlaylist,
    removePlaylistTrack,
    movePlaylistTrack,
  } from "./api";
  import { getPlayer } from "./player.svelte.ts";
  import FavoriteButton from "./FavoriteButton.svelte";

  const player = getPlayer();

  interface Props {
    playlistId: string;
  }

  let { playlistId }: Props = $props();

  let playlist = $state<PlaylistResponse | null>(null);
  let loading = $state(true);
  let error: string | null = $state(null);

  let editing = $state(false);
  let editName = $state("");
  let editDescription = $state("");
  let saving = $state(false);

  let sortedItems = $derived(
    [...(playlist?.tracks ?? [])].sort((a, b) => a.position - b.position),
  );

  let totalDuration = $derived(
    sortedItems.reduce((sum, item) => sum + (item.track.duration_ms ?? 0), 0),
  );

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function formatTotalDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hr ${mins} min`;
  }

  async function load(id: string) {
    loading = true;
    error = null;
    playlist = null;
    try {
      playlist = await fetchPlaylist(id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load playlist";
    } finally {
      loading = false;
    }
  }

  function playItem(item: PlaylistTrackResponse) {
    if (!playlist) return;
    const tracks = sortedItems.map((i) => i.track);
    const trackArtistNames: Record<string, string> = {};
    for (const i of sortedItems) {
      if (i.track.id && i.artists?.length) {
        trackArtistNames[i.track.id] = i.artists.map((a) => a.name).join(", ");
      }
    }
    player.playTrack(item.track, {
      tracks,
      title: playlist.name,
      coverUrl: null,
      coverBlurhash: null,
      trackArtistNames,
    });
  }

  function startEdit() {
    if (!playlist) return;
    editName = playlist.name;
    editDescription = playlist.description ?? "";
    editing = true;
  }

  async function handleSaveEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!playlist?.id || !editName.trim() || saving) return;
    saving = true;
    try {
      playlist = await updatePlaylist(playlist.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      editing = false;
    } catch {
      // ignore
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!playlist?.id) return;
    try {
      await deletePlaylist(playlist.id);
      window.location.hash = "#/playlists";
    } catch {
      // ignore
    }
  }

  async function handleRemoveTrack(entryId: string) {
    if (!playlist?.id) return;
    try {
      await removePlaylistTrack(playlist.id, entryId);
      playlist = {
        ...playlist,
        tracks: (playlist.tracks ?? []).filter((t) => t.entry_id !== entryId),
      };
    } catch {
      // ignore
    }
  }

  async function handleMove(entryId: string, newPosition: number) {
    if (!playlist?.id) return;
    try {
      const updatedItems = await movePlaylistTrack(
        playlist.id,
        entryId,
        newPosition,
      );
      playlist = { ...playlist, tracks: updatedItems };
    } catch {
      // ignore
    }
  }

  $effect(() => {
    load(playlistId);
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
      href="#/playlists"
      class="mt-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >&larr; Back to playlists</a
    >
  </div>
{:else if playlist}
  <div class="mx-auto max-w-4xl">
    <!-- Header -->
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="flex-1">
        {#if editing}
          <form class="flex flex-col gap-2" onsubmit={handleSaveEdit}>
            <input
              type="text"
              bind:value={editName}
              placeholder="Playlist name..."
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-lg font-bold focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
            />
            <input
              type="text"
              bind:value={editDescription}
              placeholder="Description (optional)"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
            />
            <div class="flex gap-2">
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                class="rounded-md bg-[#E6CEE3] px-3 py-1 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                class="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                onclick={() => (editing = false)}
              >
                Cancel
              </button>
            </div>
          </form>
        {:else}
          <h2 class="text-2xl font-bold text-slate-900 dark:text-neutral-100">
            {playlist.name}
          </h2>
          {#if playlist.description}
            <p class="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              {playlist.description}
            </p>
          {/if}
          <div
            class="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-neutral-400"
          >
            <span>
              {sortedItems.length} track{sortedItems.length !== 1 ? "s" : ""}
            </span>
            {#if totalDuration > 0}
              <span class="text-slate-300 dark:text-neutral-600">&middot;</span>
              <span>{formatTotalDuration(totalDuration)}</span>
            {/if}
          </div>
        {/if}
      </div>
      {#if !editing}
        <div class="flex flex-wrap items-center gap-2">
          {#if playlist.id}
            <FavoriteButton targetId={playlist.id} label={playlist.name} />
          {/if}
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            onclick={startEdit}
          >
            Edit
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onclick={handleDelete}
          >
            Delete
          </button>
        </div>
      {/if}
    </div>

    <!-- Track list -->
    {#if sortedItems.length > 0}
      <div class="mt-8">
        <table class="w-full">
          <tbody>
            {#each sortedItems as item, idx}
              <tr
                class="group cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-neutral-900 dark:hover:bg-neutral-700/50"
                class:bg-slate-100={player.isCurrentTrack(item.track)}
                class:dark:bg-neutral-700={player.isCurrentTrack(item.track)}
                onclick={() => playItem(item)}
              >
                <!-- Position / play icon -->
                <td
                  class="w-10 py-2 pr-3 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
                >
                  {#if player.isCurrentTrack(item.track) && player.playing}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="inline h-4 w-4 text-slate-600 dark:text-neutral-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {:else if player.isCurrentTrack(item.track)}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="inline h-4 w-4 text-slate-600 dark:text-neutral-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {:else}
                    <span class="group-hover:hidden">{idx + 1}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="hidden h-4 w-4 text-slate-600 group-hover:inline dark:text-neutral-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {/if}
                </td>

                <!-- Track title -->
                <td
                  class="py-2 text-sm"
                  class:text-slate-600={player.isCurrentTrack(item.track)}
                  class:dark:text-neutral-200={player.isCurrentTrack(
                    item.track,
                  )}
                  class:font-medium={player.isCurrentTrack(item.track)}
                  class:text-slate-900={!player.isCurrentTrack(item.track)}
                  class:dark:text-neutral-100={!player.isCurrentTrack(
                    item.track,
                  )}
                >
                  {item.track.title}
                </td>

                <!-- Duration -->
                <td
                  class="w-16 py-2 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
                >
                  {item.track.duration_ms != null
                    ? formatDuration(item.track.duration_ms)
                    : ""}
                </td>

                <!-- Reorder + remove actions -->
                <td class="w-24 py-2 pr-3 text-right">
                  <div
                    class="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100"
                  >
                    {#if idx > 0}
                      <button
                        type="button"
                        class="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-600 dark:hover:text-neutral-300"
                        title="Move up"
                        onclick={(e) => {
                          e.stopPropagation();
                          handleMove(
                            item.entry_id,
                            sortedItems[idx - 1].position,
                          );
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
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                    {:else}
                      <div class="h-5 w-5"></div>
                    {/if}
                    {#if idx < sortedItems.length - 1}
                      <button
                        type="button"
                        class="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-600 dark:hover:text-neutral-300"
                        title="Move down"
                        onclick={(e) => {
                          e.stopPropagation();
                          handleMove(
                            item.entry_id,
                            sortedItems[idx + 1].position,
                          );
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
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    {:else}
                      <div class="h-5 w-5"></div>
                    {/if}
                    <button
                      type="button"
                      class="rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-500 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      title="Remove from playlist"
                      onclick={(e) => {
                        e.stopPropagation();
                        handleRemoveTrack(item.entry_id);
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="mt-8 py-12 text-center">
        <p class="text-sm text-slate-500 dark:text-neutral-400">
          This playlist is empty. Add tracks from an album.
        </p>
      </div>
    {/if}
  </div>
{/if}
