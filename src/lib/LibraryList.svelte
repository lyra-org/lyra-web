<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onDestroy } from "svelte";
  import type { LibraryResponse, LibrarySyncStatus } from "./types";
  import {
    cancelSyncRun,
    fetchLibraries,
    fetchLibrarySyncStatus,
    refreshLibrary,
    startLibrarySync,
    streamSyncRun,
  } from "./api";
  import LibraryModal from "./LibraryModal.svelte";

  const SYNC_RECONNECT_DELAY_MS = 1500;

  let libraries: LibraryResponse[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  let modalLibrary = $state<LibraryResponse | null | undefined>(undefined);
  let syncStatuses = $state<Record<string, LibrarySyncStatus>>({});

  let openMenuId = $state<string | null>(null);
  let actioningId = $state<string | null>(null);
  let statusRefreshNonce = $state(0);

  interface SyncRunStream {
    runId: string;
    controller: AbortController;
    retryTimeout: ReturnType<typeof setTimeout> | null;
  }

  const syncRunStreams = new Map<string, SyncRunStream>();

  async function load() {
    try {
      libraries = await fetchLibraries();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load libraries";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    statusRefreshNonce;
    const ids = libraries
      .map((l) => l.id)
      .filter((id): id is string => id != null);
    if (ids.length === 0) return;

    let cancelled = false;

    async function refreshStatuses() {
      const results = await Promise.allSettled(
        ids.map(async (id) => ({
          id,
          status: await fetchLibrarySyncStatus(id),
        })),
      );
      if (cancelled) return;
      for (const r of results) {
        if (r.status === "fulfilled") applySyncStatus(r.value.status);
      }
    }

    refreshStatuses();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    synchronizeSyncRunStreams(syncStatuses);
  });

  onDestroy(() => {
    for (const libraryId of Array.from(syncRunStreams.keys())) {
      closeSyncRunStream(libraryId);
    }
  });

  function isActiveSync(s: LibrarySyncStatus | undefined): boolean {
    return (
      s?.run.status === "queued" ||
      s?.run.status === "planning" ||
      s?.run.status === "running" ||
      s?.run.status === "cancelling"
    );
  }

  const stageLabels: Record<string, string> = {
    discover: "Discovering",
    entry_sync: "Scanning",
    metadata_parse: "Reading metadata",
    metadata_apply: "Updating library",
    provider_refresh: "Refreshing metadata",
    local_cover_metadata: "Reading covers",
    lyrics: "Refreshing lyrics",
    provider_cover: "Refreshing covers",
    cleanup: "Cleaning up",
  };

  function settledUnits(s: LibrarySyncStatus): number {
    return (
      s.progress.completed_units +
      s.progress.failed_units +
      s.progress.skipped_units
    );
  }

  function syncCompletion(s: LibrarySyncStatus): number | null {
    if (s.progress.mode !== "determinate" || s.progress.total_units <= 0) {
      return null;
    }

    return Math.max(
      0,
      Math.min(100, (settledUnits(s) / s.progress.total_units) * 100),
    );
  }

  function applySyncStatus(status: LibrarySyncStatus) {
    const libraryId = status.run.library_id;
    const current = syncStatuses[libraryId];
    const currentStartedAt = Date.parse(current?.run.started_at ?? "");
    const nextStartedAt = Date.parse(status.run.started_at ?? "");
    if (
      current != null &&
      ((current.run.id === status.run.id &&
        status.sequence < current.sequence) ||
        (current.run.id !== status.run.id &&
          Number.isFinite(currentStartedAt) &&
          Number.isFinite(nextStartedAt) &&
          currentStartedAt > nextStartedAt))
    ) {
      return;
    }

    syncStatuses = { ...syncStatuses, [libraryId]: status };
  }

  function synchronizeSyncRunStreams(
    statuses: Record<string, LibrarySyncStatus>,
  ) {
    const activeLibraryIds = new Set<string>();

    for (const [libraryId, status] of Object.entries(statuses)) {
      const runId = status.run.id;
      if (!isActiveSync(status) || runId == null) continue;

      activeLibraryIds.add(libraryId);
      const current = syncRunStreams.get(libraryId);
      if (current?.runId === runId) continue;

      closeSyncRunStream(libraryId);
      openSyncRunStream(libraryId, runId, status.sequence);
    }

    for (const libraryId of Array.from(syncRunStreams.keys())) {
      if (!activeLibraryIds.has(libraryId)) {
        closeSyncRunStream(libraryId);
      }
    }
  }

  function openSyncRunStream(libraryId: string, runId: string, after: number) {
    const stream: SyncRunStream = {
      runId,
      controller: new AbortController(),
      retryTimeout: null,
    };
    syncRunStreams.set(libraryId, stream);

    void streamSyncRun(runId, {
      after,
      signal: stream.controller.signal,
      onSnapshot: applySyncStatus,
    }).then(
      () => scheduleSyncRunReconnect(libraryId, stream),
      () => scheduleSyncRunReconnect(libraryId, stream),
    );
  }

  function scheduleSyncRunReconnect(libraryId: string, stream: SyncRunStream) {
    if (
      stream.controller.signal.aborted ||
      syncRunStreams.get(libraryId) !== stream
    ) {
      return;
    }

    const status = syncStatuses[libraryId];
    if (!isActiveSync(status) || status.run.id !== stream.runId) {
      closeSyncRunStream(libraryId);
      return;
    }

    stream.retryTimeout = setTimeout(() => {
      if (syncRunStreams.get(libraryId) !== stream) return;
      const latestStatus = syncStatuses[libraryId];
      syncRunStreams.delete(libraryId);
      openSyncRunStream(
        libraryId,
        stream.runId,
        latestStatus?.sequence ?? status.sequence,
      );
    }, SYNC_RECONNECT_DELAY_MS);
  }

  function closeSyncRunStream(libraryId: string) {
    const stream = syncRunStreams.get(libraryId);
    if (stream == null) return;
    if (stream.retryTimeout != null) clearTimeout(stream.retryTimeout);
    stream.controller.abort();
    syncRunStreams.delete(libraryId);
  }

  function syncLabel(s: LibrarySyncStatus | undefined): string | null {
    if (!isActiveSync(s) || !s) return null;
    if (s.run.status === "cancelling") return "Cancelling";

    const verb = s.run.kind === "library_refresh" ? "Refreshing" : "Syncing";
    const completion = syncCompletion(s);
    if (completion != null) {
      return `${verb} ${completion.toFixed(1)}%`;
    }

    if (s.current) {
      const stage = stageLabels[s.current.stage] ?? verb;
      const subject = s.current.subject ?? null;
      return subject ? `${stage}: ${subject}` : stage;
    }

    if (s.run.status === "planning" || s.progress.mode === "estimating") {
      return s.run.kind === "library_refresh"
        ? "Planning refresh"
        : "Planning sync";
    }
    return verb;
  }

  function openCreate() {
    modalLibrary = null;
  }

  function closeModal() {
    modalLibrary = undefined;
  }

  async function handleSave(saved: LibraryResponse) {
    const exists = libraries.some((l) => l.id === saved.id);
    libraries = exists
      ? libraries.map((l) => (l.id === saved.id ? saved : l))
      : [...libraries, saved];
    modalLibrary = undefined;
  }

  function toggleMenu(libId: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = openMenuId === libId ? null : libId;
  }

  function handleWindowClick() {
    if (openMenuId != null) openMenuId = null;
  }

  function handleEdit(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    modalLibrary = lib;
  }

  async function handleSyncLibrary(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    if (lib.id == null) return;
    actioningId = lib.id;
    try {
      const response = await startLibrarySync(lib.id);
      applySyncStatus(response.run);
      statusRefreshNonce++;
    } catch {
      // sync start failed — spinner stops regardless
    } finally {
      actioningId = null;
    }
  }

  async function handleRefreshMetadata(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    if (lib.id == null) return;
    actioningId = lib.id;
    try {
      const response = await refreshLibrary(lib.id);
      applySyncStatus(response.run);
      statusRefreshNonce++;
    } catch {
      // refresh failed — spinner stops regardless
    } finally {
      actioningId = null;
    }
  }

  async function handleCancelSync(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    if (lib.id == null) return;
    const runId = syncStatuses[lib.id]?.run.id;
    if (runId == null) return;
    actioningId = lib.id;
    try {
      const status = await cancelSyncRun(runId);
      applySyncStatus(status);
      statusRefreshNonce++;
    } catch {
      // cancel failed — spinner stops regardless
    } finally {
      actioningId = null;
    }
  }

  load();
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
  </div>
{:else}
  <div class="mx-auto max-w-3xl">
    {#if libraries.length === 0}
      <div class="py-20 text-center">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-neutral-100">
          Your library is empty
        </h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          Point Lyra at a folder of music to start listening.
        </p>
        <button
          class="mt-6 rounded-md bg-[#E6CEE3] px-5 py-2 text-base font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
          onclick={openCreate}
        >
          Add your first library
        </button>
      </div>
    {:else}
      <div class="mb-4 flex items-center justify-end">
        <button
          class="rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
          onclick={openCreate}
        >
          + New library
        </button>
      </div>

      <div class="space-y-2">
        {#each libraries as lib (lib.id ?? lib.name)}
          <a
            href={lib.id != null ? `#/libraries/${lib.id}` : undefined}
            class="block"
          >
            <div
              class="relative flex items-center justify-between rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
            >
              <div class="min-w-0 flex-1">
                <h3
                  class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100"
                >
                  <span class="truncate">{lib.name}</span>
                  {#if lib.id != null}
                    {@const label = syncLabel(syncStatuses[lib.id])}
                    {#if label}
                      <span
                        class="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      >
                        {label}
                      </span>
                    {/if}
                  {/if}
                </h3>
                <p
                  class="truncate text-xs text-slate-500 dark:text-neutral-400"
                >
                  {lib.directory}
                  {#if lib.language || lib.country}
                    <span class="text-slate-300 dark:text-neutral-600"
                      >&middot;</span
                    >
                    {#if lib.language}
                      <span
                        class="ml-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-[#1b1d1e] dark:text-neutral-300"
                        >{lib.language}</span
                      >
                    {/if}
                    {#if lib.country}
                      <span
                        class="ml-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-[#1b1d1e] dark:text-neutral-300"
                        >{lib.country}</span
                      >
                    {/if}
                  {/if}
                </p>
              </div>
              <button
                type="button"
                aria-label="Library actions"
                class="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                onclick={(e) => lib.id != null && toggleMenu(lib.id, e)}
              >
                {#if actioningId === lib.id}
                  <svg
                    class="h-4 w-4 animate-spin"
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
                {:else}
                  <svg
                    class="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                {/if}
              </button>

              {#if lib.id != null && openMenuId === lib.id}
                {@const currentSync = syncStatuses[lib.id]}
                {@const isRunning = isActiveSync(currentSync)}
                {@const canCancel =
                  isRunning &&
                  currentSync?.run.id != null &&
                  currentSync.run.status !== "cancelling"}
                <div
                  role="menu"
                  tabindex="-1"
                  class="absolute top-12 right-3 z-10 min-w-44 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-600"
                    onclick={(e) => handleEdit(lib, e)}
                  >
                    <svg
                      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"
                      />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isRunning}
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-200 dark:hover:bg-neutral-600 dark:disabled:hover:bg-transparent"
                    onclick={(e) => handleSyncLibrary(lib, e)}
                  >
                    <svg
                      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0113.292-4.708M20 15a8 8 0 01-13.292 4.708"
                      />
                    </svg>
                    {isRunning ? "Sync in progress…" : "Sync library"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isRunning}
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-200 dark:hover:bg-neutral-600 dark:disabled:hover:bg-transparent"
                    onclick={(e) => handleRefreshMetadata(lib, e)}
                  >
                    <svg
                      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                      />
                    </svg>
                    {isRunning ? "Refresh in progress…" : "Refresh metadata"}
                  </button>
                  {#if canCancel}
                    <button
                      type="button"
                      role="menuitem"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                      onclick={(e) => handleCancelSync(lib, e)}
                    >
                      <svg
                        class="h-4 w-4 text-red-400 dark:text-red-300"
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
                      Cancel run
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if modalLibrary !== undefined}
  <LibraryModal
    library={modalLibrary}
    onclose={closeModal}
    onsave={handleSave}
  />
{/if}
