<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type { LibraryResponse, LibrarySyncStatus } from "./types";
  import { cancelSyncRun, fetchLibrarySyncRuns } from "./api";
  import {
    failedItems,
    isActiveSync,
    runDuration,
    runHistoryTitle,
    runResult,
    runTitle,
    syncCompletion,
    syncLabel,
    timeAgo,
  } from "./librarySync";
  import LibraryRunOptionsModal from "./LibraryRunOptionsModal.svelte";
  import Modal from "./Modal.svelte";
  import SyncRunFailures from "./SyncRunFailures.svelte";

  interface Props {
    library: LibraryResponse & { id: string };
    // The library's newest status from the live feed.
    status: LibrarySyncStatus | undefined;
    onstatus: (status: LibrarySyncStatus) => void;
    onclose: () => void;
  }

  let { library, status, onstatus, onclose }: Props = $props();

  const columns =
    "grid grid-cols-[minmax(0,1fr)_6.5rem_1rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_3rem_1rem]";

  let loaded = $state<LibrarySyncStatus[] | null>(null);
  let error = $state<string | null>(null);
  let expandedRunId = $state<string | null>(null);
  let cancelling = $state(false);
  let rerun = $state<"sync" | "refresh" | null>(null);

  onMount(() => {
    const controller = new AbortController();
    fetchLibrarySyncRuns(library.id, controller.signal)
      .then((fetched) => {
        loaded = fetched;
        // Opening the history after a bad run is usually to see what went wrong.
        const newest = fetched[0];
        const result = newest ? runResult(newest) : null;
        if (newest && (result === "failed" || result === "partial")) {
          expandedRunId = newest.run.id ?? null;
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        error = err instanceof Error ? err.message : "Failed to load history";
      });
    return () => controller.abort();
  });

  // The live feed keeps the newest run current and adds any that starts while
  // the dialog is open.
  const runs = $derived.by(() => {
    if (loaded == null) return null;
    const live = status?.run.id != null ? status : undefined;
    if (!live) return loaded;
    if (!loaded.some((s) => s.run.id === live.run.id)) {
      return [live, ...loaded];
    }
    return loaded.map((s) =>
      s.run.id === live.run.id && s.sequence <= live.sequence ? live : s,
    );
  });

  const activeRun = $derived(runs?.find(isActiveSync));
  const newestRun = $derived(runs?.[0]);
  const rerunKind = $derived(
    runs?.find((s) => s.run.kind !== "library_purge")?.run.kind ===
      "library_refresh"
      ? "refresh"
      : "sync",
  );
  const rerunLabel = $derived.by(() => {
    if (!runs?.some((s) => s.run.kind !== "library_purge")) return "Sync now";
    return rerunKind === "refresh" ? "Refresh again" : "Sync again";
  });

  function ago(s: LibrarySyncStatus): string {
    const at = s.run.finished_at ?? s.run.started_at;
    return at ? timeAgo(at, Date.now()) : "";
  }

  function lastRunSummary(s: LibrarySyncStatus | undefined): string {
    if (!s) return "Never synced";
    const noun = runTitle(s.run.kind).toLowerCase();
    switch (runResult(s)) {
      case "partial":
        return `Last ${noun} finished ${ago(s)}, ${failedItems(s.failure_count)}`;
      case "failed":
        return `Last ${noun} failed ${ago(s)}`;
      case "cancelled":
        return `Last ${noun} was cancelled ${ago(s)}`;
      default:
        return `Last ${noun} finished ${ago(s)}`;
    }
  }

  function startedAt(s: LibrarySyncStatus): string | null {
    if (!s.run.started_at) return null;
    const started = new Date(s.run.started_at);
    return started.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year:
        started.getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function runFacts(s: LibrarySyncStatus): string {
    const facts: string[] = [];
    const started = startedAt(s);
    if (started) facts.push(`Started ${started}`);
    facts.push(`${s.progress.completed_units.toLocaleString()} completed`);
    if (s.progress.skipped_units > 0) {
      facts.push(`${s.progress.skipped_units.toLocaleString()} skipped`);
    }
    if (s.failure_count > 0) facts.push(failedItems(s.failure_count));
    return facts.join(" · ");
  }

  async function cancel(runId: string) {
    cancelling = true;
    error = null;
    try {
      onstatus(await cancelSyncRun(runId));
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to cancel the run";
    } finally {
      cancelling = false;
    }
  }
</script>

{#snippet currentState()}
  {#if activeRun}
    {@const completion = syncCompletion(activeRun)}
    {@const runId = activeRun.run.id}
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p
          class="flex items-baseline justify-between gap-3 text-sm font-medium text-slate-800 dark:text-neutral-100"
        >
          {syncLabel(activeRun)}
          {#if completion != null && activeRun.run.status !== "cancelling"}
            <span class="font-normal tabular-nums"
              >{completion.toFixed(1)}%</span
            >
          {/if}
        </p>
        {#if completion != null}
          <div
            class="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5"
          >
            <div
              class="h-full bg-[#BB7FB5] transition-[width] duration-300 dark:bg-[#cfa2c9]"
              style:width="{completion}%"
            ></div>
          </div>
        {/if}
        <p class="mt-1.5 truncate text-xs text-slate-500 dark:text-neutral-400">
          {activeRun.current?.subject ?? "Working"}
        </p>
      </div>
      {#if runId != null && activeRun.run.status !== "cancelling"}
        <button
          type="button"
          disabled={cancelling}
          class="shrink-0 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          onclick={() => cancel(runId)}
        >
          Cancel
        </button>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 text-sm text-slate-800 dark:text-neutral-100">
        {lastRunSummary(newestRun)}
      </p>
      <button
        type="button"
        class="shrink-0 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        onclick={() => (rerun = rerunKind)}
      >
        {rerunLabel}
      </button>
    </div>
  {/if}
{/snippet}

<Modal
  title="Sync history"
  subtitle={library.name}
  width="wide"
  toolbar={runs == null ? undefined : currentState}
  {onclose}
>
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#if runs == null}
    {#if !error}
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        Loading history
      </p>
    {/if}
  {:else if runs.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Runs will appear here once this library has synced.
    </p>
  {:else}
    <div>
      <div
        aria-hidden="true"
        class="{columns} hidden px-2 pb-1 text-xs text-slate-500 sm:grid dark:text-neutral-400"
      >
        <span>Run</span>
        <span>When</span>
        <span>Took</span>
        <span class="text-right">Failed</span>
        <span></span>
      </div>
      <ul>
        {#each runs as run (run.run.id ?? run.sequence)}
          {@const runId = run.run.id}
          {@const result = runResult(run)}
          {@const expanded = runId != null && expandedRunId === runId}
          <li>
            <button
              type="button"
              aria-expanded={expanded}
              class="{columns} w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
              onclick={() =>
                (expandedRunId = expanded ? null : (runId ?? null))}
            >
              <span class="truncate text-slate-800 dark:text-neutral-100"
                >{runHistoryTitle(run)}</span
              >
              <span
                class="truncate text-xs text-slate-500 dark:text-neutral-400"
                >{ago(run)}</span
              >
              <span
                class="hidden text-xs text-slate-500 tabular-nums sm:block dark:text-neutral-400"
                >{runDuration(run) ?? ""}</span
              >
              <span
                class="hidden text-right text-xs text-slate-500 tabular-nums sm:block dark:text-neutral-400"
                >{run.failure_count > 0
                  ? run.failure_count.toLocaleString()
                  : ""}</span
              >
              <svg
                class={[
                  "h-4 w-4 text-slate-500 transition-transform dark:text-neutral-400",
                  expanded && "rotate-90",
                ]}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {#if expanded}
              <div
                class="mt-1 mb-3 ml-2 space-y-3 rounded-md bg-slate-50 p-3 dark:bg-white/[0.04]"
              >
                <p class="text-xs text-slate-500 dark:text-neutral-400">
                  {runFacts(run)}
                </p>
                {#if run.run.error}
                  <p
                    class="text-xs break-words whitespace-pre-wrap text-slate-800 dark:text-neutral-100"
                  >
                    {run.run.error}
                  </p>
                {/if}
                {#if run.failure_count > 0 && runId != null}
                  <!-- A run's failures grow until it finishes; read them again then. -->
                  {#key result === "active"}
                    <SyncRunFailures {runId} failureCount={run.failure_count} />
                  {/key}
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</Modal>

{#if rerun}
  <LibraryRunOptionsModal
    {library}
    run={rerun}
    onstarted={(response) => onstatus(response.run)}
    onclose={() => (rerun = null)}
  />
{/if}
