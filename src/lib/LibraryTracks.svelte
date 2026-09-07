<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { TrackResponse } from "./types";
  import PaginatedList from "./PaginatedList.svelte";
  import { fetchTracks } from "./api";
  import { getPlayer } from "./player.svelte.ts";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import { getFavoriteState } from "./favorites.svelte.ts";

  interface Props {
    libraryId: string;
  }

  let { libraryId }: Props = $props();

  const player = getPlayer();

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function primaryRelease(track: TrackResponse) {
    return track.releases?.[0] ?? null;
  }

  function artistNames(track: TrackResponse): string {
    const artists =
      track.artists?.filter((a) => a.credit?.type === "artist") ??
      track.artists ??
      [];
    if (artists.length > 0) return artists.map((a) => a.name).join(", ");
    const releaseArtists = primaryRelease(track)?.artists ?? [];
    if (releaseArtists.length > 0) {
      return releaseArtists.map((a) => a.name).join(", ");
    }
    return "Unknown Artist";
  }

  function openTrack(track: TrackResponse) {
    if (track.id) window.location.hash = `#/tracks/${track.id}`;
  }
</script>

<div class="mx-auto max-w-4xl">
  <PaginatedList
    scope={libraryId}
    label="tracks"
    pageSize={100}
    empty="No tracks in this library."
    loadPage={(cursor, limit) => fetchTracks({ libraryId, cursor, limit })}
  >
    {#snippet children(tracks)}
      <table class="w-full">
        <tbody>
          {#each tracks as track (track.id)}
            {@const release = primaryRelease(track)}
            {@const cover = release?.cover}
            <tr
              class="group cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-neutral-900 dark:hover:bg-neutral-700/50"
              class:bg-slate-100={player.isCurrentTrack(track)}
              class:dark:bg-neutral-700={player.isCurrentTrack(track)}
              onclick={() => openTrack(track)}
            >
              <td class="w-14 py-2 pr-3 pl-3">
                <div
                  class="relative h-10 w-10 overflow-hidden rounded bg-slate-200 dark:bg-neutral-600"
                >
                  {#if cover?.blurhash}
                    <BlurhashCanvas
                      hash={cover.blurhash}
                      class="absolute inset-0 h-full w-full object-cover"
                    />
                  {/if}
                  {#if cover?.url}
                    <img
                      src={cover.url}
                      alt=""
                      class="relative h-full w-full object-cover"
                      loading="lazy"
                    />
                  {:else if !cover?.blurhash}
                    <div
                      class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
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
              </td>
              <td
                class="py-2 text-sm"
                class:text-slate-600={player.isCurrentTrack(track)}
                class:dark:text-neutral-200={player.isCurrentTrack(track)}
                class:font-medium={player.isCurrentTrack(track)}
                class:text-slate-900={!player.isCurrentTrack(track)}
                class:dark:text-neutral-100={!player.isCurrentTrack(track)}
              >
                <span>{track.title}</span>
                <span
                  class="block text-xs font-normal text-slate-400 dark:text-neutral-500"
                >
                  {artistNames(track)}
                </span>
              </td>
              <td
                class="hidden py-2 text-sm text-slate-500 sm:table-cell dark:text-neutral-400"
              >
                {#if release?.id}
                  <a
                    href={`#/albums/${release.id}`}
                    class="hover:text-slate-700 hover:underline dark:hover:text-neutral-200"
                    onclick={(e) => e.stopPropagation()}
                  >
                    {release.title}
                  </a>
                {:else if release}
                  {release.title}
                {/if}
              </td>
              <td
                class="w-16 py-2 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
              >
                {track.duration_ms != null
                  ? formatDuration(track.duration_ms)
                  : ""}
              </td>
              <td class="w-10 py-2 pr-3">
                {#if track.id}
                  <div
                    class="flex justify-end opacity-0 group-hover:opacity-100"
                    class:opacity-100={getFavoriteState(track.id) === true}
                  >
                    <FavoriteButton
                      targetId={track.id}
                      label={track.title}
                      size="sm"
                      stopPropagation
                    />
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/snippet}
  </PaginatedList>
</div>
