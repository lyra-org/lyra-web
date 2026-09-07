<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import type {
    ReleaseResponse,
    ProviderResponse,
    SearchResult,
    SearchEntityType,
  } from "./types";
  import {
    fetchProviders,
    searchProvider,
    setExternalId,
    refreshEntity,
  } from "./api";

  interface Props {
    album: ReleaseResponse;
    onclose: () => void;
  }

  let { album, onclose }: Props = $props();

  let query = $state(untrack(() => album.title));
  let entityType = $state<SearchEntityType>("release");
  let selectedProviderId = $state<string | null>(null);

  let providers = $state<ProviderResponse[]>([]);
  let providersLoading = $state(true);
  let providersError = $state<string | null>(null);

  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let hasSearched = $state(false);

  $effect(() => {
    loadProviders();
  });

  async function loadProviders() {
    providersLoading = true;
    providersError = null;
    try {
      const data = await fetchProviders();
      providers = data;
      const enabled = data
        .filter((p) => p.enabled)
        .sort((a, b) => b.priority - a.priority);
      if (enabled.length > 0) {
        selectedProviderId = enabled[0].provider_id;
      } else if (data.length > 0) {
        selectedProviderId = data[0].provider_id;
      }
    } catch (err) {
      providersError =
        err instanceof Error ? err.message : "Failed to load providers";
    } finally {
      providersLoading = false;
    }
  }

  async function handleSearch() {
    if (!selectedProviderId || !query.trim()) return;
    searching = true;
    searchError = null;
    hasSearched = true;
    try {
      results = await searchProvider(
        selectedProviderId,
        query.trim(),
        entityType,
      );
    } catch (err) {
      searchError = err instanceof Error ? err.message : "Search failed";
      results = [];
    } finally {
      searching = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function subtitle(result: SearchResult): string | null {
    return (
      result.artist_name ??
      ("release_title" in result ? result.release_title : null) ??
      null
    );
  }

  function meta(result: SearchResult): string[] {
    const parts: string[] = [];
    if ("release_date" in result && result.release_date)
      parts.push(result.release_date);
    if ("genres" in result && result.genres?.length)
      parts.push(result.genres.join(", "));
    if ("duration_ms" in result && result.duration_ms != null) {
      const s = Math.round(result.duration_ms / 1000);
      parts.push(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    }
    if ("track" in result && result.track != null) {
      let t = `Track ${result.track}`;
      if (result.track_total != null) t += `/${result.track_total}`;
      if ("disc" in result && result.disc != null) {
        t += `, Disc ${result.disc}`;
        if (result.disc_total != null) t += `/${result.disc_total}`;
      }
      parts.push(t);
    }
    return parts;
  }

  let coverErrors = $state(new Set<string>());
  let applyingUrl = $state<string | null>(null);

  async function handleApply(result: SearchResult) {
    if (album.id == null || !selectedProviderId || !result.ids) return;
    applyingUrl = result.redirect_url;
    try {
      for (const [idType, idValue] of Object.entries(result.ids)) {
        await setExternalId(album.id, selectedProviderId, idType, idValue);
      }
      await refreshEntity(album.id);
      onclose();
    } catch {
      applyingUrl = null;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="dialog"
    tabindex="-1"
    aria-label="Search metadata"
    class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-[#1b1d1e] dark:shadow-black/50"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-neutral-900"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">
        Search metadata
      </h2>
      <button
        type="button"
        aria-label="Close"
        class="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        onclick={onclose}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
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

    <!-- Search form -->
    <form
      class="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-3 dark:border-neutral-900"
      onsubmit={(e) => {
        e.preventDefault();
        handleSearch();
      }}
    >
      <input
        type="text"
        bind:value={query}
        placeholder="Search query…"
        class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
      />
      <select
        bind:value={selectedProviderId}
        disabled={providersLoading}
        class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-200 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
      >
        {#each providers as provider}
          <option value={provider.provider_id}>{provider.display_name}</option>
        {/each}
      </select>
      <select
        bind:value={entityType}
        class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-200 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
      >
        <option value="release">Album</option>
        <option value="artist">Artist</option>
        <option value="track">Track</option>
      </select>
      <button
        type="submit"
        disabled={searching ||
          providersLoading ||
          !selectedProviderId ||
          !query.trim()}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      >
        Search
      </button>
    </form>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto px-5 py-3">
      {#if providersLoading}
        <div class="flex items-center justify-center py-8">
          <svg
            class="h-6 w-6 animate-spin text-slate-400 dark:text-neutral-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      {:else if providersError}
        <p class="py-4 text-center text-sm text-red-600 dark:text-red-400">
          {providersError}
        </p>
      {:else if searching}
        <div class="flex items-center justify-center py-8">
          <svg
            class="h-6 w-6 animate-spin text-slate-400 dark:text-neutral-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      {:else if searchError}
        <p class="py-4 text-center text-sm text-red-600 dark:text-red-400">
          {searchError}
        </p>
      {:else if hasSearched && results.length === 0}
        <p
          class="py-4 text-center text-sm text-slate-500 dark:text-neutral-400"
        >
          No results found.
        </p>
      {:else}
        <div class="space-y-3">
          {#each results as result}
            <article
              class="flex gap-3 overflow-hidden rounded-lg bg-slate-100 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
            >
              <!-- Cover thumbnail -->
              <div
                class="h-28 w-28 shrink-0 overflow-hidden bg-slate-200 dark:bg-neutral-600"
              >
                {#if result.cover_url && !coverErrors.has(result.redirect_url)}
                  <img
                    src={result.cover_url}
                    alt=""
                    class="h-full w-full object-cover"
                    onerror={() => {
                      coverErrors = new Set(coverErrors).add(
                        result.redirect_url,
                      );
                    }}
                  />
                {:else}
                  <div
                    class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-10 w-10"
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

              <!-- Text content -->
              <div
                class="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3"
              >
                <h3
                  class="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
                  title={result.title}
                >
                  {result.title}
                </h3>
                {#if subtitle(result)}
                  <p
                    class="truncate text-xs text-slate-500 dark:text-neutral-400"
                  >
                    {subtitle(result)}
                  </p>
                {/if}
                {#if meta(result).length > 0}
                  <p
                    class="mt-0.5 truncate text-xs text-slate-400 dark:text-neutral-500"
                  >
                    {meta(result).join(" \u00b7 ")}
                  </p>
                {/if}
                {#if "description" in result && result.description}
                  <p
                    class="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-neutral-400"
                  >
                    {result.description}
                  </p>
                {/if}

                <div class="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={applyingUrl != null ||
                      !result.ids ||
                      album.id == null}
                    class="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40 dark:text-neutral-200 dark:hover:text-white"
                    onclick={() => handleApply(result)}
                  >
                    {#if applyingUrl === result.redirect_url}
                      <svg
                        class="h-3 w-3 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        ></path>
                      </svg>
                      Applying…
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Apply
                    {/if}
                  </button>
                  <a
                    href={result.redirect_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View on provider
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
