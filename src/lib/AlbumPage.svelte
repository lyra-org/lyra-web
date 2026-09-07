<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  let openMenuTrackId = $state<string | null>(null);
</script>

<script lang="ts">
  import type { ArtistResponse, ReleaseResponse, TrackResponse } from "./types";
  import { fetchRelease } from "./api";
  import { getPlayer } from "./player.svelte.ts";
  import { getTags, tagChipClasses } from "./tags.svelte.ts";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import TrackMenu from "./TrackMenu.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import { getFavoriteState } from "./favorites.svelte.ts";
  const player = getPlayer();
  const tagsStore = getTags();

  interface Props {
    albumId: string;
  }

  let { albumId }: Props = $props();

  let album = $state<ReleaseResponse | null>(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let coverFailed = $state(false);

  let coverSrc = $derived(
    album?.cover && !coverFailed ? album.cover.url : null,
  );
  let releaseYear = $derived(
    album?.release_date ? album.release_date.slice(0, 4) : null,
  );
  let multiDisc = $derived(
    album?.tracks?.some((t) => t.disc_total != null && t.disc_total > 1) ??
      false,
  );
  let discGroups = $derived(groupByDisc(album?.tracks ?? []));
  let sortedTracks = $derived([...discGroups.values()].flat());
  let trackArtists = $derived.by(() => {
    const map: Record<string, ArtistResponse[]> = {};
    for (const t of album?.tracks ?? []) {
      if (!t.id || !t.artists?.length) continue;
      const primary = t.artists.filter((a) => a.credit?.type === "artist");
      if (primary.length) {
        map[t.id] = primary;
      }
    }
    return map;
  });
  let trackArtistNames = $derived.by(() => {
    const names: Record<string, string> = {};
    for (const [id, artists] of Object.entries(trackArtists)) {
      names[id] = artists.map((a) => a.name).join(", ");
    }
    return names;
  });

  function groupByDisc(tracks: TrackResponse[]): Map<number, TrackResponse[]> {
    const map = new Map<number, TrackResponse[]>();
    for (const t of tracks) {
      const disc = t.disc ?? 1;
      let list = map.get(disc);
      if (!list) {
        list = [];
        map.set(disc, list);
      }
      list.push(t);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.track ?? 0) - (b.track ?? 0));
    }
    return new Map([...map.entries()].sort(([a], [b]) => a - b));
  }

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  async function load(id: string) {
    loading = true;
    error = null;
    album = null;
    coverFailed = false;
    try {
      album = await fetchRelease(id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load album";
    } finally {
      loading = false;
    }
  }

  function handleWindowClick() {
    if (openMenuTrackId != null) openMenuTrackId = null;
  }

  let albumContext = $derived.by(() => {
    if (!album) return null;
    return {
      tracks: sortedTracks,
      title: album.title,
      coverUrl: album.cover?.url ?? null,
      coverBlurhash: album.cover?.blurhash ?? null,
      trackArtistNames,
    };
  });

  $effect(() => {
    load(albumId);
  });

  $effect(() => {
    tagsStore.load();
  });
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
    <a
      href="#/"
      class="mt-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >&larr; Back to albums</a
    >
  </div>
{:else if album}
  <div class="mx-auto max-w-4xl">
    <!-- Header -->
    <div class="flex flex-col gap-6 sm:flex-row">
      <div class="w-full shrink-0 sm:w-64">
        <div
          class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 shadow-md dark:bg-neutral-600 dark:shadow-black/40"
        >
          {#if album?.cover?.blurhash}
            <BlurhashCanvas
              hash={album.cover.blurhash}
              class="absolute inset-0 h-full w-full object-cover"
            />
          {/if}
          {#if coverSrc}
            <img
              src={coverSrc}
              alt="Cover for {album.title}"
              class="relative h-full w-full object-cover"
              onerror={() => (coverFailed = true)}
            />
          {:else if !album?.cover?.blurhash}
            <div
              class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-16 w-16"
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
      </div>
      <div class="flex flex-col justify-end">
        <div class="flex items-start gap-2">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-neutral-100">
            {album.title}
          </h2>
          {#if album.id}
            <FavoriteButton targetId={album.id} label={album.title} />
          {/if}
        </div>
        <p class="mt-1 text-lg text-slate-600 dark:text-neutral-300">
          {#if album.artists && album.artists.length > 0}
            {#each album.artists as artist, i}
              {#if i > 0}<span class="text-slate-400 dark:text-neutral-500"
                  >,
                </span>{/if}
              <a
                href={`#/artists/${artist.id}`}
                class="hover:text-slate-900 hover:underline dark:hover:text-neutral-100"
                >{artist.name}</a
              >
            {/each}
          {:else}
            Unknown Artist
          {/if}
        </p>
        <div
          class="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-neutral-400"
        >
          {#if releaseYear}
            <span>{releaseYear}</span>
          {/if}
          {#if album.genres && album.genres.length > 0}
            {#if releaseYear}<span class="text-slate-300 dark:text-neutral-600"
                >&middot;</span
              >{/if}
            <span>{album.genres.join(", ")}</span>
          {/if}
          {#if album.tracks}
            <span class="text-slate-300 dark:text-neutral-600">&middot;</span>
            <span
              >{album.tracks.length} track{album.tracks.length !== 1
                ? "s"
                : ""}</span
            >
          {/if}
        </div>
      </div>
    </div>

    <!-- Track list -->
    {#if album.tracks && album.tracks.length > 0}
      <div class="mt-8">
        {#each discGroups as [discNum, tracks]}
          {#if multiDisc}
            <h3
              class="mt-6 mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase first:mt-0 dark:text-neutral-500"
            >
              Disc {discNum}
            </h3>
          {/if}
          <table class="w-full">
            <tbody>
              {#each tracks as track}
                <tr
                  class="group cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-neutral-900 dark:hover:bg-neutral-700/50"
                  class:bg-slate-100={player.isCurrentTrack(track)}
                  class:dark:bg-neutral-700={player.isCurrentTrack(track)}
                  onclick={() =>
                    album &&
                    player.playTrack(track, {
                      tracks: sortedTracks,
                      title: album.title,
                      coverUrl: album.cover?.url ?? null,
                      coverBlurhash: album.cover?.blurhash ?? null,
                      trackArtistNames,
                    })}
                >
                  <td
                    class="w-10 py-2 pr-3 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
                  >
                    {#if player.isCurrentTrack(track) && player.playing}
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
                    {:else if player.isCurrentTrack(track)}
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
                      <span class="group-hover:hidden">{track.track ?? ""}</span
                      >
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
                  <td
                    class="py-2 text-sm"
                    class:text-slate-600={player.isCurrentTrack(track)}
                    class:dark:text-neutral-200={player.isCurrentTrack(track)}
                    class:font-medium={player.isCurrentTrack(track)}
                    class:text-slate-900={!player.isCurrentTrack(track)}
                    class:dark:text-neutral-100={!player.isCurrentTrack(track)}
                  >
                    <span class="inline-flex flex-wrap items-center gap-1.5">
                      <span>{track.title}</span>
                      {#if track.id != null}
                        {#each tagsStore.tagsForTarget(track.id) as tag}
                          <span
                            class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium {tagChipClasses(
                              tag.color,
                            )}"
                          >
                            {tag.tag}
                          </span>
                        {/each}
                      {/if}
                    </span>
                    {#if track.id != null && trackArtists[track.id]}
                      <span
                        class="block text-xs font-normal text-slate-400 dark:text-neutral-500"
                      >
                        {#each trackArtists[track.id] as artist, i}
                          {#if i > 0},
                          {/if}
                          <a
                            href={`#/artists/${artist.id}`}
                            class="hover:text-slate-700 hover:underline dark:hover:text-neutral-300"
                            onclick={(e) => e.stopPropagation()}
                            >{artist.name}</a
                          >
                        {/each}
                      </span>
                    {/if}
                  </td>
                  <td
                    class="w-16 py-2 pl-3 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
                  >
                    {track.duration_ms != null
                      ? formatDuration(track.duration_ms)
                      : ""}
                  </td>
                  <td class="relative w-16 py-2 pr-3 pl-2">
                    {#if track.id != null}
                      <div
                        class="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100"
                        class:opacity-100={openMenuTrackId === track.id ||
                          getFavoriteState(track.id) === true}
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
                          onclick={(e) => {
                            e.stopPropagation();
                            openMenuTrackId =
                              openMenuTrackId === track.id ? null : track.id;
                          }}
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
                      {#if openMenuTrackId === track.id && albumContext}
                        <TrackMenu
                          trackId={track.id}
                          {track}
                          context={albumContext}
                          onclose={() => (openMenuTrackId = null)}
                        />
                      {/if}
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/each}
      </div>
    {/if}
  </div>
{/if}
