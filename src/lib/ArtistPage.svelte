<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ArtistRelationResponse, ArtistResponse } from "./types";
  import { fetchArtist } from "./api";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import AlbumCard from "./AlbumCard.svelte";
  import ArtistPortraitCard from "./ArtistPortraitCard.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";

  interface Props {
    artistId: string;
  }

  let { artistId }: Props = $props();

  let artist = $state<ArtistResponse | null>(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let coverFailed = $state(false);
  let coverSrc = $derived(
    artist?.cover && !coverFailed ? artist.cover.url : null,
  );

  let sortedReleases = $derived.by(() => {
    const releases = artist?.releases ?? [];
    return [...releases].sort((a, b) => {
      const ay = a.release_date ?? "";
      const by = b.release_date ?? "";
      return by.localeCompare(ay);
    });
  });

  let relations = $derived.by(() => {
    const items = artist?.relations ?? [];
    return [...items].sort((a, b) => {
      const byType = a.type.localeCompare(b.type);
      if (byType !== 0) return byType;
      return a.artist.name.localeCompare(b.artist.name);
    });
  });

  function relationLabel(rel: ArtistRelationResponse): string {
    const type: string = rel.type;
    if (type === "member_of") {
      return rel.direction === "outgoing" ? "Member of" : "Member";
    }
    if (type === "voice_actor") {
      return rel.direction === "outgoing" ? "Voice actor for" : "Voiced by";
    }
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  function relationRole(rel: ArtistRelationResponse): string {
    const label = relationLabel(rel);
    const detail = rel.attributes?.trim();
    if (detail && detail.toLowerCase() !== label.toLowerCase()) {
      return `${label} · ${detail}`;
    }
    return label;
  }

  async function load(id: string) {
    loading = true;
    error = null;
    artist = null;
    coverFailed = false;
    try {
      artist = await fetchArtist(id);
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load artist";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load(artistId);
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
      href="#/"
      class="mt-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >&larr; Back</a
    >
  </div>
{:else if artist}
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="flex flex-col gap-6 sm:flex-row sm:items-end">
      <div class="w-48 shrink-0 sm:w-56">
        <div
          class="relative aspect-square w-full overflow-hidden rounded-full bg-slate-200 shadow-md dark:bg-neutral-600 dark:shadow-black/40"
        >
          {#if artist.cover?.blurhash}
            <BlurhashCanvas
              hash={artist.cover.blurhash}
              class="absolute inset-0 h-full w-full object-cover"
            />
          {/if}
          {#if coverSrc}
            <img
              src={coverSrc}
              alt="Photo of {artist.name}"
              class="relative h-full w-full object-cover"
              onerror={() => (coverFailed = true)}
            />
          {:else if !artist.cover?.blurhash}
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          {/if}
        </div>
      </div>
      <div class="flex flex-col">
        <h2
          class="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-neutral-100"
        >
          {artist.name}
          {#if artist.verified}
            <span
              class="text-blue-500 dark:text-blue-400"
              title="Verified artist">✓</span
            >
          {/if}
          {#if artist.id}
            <FavoriteButton targetId={artist.id} label={artist.name} />
          {/if}
        </h2>
        {#if sortedReleases.length > 0}
          <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            {sortedReleases.length} album{sortedReleases.length !== 1
              ? "s"
              : ""}
          </p>
        {/if}
      </div>
    </div>

    <!-- Description -->
    {#if artist.description}
      <div class="mt-8">
        <h3
          class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
        >
          About
        </h3>
        <p
          class="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-neutral-300"
        >
          {artist.description}
        </p>
      </div>
    {/if}

    <!-- Relations -->
    {#if relations.length > 0}
      <div class="mt-8">
        <h3
          class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
        >
          Relations
        </h3>
        <div class="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {#each relations as rel, i (`${rel.artist.id}:${rel.type}:${rel.direction}:${i}`)}
            <ArtistPortraitCard
              id={rel.artist.id}
              name={rel.artist.name}
              cover={rel.artist.cover}
              role={relationRole(rel)}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Albums -->
    {#if sortedReleases.length > 0}
      <div class="mt-8">
        <h3
          class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
        >
          Albums
        </h3>
        <div
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {#each sortedReleases as album (album.id ?? album.title)}
            <AlbumCard {album} />
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
