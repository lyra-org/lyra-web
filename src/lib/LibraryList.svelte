<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type {
    LibraryResponse,
    LibrarySyncRunKind,
    LibrarySyncStatus,
  } from "./types";
  import {
    ApiError,
    cancelSyncRun,
    deleteLibrary,
    fetchLibraries,
    refreshLibrary,
    startLibrarySync,
    streamSyncEvents,
  } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import LibraryModal from "./LibraryModal.svelte";
  import LibraryRunOptionsModal from "./LibraryRunOptionsModal.svelte";
  import Modal from "./Modal.svelte";
  import PurgeMissingModal from "./PurgeMissingModal.svelte";

  const SYNC_RETRY_BASE_MS = 1_000;
  const SYNC_RETRY_MAX_MS = 60_000;
  // A connection that stayed up this long counts as healthy, so the next
  // failure starts the backoff over.
  const SYNC_HEALTHY_AFTER_MS = 30_000;

  const auth = getAuth();
  const canManage = $derived(auth.hasPermission("manage_libraries"));

  let libraries: LibraryResponse[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  let modalLibrary = $state<LibraryResponse | null | undefined>(undefined);
  let syncStatuses = $state<Record<string, LibrarySyncStatus>>({});

  let openMenuId = $state<string | null>(null);
  let actioningId = $state<string | null>(null);
  let deleteError = $state<string | null>(null);
  let deletingLibrary = $state<LibraryResponse | null>(null);
  let purgingLibrary = $state<(LibraryResponse & { id: string }) | null>(null);
  let runOptions = $state<{
    library: LibraryResponse & { id: string };
    run: "sync" | "refresh";
  } | null>(null);

  // Each feed connection opens with every library's current status, which
  // replaces whatever an earlier connection left behind regardless of
  // sequence. Within one connection a library's sequence only grows.
  let connection = 0;
  const statusConnection = new Map<string, number>();

  async function load() {
    try {
      libraries = await fetchLibraries();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load libraries";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const controller = new AbortController();
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    async function follow() {
      connection++;
      const openedAt = Date.now();
      let received = false;
      try {
        await streamSyncEvents({
          signal: controller.signal,
          onStatus: (status) => {
            received = true;
            applySyncStatus(status);
          },
        });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          return;
        }
      }
      if (controller.signal.aborted || auth.token == null) return;

      if (received || Date.now() - openedAt >= SYNC_HEALTHY_AFTER_MS) {
        failures = 0;
      }
      const delay = Math.min(
        SYNC_RETRY_MAX_MS,
        SYNC_RETRY_BASE_MS * 2 ** failures,
      );
      failures++;
      retryTimeout = setTimeout(follow, delay * (0.5 + Math.random() / 2));
    }

    void follow();

    return () => {
      controller.abort();
      clearTimeout(retryTimeout);
    };
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
    metadata_parse: "Importing metadata",
    metadata_apply: "Importing metadata",
    provider_refresh: "Refreshing metadata",
    local_cover_metadata: "Reading covers",
    lyrics: "Refreshing lyrics",
    provider_cover: "Refreshing covers",
    cleanup: "Cleaning up",
    purge: "Purging",
  };

  const runVerbs: Record<LibrarySyncRunKind, string> = {
    library_sync: "Syncing",
    library_refresh: "Refreshing",
    library_purge: "Purging",
  };

  const runNouns: Record<LibrarySyncRunKind, string> = {
    library_sync: "sync",
    library_refresh: "refresh",
    library_purge: "purge",
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
    if (
      current != null &&
      statusConnection.get(libraryId) === connection &&
      status.sequence < current.sequence
    ) {
      return;
    }

    statusConnection.set(libraryId, connection);
    syncStatuses = { ...syncStatuses, [libraryId]: status };
  }

  const languageNames = new Intl.DisplayNames(undefined, {
    type: "language",
  });
  const regionNames = new Intl.DisplayNames(undefined, { type: "region" });

  function displayName(names: Intl.DisplayNames, code: string): string {
    try {
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  }

  function localeParts(lib: LibraryResponse): string[] {
    const parts: string[] = [];
    if (lib.language) parts.push(displayName(languageNames, lib.language));
    if (lib.country) parts.push(displayName(regionNames, lib.country));
    return parts;
  }

  function syncLabel(s: LibrarySyncStatus | undefined): string | null {
    if (!isActiveSync(s) || !s) return null;
    if (s.run.status === "cancelling") return "Cancelling";

    const verb = runVerbs[s.run.kind];
    if (s.current) {
      return stageLabels[s.current.stage] ?? verb;
    }

    if (s.run.status === "planning" || s.progress.mode === "estimating") {
      return `Planning ${runNouns[s.run.kind]}`;
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

  function handlePurge(lib: LibraryResponse, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    const id = lib.id;
    if (id != null) purgingLibrary = { ...lib, id };
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
  }

  function closeDeleteModal() {
    if (actioningId != null) return;
    deletingLibrary = null;
    deleteError = null;
  }

  async function confirmDelete() {
    const id = deletingLibrary?.id;
    if (id == null || actioningId != null) return;
    actioningId = id;
    deleteError = null;
    try {
      await deleteLibrary(id);
      delete syncStatuses[id];
      statusConnection.delete(id);
      libraries = libraries.filter((library) => library.id !== id);
      deletingLibrary = null;
    } catch (err) {
      deleteError =
        err instanceof Error ? err.message : "Failed to delete library";
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
    } catch {
      // refresh failed — spinner stops regardless
    } finally {
      actioningId = null;
    }
  }

  function handleRunOptions(
    lib: LibraryResponse,
    run: "sync" | "refresh",
    e: MouseEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    openMenuId = null;
    const id = lib.id;
    if (id == null) return;
    runOptions = { library: { ...lib, id }, run };
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
  <div class="mx-auto max-w-5xl">
    {#if libraries.length === 0}
      <div class="py-20 text-center">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-neutral-100">
          Your library is empty
        </h2>
        {#if canManage}
          <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            Point Lyra at a folder of music to start listening.
          </p>
          <button
            class="mt-6 rounded-md bg-[#E6CEE3] px-5 py-2 text-base font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
            onclick={openCreate}
          >
            Add your first library
          </button>
        {:else}
          <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            No libraries have been shared with you yet.
          </p>
        {/if}
      </div>
    {:else}
      {#if canManage}
        <div class="mb-4 flex items-center justify-end">
          <button
            class="rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
            onclick={openCreate}
          >
            + New library
          </button>
        </div>
      {/if}

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each libraries as lib (lib.id ?? lib.name)}
          {@const status = lib.id != null ? syncStatuses[lib.id] : undefined}
          {@const label = syncLabel(status)}
          {@const completion = status ? syncCompletion(status) : null}
          {@const locale = localeParts(lib)}
          <a
            href={lib.id != null ? `#/libraries/${lib.id}` : undefined}
            class="block"
          >
            <div
              class="relative flex h-full items-start justify-between overflow-visible rounded-lg bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
            >
              <div class="min-w-0 flex-1 py-0.5">
                <h3
                  class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100"
                >
                  <span class="min-w-0 truncate" title={lib.name}
                    >{lib.name}</span
                  >
                  {#if label}
                    <span
                      class="inline-flex shrink-0 items-center gap-1.5 rounded bg-[#E6CEE3]/35 px-1.5 py-0.5 text-xs font-medium text-[#785473] dark:bg-[#BB7FB5]/10 dark:text-[#cfa2c9]"
                      title={status
                        ? `${settledUnits(status).toLocaleString()} steps processed${status.current?.subject ? ` · ${status.current.subject}` : ""}`
                        : undefined}
                    >
                      <span
                        >{completion != null &&
                        status?.run.status !== "cancelling"
                          ? status && runVerbs[status.run.kind]
                          : label}</span
                      >
                      {#if completion != null && status?.run.status !== "cancelling"}
                        <span class="tabular-nums"
                          >{completion.toFixed(1)}%</span
                        >
                      {/if}
                    </span>
                  {/if}
                </h3>
                {#if lib.directory || locale.length > 0}
                  <p
                    class="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400"
                  >
                    {#if lib.directory}
                      <span class="min-w-0 truncate" title={lib.directory}
                        >{lib.directory}</span
                      >
                    {/if}
                    {#each locale as part, i (i)}
                      {#if lib.directory || i > 0}
                        <span aria-hidden="true">·</span>
                      {/if}
                      <span class="shrink-0">{part}</span>
                    {/each}
                  </p>
                {/if}
              </div>
              {#if label && completion != null && status?.run.status !== "cancelling"}
                <div
                  class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg"
                  aria-hidden="true"
                >
                  <div
                    class="h-full bg-[#BB7FB5] transition-[width] duration-300 dark:bg-[#cfa2c9]"
                    style:width="{completion}%"
                  ></div>
                </div>
              {/if}
              {#if canManage}
                <button
                  type="button"
                  aria-label="Library actions"
                  class="-mr-1.5 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
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
                    class="absolute top-11 right-2 z-10 min-w-44 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
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
                      onclick={(e) => handlePurge(lib, e)}
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
                          d="M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"
                        />
                      </svg>
                      Purge missing
                    </button>
                    <div
                      class={[
                        "flex items-center",
                        !isRunning &&
                          "hover:bg-slate-100 dark:hover:bg-neutral-600",
                      ]}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isRunning}
                        class="flex flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200"
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
                        class="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-500 dark:hover:bg-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:bg-transparent"
                        title="Sync with options…"
                        aria-label="Sync with options…"
                        onclick={(e) => handleRunOptions(lib, "sync", e)}
                      >
                        <svg
                          class="h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="1.75"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                          />
                        </svg>
                      </button>
                    </div>
                    <div
                      class={[
                        "flex items-center",
                        !isRunning &&
                          "hover:bg-slate-100 dark:hover:bg-neutral-600",
                      ]}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isRunning}
                        class="flex flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200"
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
                        {isRunning
                          ? "Refresh in progress…"
                          : "Refresh metadata"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isRunning}
                        class="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-500 dark:hover:bg-neutral-500 dark:hover:text-neutral-100 dark:disabled:hover:bg-transparent"
                        title="Refresh with options…"
                        aria-label="Refresh with options…"
                        onclick={(e) => handleRunOptions(lib, "refresh", e)}
                      >
                        <svg
                          class="h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="1.75"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                          />
                        </svg>
                      </button>
                    </div>
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
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if deletingLibrary}
  <Modal title="Delete library?" width="narrow" onclose={closeDeleteModal}>
    <p class="text-sm text-slate-600 dark:text-neutral-300">
      Delete “{deletingLibrary.name}” and its indexed music from Lyra? Your
      music files will remain on disk. This cannot be undone.
    </p>
    {#if deleteError}
      <p role="alert" class="text-sm text-red-600 dark:text-red-400">
        {deleteError}
      </p>
    {/if}

    {#snippet footer()}
      <button
        type="button"
        disabled={actioningId != null}
        class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={closeDeleteModal}>Cancel</button
      >
      <button
        type="button"
        disabled={actioningId != null ||
          (deletingLibrary?.id != null &&
            isActiveSync(syncStatuses[deletingLibrary.id]))}
        class="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
        onclick={confirmDelete}
        >{actioningId != null ? "Deleting…" : "Delete library"}</button
      >
    {/snippet}
  </Modal>
{/if}

{#if purgingLibrary}
  <PurgeMissingModal
    libraryId={purgingLibrary.id}
    libraryName={purgingLibrary.name}
    onstarted={(response) => applySyncStatus(response.run)}
    onclose={() => (purgingLibrary = null)}
  />
{/if}

{#if runOptions}
  <LibraryRunOptionsModal
    library={runOptions.library}
    run={runOptions.run}
    onstarted={(response) => {
      applySyncStatus(response.run);
    }}
    onclose={() => (runOptions = null)}
  />
{/if}

{#if modalLibrary !== undefined}
  <LibraryModal
    library={modalLibrary}
    onclose={closeModal}
    onsave={handleSave}
  />
{/if}
