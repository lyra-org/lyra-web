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
    deleteLibrary,
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
  let deleteError = $state<string | null>(null);
  let deletingLibrary = $state<LibraryResponse | null>(null);
  let deleteDialog: HTMLDialogElement;
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
    if (s.current) {
      return stageLabels[s.current.stage] ?? verb;
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

  function handleDelete(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    const id = lib.id;
    if (id == null || actioningId != null || isActiveSync(syncStatuses[id]))
      return;
    deleteError = null;
    deletingLibrary = lib;
    deleteDialog.showModal();
  }

  async function confirmDelete() {
    const id = deletingLibrary?.id;
    if (id == null || actioningId != null) return;
    actioningId = id;
    deleteError = null;
    try {
      await deleteLibrary(id);
      closeSyncRunStream(id);
      delete syncStatuses[id];
      libraries = libraries.filter((library) => library.id !== id);
      deleteDialog.close();
    } catch (err) {
      deleteError =
        err instanceof Error ? err.message : "Failed to delete library";
      statusRefreshNonce++;
    } finally {
      actioningId = null;
    }
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
          {@const status = lib.id != null ? syncStatuses[lib.id] : undefined}
          {@const label = syncLabel(status)}
          {@const completion = status ? syncCompletion(status) : null}
          <a
            href={lib.id != null ? `#/libraries/${lib.id}` : undefined}
            class="block"
          >
            <div
              class="relative flex items-center justify-between rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
            >
              <div class="min-w-0 flex-1">
                <h3
                  class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-900 dark:text-neutral-100"
                >
                  <span class="max-w-full min-w-0 truncate" title={lib.name}
                    >{lib.name}</span
                  >
                  {#if label}
                    <span
                      class="inline-flex max-w-full items-center gap-1.5 rounded bg-[#E6CEE3]/35 px-1.5 py-0.5 text-xs font-medium text-[#785473] dark:bg-[#BB7FB5]/10 dark:text-[#cfa2c9]"
                      title={status
                        ? `${settledUnits(status).toLocaleString()} steps processed${status.current?.subject ? ` · ${status.current.subject}` : ""}`
                        : undefined}
                    >
                      <span class="truncate"
                        >{completion != null &&
                        status?.run.status !== "cancelling"
                          ? status?.run.kind === "library_refresh"
                            ? "Refreshing"
                            : "Syncing"
                          : label}</span
                      >
                      {#if completion != null && status?.run.status !== "cancelling"}
                        <span class="shrink-0 tabular-nums"
                          >{completion.toFixed(1)}%</span
                        >
                      {/if}
                    </span>
                  {/if}
                </h3>
                <p
                  class="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400"
                >
                  <span
                    class="min-w-0 truncate"
                    title={lib.directory ?? undefined}>{lib.directory}</span
                  >
                  {#if lib.language || lib.country}
                    <span class="inline-flex shrink-0 items-center gap-2">
                      {#if lib.language}
                        <span>{lib.language}</span>
                      {/if}
                      {#if lib.country}
                        <span>{lib.country}</span>
                      {/if}
                    </span>
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
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isRunning || actioningId != null}
                    title={isRunning
                      ? "Wait for the current run to finish or cancel it before deleting this library"
                      : undefined}
                    class="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-neutral-600 dark:text-red-300 dark:hover:bg-red-950/30 dark:disabled:hover:bg-transparent"
                    onclick={(e) => handleDelete(lib, e)}
                  >
                    <svg
                      class="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                      />
                    </svg>
                    {actioningId === lib.id ? "Working…" : "Delete library"}
                  </button>
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<dialog
  bind:this={deleteDialog}
  aria-labelledby="delete-library-title"
  aria-describedby="delete-library-description"
  class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:shadow-black/50"
  oncancel={(e) => {
    if (actioningId != null) e.preventDefault();
  }}
  onclose={() => {
    deletingLibrary = null;
    deleteError = null;
  }}
>
  <div class="border-b border-slate-200 px-5 py-3 dark:border-neutral-900">
    <h2 id="delete-library-title" class="text-lg font-semibold">
      Delete library?
    </h2>
  </div>
  <div class="space-y-4 px-5 py-4">
    <p
      id="delete-library-description"
      class="text-sm text-slate-600 dark:text-neutral-300"
    >
      Delete “{deletingLibrary?.name}” and its indexed music from Lyra? Your
      music files will remain on disk. This cannot be undone.
    </p>
    {#if deleteError}
      <p role="alert" class="text-sm text-red-600 dark:text-red-400">
        {deleteError}
      </p>
    {/if}
    <div class="flex justify-end gap-2 pt-1">
      <button
        type="button"
        disabled={actioningId != null}
        class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={() => deleteDialog.close()}>Cancel</button
      >
      <button
        type="button"
        disabled={actioningId != null ||
          (deletingLibrary?.id != null &&
            isActiveSync(syncStatuses[deletingLibrary.id]))}
        class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
        onclick={confirmDelete}
        >{actioningId != null ? "Deleting…" : "Delete library"}</button
      >
    </div>
  </div>
</dialog>

{#if modalLibrary !== undefined}
  <LibraryModal
    library={modalLibrary}
    onclose={closeModal}
    onsave={handleSave}
  />
{/if}
