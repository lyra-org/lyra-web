<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { PageResource } from "./pageResource.svelte.ts";
  import type { ArtistRelationResponse, ReleaseResponse } from "./types";
  import { fetchArtist, fetchReleases } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import CoverImage from "./CoverImage.svelte";
  import DescriptionSection from "./DescriptionSection.svelte";
  import ChangeCoverButton from "./ChangeCoverButton.svelte";
  import CoverManagerModal from "./CoverManagerModal.svelte";
  import { shownCover } from "./covers.svelte.ts";
  import AlbumCard from "./AlbumCard.svelte";
  import ArtistMenu from "./ArtistMenu.svelte";
  import ArtistPortraitCard from "./ArtistPortraitCard.svelte";
  import OptionsButton from "./OptionsButton.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import RatingButton from "./RatingButton.svelte";
  import PaginatedList from "./PaginatedList.svelte";
  import SortControls from "./SortControls.svelte";
  import FilterControl from "./FilterControl.svelte";
  import {
    listFilterOptions,
    listFilters,
    savedFilter,
    savedSort,
  } from "./sort.svelte.ts";

  interface Props {
    artistId: string;
  }

  let { artistId }: Props = $props();

  const resource = new PageResource(
    () => artistId,
    fetchArtist,
    "Failed to load artist",
  );
  let artist = $derived(resource.value);
  let loading = $derived(resource.loading);
  let error = $derived(resource.error);
  const auth = getAuth();
  let canManage = $derived(auth.hasPermission("manage_metadata"));
  let canSync = $derived(auth.hasPermission("sync_metadata"));
  let artistMenu = $state<ArtistMenu>();
  let showCovers = $state(false);

  let cover = $derived(artist ? shownCover(artist.id, artist.cover) : null);

  const sort = savedSort("artist/albums", "albums", {
    sortBy: "release_date",
    sortOrder: "descending",
  });
  const filter = savedFilter(
    "artist/albums",
    listFilterOptions.map((option) => option.value),
  );
  let listScope = $derived(
    `${artistId}/${sort.sortBy}/${sort.sortOrder}/${filter.value}`,
  );
  // How many releases the artist appears on without a credit of its own, as
  // the last page read for the current list counted them; the section stays
  // hidden without any.
  let appearances = $state({ scope: "", total: 0 });

  function loadReleases(
    role: "albums" | "appearances",
    offset: number,
    limit: number,
  ) {
    return fetchReleases({
      artistId,
      ...(role === "albums"
        ? { creditRole: "release" }
        : { creditRole: "track", excludeCreditRole: "release" }),
      offset,
      limit,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      filter: listFilters[filter.value],
    });
  }

  async function loadAppearances(offset: number, limit: number) {
    const scope = listScope;
    const page = await loadReleases("appearances", offset, limit);
    appearances = { scope, total: page.total };
    return page;
  }

  let summary = $derived.by(() => {
    if (!artist) return [];
    const parts: string[] = [];
    const releases = artist.release_count ?? 0;
    const tracks = artist.track_count ?? 0;
    if (releases > 0)
      parts.push(`${releases} album${releases !== 1 ? "s" : ""}`);
    if (tracks > 0) parts.push(`${tracks} track${tracks !== 1 ? "s" : ""}`);
    if ((artist.total_duration_ms ?? 0) > 0) {
      parts.push(formatTotalDuration(artist.total_duration_ms!));
    }
    return parts;
  });

  function formatTotalDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hr ${mins} min`;
  }

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
      <div class="group relative w-48 shrink-0 sm:w-56">
        <!-- imageClass rounds the image itself: once the change-cover button
             fades out, Chromium can draw it without the wrapper's clip. -->
        <CoverImage
          {cover}
          alt="Photo of {artist.name}"
          class="aspect-square w-full rounded-full shadow-md dark:shadow-black/40"
          imageClass="rounded-full"
          icon="person"
          iconClass="h-16 w-16"
        />
        {#if canManage && artist.id}
          <ChangeCoverButton
            class="right-3 bottom-3"
            onclick={() => (showCovers = true)}
          />
        {/if}
      </div>
      <div class="flex flex-col">
        <h2
          class="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-neutral-100"
        >
          {artist.name}
          {#if artist.id}
            <FavoriteButton targetId={artist.id} label={artist.name} />
            <RatingButton targetId={artist.id} label={artist.name} />
            {#if canManage || canSync}
              <OptionsButton
                label="Artist options"
                expanded={artistMenu?.isOpen() ?? false}
                busy={artistMenu?.isRefreshing() ?? false}
                onclick={(e) => artistMenu?.toggle(e)}
              />
            {/if}
          {/if}
        </h2>
        {#if summary.length > 0}
          <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            {summary.join(" · ")}
          </p>
        {/if}
      </div>
    </div>

    <DescriptionSection description={artist.description} />

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

    {#snippet albumGrid(albums: ReleaseResponse[])}
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {#each albums as album (album.id)}
          <AlbumCard {album} />
        {/each}
      </div>
    {/snippet}

    {#if (artist.release_count ?? 1) > 0}
      <div class="mt-8">
        <h3
          class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
        >
          Albums
        </h3>
        <PaginatedList
          scope={listScope}
          label="albums"
          empty={filter.value === "all" ? "No albums." : "No matching albums."}
          loadPage={(offset, limit) => loadReleases("albums", offset, limit)}
          children={albumGrid}
        >
          {#snippet toolbar()}
            <div class="flex flex-wrap items-center gap-2">
              <SortControls
                kind="albums"
                bind:sortBy={sort.sortBy}
                bind:sortOrder={sort.sortOrder}
              />
              <FilterControl
                options={listFilterOptions}
                bind:value={filter.value}
              />
            </div>
          {/snippet}
        </PaginatedList>
      </div>
    {/if}

    <!-- Releases holding a track credited to the artist, under the albums'
         sort and filter. Mounted while hidden so it can learn whether there
         are any. -->
    <div
      class="mt-8"
      class:hidden={appearances.scope !== listScope || appearances.total === 0}
    >
      <h3
        class="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
      >
        Appears on
      </h3>
      <PaginatedList
        compact
        scope={listScope}
        label="appearances"
        loadPage={loadAppearances}
        children={albumGrid}
      />
    </div>
  </div>
{/if}

{#if artist}
  <ArtistMenu
    bind:this={artistMenu}
    artistId={artist.id}
    artistName={artist.name}
    onchanged={resource.reload}
  />
{/if}

{#if showCovers && artist?.id}
  <CoverManagerModal
    kind="artist"
    entityId={artist.id}
    name={artist.name}
    onclose={() => (showCovers = false)}
  />
{/if}
