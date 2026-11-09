<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type { LibrarySyncFailure } from "./types";
  import { fetchSyncRunFailures } from "./api";
  import { failureStageLabels } from "./librarySync";

  interface Props {
    runId: string;
    failureCount: number;
  }

  interface Reason {
    message: string;
    names: string[];
  }

  interface StageGroup {
    label: string;
    count: number;
    reasons: Reason[];
  }

  const NAMES_SHOWN = 3;

  let { runId, failureCount }: Props = $props();

  let failures = $state<LibrarySyncFailure[] | null>(null);
  let error = $state<string | null>(null);
  let openReasons = $state<Set<Reason>>(new Set());

  onMount(() => {
    const controller = new AbortController();
    fetchSyncRunFailures(runId, controller.signal)
      .then((loaded) => (failures = loaded))
      .catch((err) => {
        if (controller.signal.aborted) return;
        error = err instanceof Error ? err.message : "Failed to load failures";
      });
    return () => controller.abort();
  });

  function failureName(failure: LibrarySyncFailure): string {
    return (
      failure.entity_title ||
      failure.source_dir ||
      failure.provider_id ||
      failure.type
    );
  }

  // Largest first, so a problem shared by many items leads.
  const groups = $derived.by(() => {
    const stages = new Map<string, Map<string, string[]>>();
    for (const failure of failures ?? []) {
      const label = failureStageLabels[failure.stage] ?? failure.stage;
      const reasons = stages.get(label) ?? new Map<string, string[]>();
      stages.set(label, reasons);
      const names = reasons.get(failure.message) ?? [];
      reasons.set(failure.message, names);
      names.push(failureName(failure));
    }
    const result: StageGroup[] = [...stages].map(([label, reasons]) => ({
      label,
      count: [...reasons.values()].reduce((sum, n) => sum + n.length, 0),
      reasons: [...reasons]
        .map(([message, names]) => ({ message, names }))
        .sort((a, b) => b.names.length - a.names.length),
    }));
    return result.sort((a, b) => b.count - a.count);
  });

  function showAll(reason: Reason) {
    openReasons = new Set(openReasons).add(reason);
  }
</script>

{#if error}
  <p role="alert" class="text-xs text-red-600 dark:text-red-400">{error}</p>
{:else if failures == null}
  <p class="text-xs text-slate-500 dark:text-neutral-400">Loading failures</p>
{:else if failures.length === 0}
  <p class="text-xs text-slate-500 dark:text-neutral-400">
    No details were saved for these failures.
  </p>
{:else}
  {#each groups as group (group.label)}
    <section>
      <h4
        class="flex items-baseline justify-between text-xs font-medium text-slate-800 dark:text-neutral-100"
      >
        {group.label}
        <span
          class="font-normal text-slate-500 tabular-nums dark:text-neutral-400"
          >{group.count.toLocaleString()}</span
        >
      </h4>
      <ul class="mt-1 space-y-1.5">
        {#each group.reasons as reason (reason.message)}
          {@const hidden = openReasons.has(reason)
            ? 0
            : Math.max(0, reason.names.length - NAMES_SHOWN)}
          <li class="text-xs">
            <p
              class="break-words whitespace-pre-wrap text-slate-800 dark:text-neutral-100"
            >
              {reason.message}
            </p>
            <p class="text-slate-500 dark:text-neutral-400">
              {reason.names.slice(0, reason.names.length - hidden).join(", ")}
              {#if hidden > 0}
                <button
                  type="button"
                  class="hover:underline"
                  onclick={() => showAll(reason)}
                  >and {hidden.toLocaleString()} more</button
                >
              {/if}
            </p>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  {#if failures.length < failureCount}
    <p class="text-xs text-slate-500 dark:text-neutral-400">
      Details were saved for {failures.length.toLocaleString()} of
      {failureCount.toLocaleString()} failures.
    </p>
  {/if}
{/if}
