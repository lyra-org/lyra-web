<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ArtistResponse, CreditType, TrackResponse } from "./types";
  import { fetchTrackDetail } from "./api";
  import { getPlayer } from "./player.svelte.ts";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import ArtistPortraitCard from "./ArtistPortraitCard.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";

  interface Props {
    trackId: string;
  }

  let { trackId }: Props = $props();

  const player = getPlayer();

  let track = $state<TrackResponse | null>(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let coverFailed = $state(false);

  let release = $derived(track?.releases?.[0] ?? null);
  let coverSrc = $derived(
    release?.cover && !coverFailed ? release.cover.url : null,
  );

  const CREDIT_ORDER: CreditType[] = [
    "artist",
    "vocalist",
    "instrumentalist",
    "composer",
    "lyricist",
    "writer",
    "arranger",
    "producer",
    "conductor",
    "engineer",
    "mixer",
    "remixer",
  ];

  function creditLabel(type: CreditType): string {
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function creditRole(artist: ArtistResponse): string {
    const type = artist.credit?.type ?? "artist";
    const label = creditLabel(type);
    const detail = artist.credit?.detail?.trim();
    if (detail && detail.toLowerCase() !== label.toLowerCase()) {
      return `${label} · ${detail}`;
    }
    return label;
  }

  function creditSortKey(type: CreditType): number {
    const index = CREDIT_ORDER.indexOf(type);
    return index === -1 ? CREDIT_ORDER.length : index;
  }

  let creditEntries = $derived.by(() => {
    const artists = track?.artists ?? [];
    return [...artists].sort((a, b) => {
      const typeA = a.credit?.type ?? "artist";
      const typeB = b.credit?.type ?? "artist";
      const order = creditSortKey(typeA) - creditSortKey(typeB);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    });
  });

  let primaryArtists = $derived(
    track?.artists?.filter((a) => (a.credit?.type ?? "artist") === "artist") ??
      [],
  );

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function artistNamesForPlayback(): Record<string, string> {
    if (!track?.id) return {};
    const names =
      primaryArtists.length > 0 ? primaryArtists : (track.artists ?? []);
    if (names.length === 0) return {};
    return { [track.id]: names.map((a) => a.name).join(", ") };
  }

  function handlePlay() {
    if (!track) return;
    player.playTrack(track, {
      tracks: [track],
      title: track.title,
      coverUrl: release?.cover?.url ?? null,
      coverBlurhash: release?.cover?.blurhash ?? null,
      trackArtistNames: artistNamesForPlayback(),
    });
  }

  async function load(id: string) {
    loading = true;
    error = null;
    track = null;
    coverFailed = false;
    try {
      track = await fetchTrackDetail(id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load track";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load(trackId);
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
  </div>
{:else if track}
  <div class="mx-auto max-w-4xl">
    <div class="flex flex-col gap-6 sm:flex-row">
      <div class="w-full shrink-0 sm:w-64">
        <div
          class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 shadow-md dark:bg-neutral-600 dark:shadow-black/40"
        >
          {#if release?.cover?.blurhash}
            <BlurhashCanvas
              hash={release.cover.blurhash}
              class="absolute inset-0 h-full w-full object-cover"
            />
          {/if}
          {#if coverSrc}
            <img
              src={coverSrc}
              alt="Cover for {release?.title ?? track.title}"
              class="relative h-full w-full object-cover"
              onerror={() => (coverFailed = true)}
            />
          {:else if !release?.cover?.blurhash}
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
        <h2 class="text-2xl font-bold text-slate-900 dark:text-neutral-100">
          {track.title}
        </h2>

        {#if primaryArtists.length > 0}
          <p class="mt-1 text-lg text-slate-600 dark:text-neutral-300">
            {#each primaryArtists as artist, i}
              {#if i > 0}<span class="text-slate-400 dark:text-neutral-500"
                  >,
                </span>{/if}
              <a
                href={`#/artists/${artist.id}`}
                class="hover:text-slate-900 hover:underline dark:hover:text-neutral-100"
                >{artist.name}</a
              >
            {/each}
          </p>
        {/if}

        <div
          class="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-neutral-400"
        >
          {#if release?.title}
            <a
              href={release.id ? `#/albums/${release.id}` : undefined}
              class="hover:text-slate-700 hover:underline dark:hover:text-neutral-200"
            >
              {release.title}
            </a>
          {/if}
          {#if track.duration_ms != null}
            {#if release?.title}<span
                class="text-slate-300 dark:text-neutral-600">&middot;</span
              >{/if}
            <span>{formatDuration(track.duration_ms)}</span>
          {/if}
          {#if track.disc != null && track.disc_total != null && track.disc_total > 1}
            <span class="text-slate-300 dark:text-neutral-600">&middot;</span>
            <span
              >Disc {track.disc}{track.track != null
                ? `, track ${track.track}`
                : ""}</span
            >
          {:else if track.track != null}
            <span class="text-slate-300 dark:text-neutral-600">&middot;</span>
            <span>Track {track.track}</span>
          {/if}
          {#if track.year != null}
            <span class="text-slate-300 dark:text-neutral-600">&middot;</span>
            <span>{track.year}</span>
          {/if}
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-[#E6CEE3] px-5 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
            disabled={player.loading && player.isCurrentTrack(track)}
            onclick={handlePlay}
          >
            {#if player.isCurrentTrack(track) && player.playing}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
                  clip-rule="evenodd"
                />
              </svg>
              Playing
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clip-rule="evenodd"
                />
              </svg>
              Play
            {/if}
          </button>
          {#if track.id}
            <FavoriteButton targetId={track.id} label={track.title} />
          {/if}
        </div>
      </div>
    </div>

    {#if creditEntries.length > 0}
      <div class="mt-8">
        <h3
          class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
        >
          Credits
        </h3>
        <div class="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {#each creditEntries as artist, i (`${artist.id}:${artist.credit?.type ?? "artist"}:${artist.credit?.detail ?? ""}:${i}`)}
            <ArtistPortraitCard
              id={artist.id}
              name={artist.name}
              cover={artist.cover}
              role={creditRole(artist)}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
