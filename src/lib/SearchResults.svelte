<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onDestroy } from "svelte";
  import { fetchReleases, fetchArtists, fetchTracks } from "./api";
  import AlbumCard from "./AlbumCard.svelte";
  import ArtistCard from "./ArtistCard.svelte";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import PaginatedList from "./PaginatedList.svelte";

  let { query }: { query: string } = $props();
  const controllers = new Map<string, AbortController>();

  function nextSignal(category: string) {
    controllers.get(category)?.abort();
    const controller = new AbortController();
    controllers.set(category, controller);
    return controller.signal;
  }

  onDestroy(() => {
    for (const controller of controllers.values()) controller.abort();
  });
</script>

<h1
  class="mb-8 text-xl font-semibold break-words text-slate-900 dark:text-neutral-100"
>
  Search results for “{query}”
</h1>

<section aria-labelledby="search-albums" class="mb-10">
  <h2
    id="search-albums"
    class="mb-4 text-lg font-semibold text-slate-900 dark:text-neutral-100"
  >
    Albums
  </h2>
  <PaginatedList
    compact
    scope={query}
    label="albums"
    pageSize={12}
    empty={`No albums match “${query}”.`}
    loadPage={(cursor, limit) =>
      fetchReleases({ query, cursor, limit, signal: nextSignal("albums") })}
  >
    {#snippet children(albums)}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {#each albums as album (album.id ?? album.title)}
          <AlbumCard {album} />
        {/each}
      </div>
    {/snippet}
  </PaginatedList>
</section>
<section aria-labelledby="search-artists" class="mb-10">
  <h2
    id="search-artists"
    class="mb-4 text-lg font-semibold text-slate-900 dark:text-neutral-100"
  >
    Artists
  </h2>
  <PaginatedList
    compact
    scope={query}
    label="artists"
    pageSize={12}
    empty={`No artists match “${query}”.`}
    loadPage={(cursor, limit) =>
      fetchArtists({ query, cursor, limit, signal: nextSignal("artists") })}
  >
    {#snippet children(artists)}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {#each artists as artist (artist.id ?? artist.name)}
          <ArtistCard {artist} />
        {/each}
      </div>
    {/snippet}
  </PaginatedList>
</section>
<section aria-labelledby="search-tracks">
  <h2
    id="search-tracks"
    class="mb-4 text-lg font-semibold text-slate-900 dark:text-neutral-100"
  >
    Tracks
  </h2>
  <PaginatedList
    compact
    scope={query}
    label="tracks"
    pageSize={12}
    empty={`No tracks match “${query}”.`}
    loadPage={(cursor, limit) =>
      fetchTracks({ query, cursor, limit, signal: nextSignal("tracks") })}
  >
    {#snippet children(tracks)}
      <ul>
        {#each tracks as track (track.id)}
          {@const release = track.releases?.[0]}
          {@const cover = release?.cover}
          {@const artists = track.artists?.filter(
            (artist) => !artist.credit || artist.credit.type === "artist",
          )}
          <li
            class="border-b border-slate-100 last:border-b-0 dark:border-neutral-900"
          >
            <a
              href={track.id
                ? `#/tracks/${encodeURIComponent(track.id)}`
                : undefined}
              class="flex items-center gap-3 rounded px-3 py-2 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#BB7FB5] dark:hover:bg-neutral-700/50"
            >
              <div
                class="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-neutral-600"
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
                    loading="lazy"
                    class="relative h-full w-full object-cover"
                  />
                {:else if !cover?.blurhash}
                  <span
                    aria-hidden="true"
                    class="flex h-full items-center justify-center text-lg text-slate-400 dark:text-neutral-500"
                    >♫</span
                  >
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div
                  class="truncate text-sm text-slate-900 dark:text-neutral-100"
                >
                  {track.title}
                </div>
                <div
                  class="truncate text-xs text-slate-400 dark:text-neutral-500"
                >
                  {artists?.map((artist) => artist.name).join(", ") ||
                    "Unknown Artist"}
                </div>
              </div>
              <span
                class="hidden max-w-[35%] truncate text-sm text-slate-500 sm:block dark:text-neutral-400"
                >{release?.title ?? ""}</span
              >
              {#if track.duration_ms != null}
                {@const seconds = Math.floor(track.duration_ms / 1000)}
                <span
                  class="w-12 shrink-0 text-right text-sm text-slate-400 tabular-nums dark:text-neutral-500"
                  >{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(
                    2,
                    "0",
                  )}</span
                >
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/snippet}
  </PaginatedList>
</section>
