<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import type { TrackResponse } from "./types";
  import SortControls from "./SortControls.svelte";
  import FilterControl from "./FilterControl.svelte";
  import {
    listFilterOptions,
    listFilters,
    savedFilter,
    savedSort,
  } from "./sort.svelte.ts";
  import PaginatedList from "./PaginatedList.svelte";
  import { fetchTracks } from "./api";
  import { getPlayer, isMissing, MISSING_HINT } from "./player.svelte.ts";
  import CoverImage from "./CoverImage.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import RatingButton from "./RatingButton.svelte";
  import { getFavoriteState } from "./favorites.svelte.ts";
  import { getRating } from "./ratings.svelte.ts";
  import { anchorAtPointer, anchorBelow } from "./ContextMenu.svelte";
  import TrackMenu, { type TrackMenuTarget } from "./TrackMenu.svelte";

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

  let trackMenu = $state<TrackMenuTarget | null>(null);

  function openTrackMenu(e: MouseEvent, track: TrackResponse) {
    e.preventDefault();
    trackMenu = { track, anchor: anchorAtPointer(e) };
  }

  function toggleTrackMenu(e: MouseEvent, track: TrackResponse) {
    e.stopPropagation();
    trackMenu =
      trackMenu?.track.id === track.id
        ? null
        : { track, anchor: anchorBelow(e.currentTarget as Element) };
  }

  // Bumped to load the list again after a remap or purge changes it.
  let revision = $state(0);

  function openTrack(track: TrackResponse) {
    if (track.id) window.location.hash = `#/tracks/${track.id}`;
  }
  const sort = savedSort(
    untrack(() => `library/${libraryId}/tracks`),
    "tracks",
  );
  const filter = savedFilter(
    untrack(() => `library/${libraryId}/tracks`),
    listFilterOptions.map((option) => option.value),
  );
</script>

<div class="mx-auto max-w-4xl">
  <PaginatedList
    scope={`${libraryId}/${sort.sortBy}/${sort.sortOrder}/${filter.value}/${revision}`}
    label="tracks"
    pageSize={100}
    empty={filter.value === "all"
      ? "No tracks in this library."
      : "No matching tracks."}
    loadPage={(offset, limit) =>
      fetchTracks({
        libraryId,
        offset,
        limit,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
        filter: listFilters[filter.value],
      })}
  >
    {#snippet toolbar()}
      <div class="flex flex-wrap items-center gap-2">
        <SortControls
          kind="tracks"
          bind:sortBy={sort.sortBy}
          bind:sortOrder={sort.sortOrder}
        />
        <FilterControl options={listFilterOptions} bind:value={filter.value} />
      </div>
    {/snippet}
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
              title={isMissing(track) ? MISSING_HINT : undefined}
              onclick={() => openTrack(track)}
              oncontextmenu={(e) => openTrackMenu(e, track)}
            >
              <td class="w-14 py-2 pr-3 pl-3">
                <CoverImage
                  {cover}
                  class="h-10 w-10 rounded"
                  iconClass="h-4 w-4"
                  lazy
                />
              </td>
              <td
                class="py-2 text-sm"
                class:text-slate-600={player.isCurrentTrack(track)}
                class:dark:text-neutral-200={player.isCurrentTrack(track)}
                class:font-medium={player.isCurrentTrack(track)}
                class:text-slate-900={!player.isCurrentTrack(track)}
                class:dark:text-neutral-100={!player.isCurrentTrack(track)}
              >
                <span class:opacity-60={isMissing(track)}>{track.title}</span>
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
              <td class="w-12 py-2 pl-3">
                {#if track.id}
                  <div
                    class="flex justify-end opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    class:opacity-100={getRating(track.id) != null}
                  >
                    <RatingButton
                      targetId={track.id}
                      label={track.title}
                      size="sm"
                      stopPropagation
                    />
                  </div>
                {/if}
              </td>
              <td
                class="w-16 py-2 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
              >
                {track.duration_ms != null
                  ? formatDuration(track.duration_ms)
                  : ""}
              </td>
              <td class="w-16 py-2 pr-3 pl-2">
                {#if track.id}
                  <div
                    class="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100"
                    class:opacity-100={trackMenu?.track.id === track.id ||
                      getFavoriteState(track.id) === true ||
                      isMissing(track)}
                  >
                    <FavoriteButton
                      targetId={track.id}
                      label={track.title}
                      size="sm"
                      stopPropagation
                    />
                    <button
                      type="button"
                      class="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-600 dark:hover:text-neutral-300"
                      title="Track options"
                      aria-label="Track options"
                      onclick={(e) => toggleTrackMenu(e, track)}
                    >
                      <svg
                        class="h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                        />
                      </svg>
                    </button>
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

<TrackMenu
  target={trackMenu}
  {libraryId}
  onclose={() => (trackMenu = null)}
  onchanged={() => revision++}
/>
