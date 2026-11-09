<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    CoverCandidateResponse,
    CoverCandidatesResponse,
    CoverOwnerKind,
    ProviderCoverSearchResponse,
    StoredCoverSource,
  } from "./types";
  import {
    ApiError,
    applyProviderCover,
    clearCoverPin,
    fetchCoverCandidates,
    fetchProviders,
    pinCoverSource,
    removeManualCover,
    searchCovers,
    uploadManualCover,
  } from "./api";
  import { setShownCover } from "./covers.svelte.ts";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    kind: CoverOwnerKind;
    entityId: string;
    name: string;
    onclose: () => void;
  }

  let { kind, entityId, name, onclose }: Props = $props();

  // The server's upload limits.
  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
  const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

  // Stored covers in the order the server picks them when none is pinned.
  const SOURCE_ORDER: StoredCoverSource[] = ["manual", "provider", "local"];

  type Action =
    | "upload"
    | "remove"
    | "clear"
    | "provider"
    | `pin:${StoredCoverSource}`;

  let noun = $derived(kind === "artist" ? "artist" : "album");

  let stored = $state<CoverCandidatesResponse | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  let busy = $state<Action | null>(null);
  let error = $state<{ message: string; detail?: string } | null>(null);

  let providerNames = $state<Record<string, string>>({});
  let results = $state<ProviderCoverSearchResponse[] | null>(null);
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let chosen = $state<{ providerId: string; url: string } | null>(null);

  let fileInput = $state<HTMLInputElement>();

  let candidates = $derived(
    (stored?.candidates ?? [])
      .filter(
        (c): c is CoverCandidateResponse & { source: StoredCoverSource } =>
          c.source !== "generated",
      )
      .sort(
        (a, b) =>
          SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source),
      ),
  );
  let selection = $derived(stored?.selection ?? null);
  let hasManual = $derived(candidates.some((c) => c.source === "manual"));
  let resultCount = $derived(
    results?.reduce((n, r) => n + r.candidates.length, 0) ?? 0,
  );

  $effect(() => {
    loadCandidates();
    search(false);
    loadProviderNames();
  });

  async function loadCandidates() {
    loading = true;
    loadError = null;
    try {
      stored = await fetchCoverCandidates(kind, entityId);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load covers";
    } finally {
      loading = false;
    }
  }

  // Names are a nicety; provider ids stand in when they fail to load.
  async function loadProviderNames() {
    try {
      const providers = await fetchProviders();
      providerNames = Object.fromEntries(
        providers.map((p) => [p.provider_id, p.display_name]),
      );
    } catch {
      providerNames = {};
    }
  }

  async function search(bypassCoverCache: boolean) {
    searching = true;
    searchError = null;
    chosen = null;
    try {
      const res = await searchCovers(
        kind,
        entityId,
        undefined,
        bypassCoverCache,
      );
      results = res.results;
      for (const result of res.results) {
        const i = autoPickIndex(result);
        if (i != null) {
          chosen = {
            providerId: result.provider_id,
            url: result.candidates[i].url,
          };
          break;
        }
      }
    } catch (err) {
      searchError = err instanceof Error ? err.message : "Search failed";
    } finally {
      searching = false;
    }
  }

  // The candidate a refresh or sync downloads from this provider. The server's
  // `selected_index` counts from 1; 0 or out of range picks none.
  function autoPickIndex(result: ProviderCoverSearchResponse): number | null {
    const i = (result.selected_index ?? 0) - 1;
    return i >= 0 && i < result.candidates.length ? i : null;
  }

  function providerName(id: string | null | undefined): string {
    if (!id) return "Provider";
    return providerNames[id] ?? id;
  }

  const sourceLabels: Record<StoredCoverSource, string> = {
    manual: "Uploaded",
    provider: "Provider",
    local: "Library file",
  };
  const pinLabels: Record<StoredCoverSource, string> = {
    manual: "uploaded",
    provider: "provider",
    local: "library file's",
  };

  function sourceLabel(c: { source: StoredCoverSource }): string {
    return sourceLabels[c.source];
  }

  function describeError(err: unknown, action: Action) {
    if (!(err instanceof ApiError)) {
      return {
        message: err instanceof Error ? err.message : "The request failed.",
      };
    }
    const detail = err.message;
    switch (err.status) {
      case 400:
        if (action === "upload") {
          return {
            message: "The file isn't a readable JPEG, PNG or WebP image.",
            detail,
          };
        }
        if (action === "provider") {
          return {
            message:
              "The provider no longer offers that image. Search again and pick another.",
            detail,
          };
        }
        break;
      case 403:
        return { message: `You can't change this ${noun}'s cover.`, detail };
      case 404:
        if (action === "remove") {
          return { message: "There's no uploaded cover to remove.", detail };
        }
        break;
      case 409:
        return {
          message: "There's no longer a cover from that source to pin.",
          detail,
        };
      case 413:
        return { message: "The image is over the 20 MiB limit.", detail };
      case 415:
        return {
          message: "Only JPEG, PNG and WebP images can be uploaded.",
          detail,
        };
      case 502:
        return {
          message:
            "The image couldn't be downloaded from the provider. Pick another or search again.",
          detail,
        };
    }
    return { message: detail };
  }

  // Each write answers with the updated candidates; show them, and the cover
  // the entity now shows wherever it's on screen.
  async function run(
    action: Action,
    write: () => Promise<CoverCandidatesResponse>,
  ) {
    busy = action;
    error = null;
    try {
      const res = await write();
      stored = res;
      setShownCover(
        entityId,
        res.candidates.find((c) => c.active)?.cover ?? null,
      );
    } catch (err) {
      error = describeError(err, action);
      // The stored covers changed under us; show what's there now.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409))
        loadCandidates();
    } finally {
      busy = null;
    }
  }

  function handleFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type)) {
      error = { message: "Only JPEG, PNG and WebP images can be uploaded." };
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      error = {
        message: `The image is ${(file.size / 1024 / 1024).toFixed(1)} MiB, over the 20 MiB limit.`,
      };
      return;
    }
    run("upload", () => uploadManualCover(kind, entityId, file));
  }

  function applyChosen() {
    if (!chosen) return;
    const { providerId, url } = chosen;
    run("provider", () => applyProviderCover(kind, entityId, providerId, url));
  }

  function formatSize(width?: number | null, height?: number | null) {
    return width != null && height != null ? `${width} × ${height}` : null;
  }

  const buttonClass =
    "rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-200 dark:ring-neutral-600 dark:hover:bg-neutral-700";
  const badgeClass = "rounded px-1.5 py-0.5 text-[11px] font-medium";
  const headingClass =
    "text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500";
</script>

{#snippet spinner(size: string)}
  <svg
    class="{size} animate-spin"
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
{/snippet}

<Modal title="Change cover" subtitle={name} width="wide" {onclose}>
  <section aria-labelledby="stored-covers">
    <div class="mb-2 flex items-center justify-between gap-3">
      <h3 id="stored-covers" class={headingClass}>Stored covers</h3>
      {#if selection}
        <button
          type="button"
          class={buttonClass}
          disabled={busy != null}
          onclick={() => run("clear", () => clearCoverPin(kind, entityId))}
        >
          {busy === "clear" ? "Unpinning…" : "Unpin"}
        </button>
      {/if}
    </div>
    {#if !loading && !loadError}
      <p class="mb-3 text-xs text-slate-500 dark:text-neutral-400">
        {#if selection}
          Pinned to the {pinLabels[selection]} cover. Automatic syncs won't change
          it.
        {:else}
          Shows the uploaded cover, else the provider's, else the library
          file's. Pin one to keep it.
        {/if}
      </p>
    {/if}

    {#if loading}
      <div
        class="flex items-center justify-center py-8 text-slate-400 dark:text-neutral-500"
      >
        {@render spinner("h-6 w-6")}
      </div>
    {:else if loadError}
      <p class="py-4 text-center text-sm text-red-600 dark:text-red-400">
        {loadError}
      </p>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {#each candidates as c (c.source)}
          <div class="flex flex-col">
            <div
              class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 dark:bg-neutral-600"
              class:ring-2={c.active}
              class:ring-[#BB7FB5]={c.active}
            >
              {#if c.cover.blurhash}
                <BlurhashCanvas
                  hash={c.cover.blurhash}
                  class="absolute inset-0 h-full w-full object-cover"
                />
              {/if}
              {#if c.available}
                <img
                  src={c.cover.url}
                  alt="{sourceLabel(c)} cover"
                  class="relative h-full w-full object-cover text-transparent"
                />
              {:else}
                <div
                  class="relative flex h-full w-full items-center justify-center bg-black/40 px-2 text-center text-xs font-medium text-white"
                >
                  Image file missing
                </div>
              {/if}
              <div class="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                {#if c.active}
                  <span class="{badgeClass} bg-[#BB7FB5] text-white"
                    >Showing</span
                  >
                {/if}
                {#if selection === c.source}
                  <span class="{badgeClass} bg-slate-900/70 text-white"
                    >Pinned</span
                  >
                {/if}
              </div>
            </div>
            <p
              class="mt-1.5 truncate text-sm font-medium text-slate-800 dark:text-neutral-100"
            >
              {sourceLabel(c)}
            </p>
            <p class="truncate text-xs text-slate-500 dark:text-neutral-400">
              {#if c.source === "provider"}
                {providerName(c.provider_id)}
              {:else if !c.available}
                Missing
              {:else}
                {c.cover.mime_type.replace("image/", "").toUpperCase()}
              {/if}
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              {#if selection !== c.source}
                <button
                  type="button"
                  class={buttonClass}
                  disabled={busy != null || !c.available}
                  title={c.available ? undefined : "The image file is missing"}
                  onclick={() =>
                    run(`pin:${c.source}`, () =>
                      pinCoverSource(kind, entityId, c.source),
                    )}
                >
                  {busy === `pin:${c.source}` ? "Pinning…" : "Pin"}
                </button>
              {/if}
              {#if c.source === "manual"}
                <button
                  type="button"
                  class="{buttonClass} text-red-600! dark:text-red-400!"
                  disabled={busy != null}
                  onclick={() =>
                    run("remove", () => removeManualCover(kind, entityId))}
                >
                  {busy === "remove" ? "Removing…" : "Remove"}
                </button>
              {/if}
            </div>
          </div>
        {/each}

        <div class="flex flex-col">
          <button
            type="button"
            class="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-200"
            disabled={busy != null}
            onclick={() => fileInput?.click()}
          >
            {#if busy === "upload"}
              {@render spinner("h-6 w-6")}
              Uploading…
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {hasManual ? "Replace upload" : "Upload image"}
            {/if}
          </button>
          <p class="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
            JPEG, PNG or WebP, up to 20 MiB. Uploading pins it.
          </p>
          <input
            bind:this={fileInput}
            type="file"
            accept={UPLOAD_TYPES.join(",")}
            class="hidden"
            onchange={handleFile}
          />
        </div>
      </div>
    {/if}
  </section>

  {#if error}
    <div
      role="alert"
      class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      <p>{error.message}</p>
      {#if error.detail && error.detail !== error.message}
        <p class="mt-0.5 text-xs opacity-80">{error.detail}</p>
      {/if}
    </div>
  {/if}

  <section aria-labelledby="provider-covers" class="pt-2">
    <div class="mb-2 flex items-center justify-between gap-3">
      <h3 id="provider-covers" class={headingClass}>Provider images</h3>
      <button
        type="button"
        class={buttonClass}
        disabled={searching}
        title="Look images up again instead of using cached lookups"
        onclick={() => search(true)}
      >
        Search again
      </button>
    </div>

    {#if searching}
      <div
        class="flex items-center justify-center py-8 text-slate-400 dark:text-neutral-500"
      >
        {@render spinner("h-6 w-6")}
      </div>
    {:else if searchError}
      <p class="py-4 text-center text-sm text-red-600 dark:text-red-400">
        {searchError}
      </p>
    {:else if results && resultCount === 0}
      <p class="py-4 text-center text-sm text-slate-500 dark:text-neutral-400">
        No provider has images for this {noun}.
      </p>
    {:else if results}
      <div class="space-y-4">
        {#each results.filter((r) => r.candidates.length > 0) as result (result.provider_id)}
          {@const autoPick = autoPickIndex(result)}
          <div>
            <p
              class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
            >
              {providerName(result.provider_id)}
            </p>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {#each result.candidates as candidate, i (candidate.url)}
                {@const selected =
                  chosen?.providerId === result.provider_id &&
                  chosen.url === candidate.url}
                {@const size = formatSize(candidate.width, candidate.height)}
                <button
                  type="button"
                  class="group flex flex-col text-left disabled:opacity-50"
                  aria-pressed={selected}
                  disabled={busy != null}
                  onclick={() =>
                    (chosen = {
                      providerId: result.provider_id,
                      url: candidate.url,
                    })}
                >
                  <div
                    class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200 ring-offset-2 dark:bg-neutral-600 dark:ring-offset-[#1b1d1e]"
                    class:ring-2={selected}
                    class:ring-[#BB7FB5]={selected}
                  >
                    <img
                      src={candidate.url}
                      alt="{providerName(result.provider_id)} image {i + 1}"
                      class="h-full w-full object-cover text-transparent transition-transform group-hover:scale-105"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                    />
                    {#if autoPick === i}
                      <span
                        class="{badgeClass} absolute top-1.5 left-1.5 bg-slate-900/70 text-white"
                        title="The image a refresh or sync downloads from this provider"
                        >Sync's pick</span
                      >
                    {/if}
                    {#if busy === "provider" && selected}
                      <div
                        class="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
                      >
                        {@render spinner("h-6 w-6")}
                      </div>
                    {/if}
                  </div>
                  {#if size}
                    <span
                      class="mt-1 truncate text-xs text-slate-500 dark:text-neutral-400"
                      >{size}</span
                    >
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Done
    </button>
    <button
      type="button"
      disabled={!chosen || busy != null}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={applyChosen}
    >
      {busy === "provider" ? "Downloading…" : "Use selected image"}
    </button>
  {/snippet}
</Modal>
