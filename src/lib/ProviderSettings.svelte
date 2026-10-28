<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { fetchProviders, updateProvider } from "./api";
  import type { ProviderResponse } from "./types";

  let { busy = $bindable(false) }: { busy?: boolean } = $props();
  let providers = $state<ProviderResponse[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let error = $state("");

  function sorted(list: ProviderResponse[]) {
    return [...list].sort((a, b) => a.position - b.position);
  }

  async function loadProviders() {
    loading = true;
    loadError = false;
    try {
      providers = sorted(await fetchProviders());
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  async function update(
    provider: ProviderResponse,
    change: { position?: number; enabled?: boolean },
  ) {
    if (busy) return;
    busy = true;
    error = "";
    try {
      providers = sorted(await updateProvider(provider.provider_id, change));
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : `Unable to update ${provider.display_name}.`;
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void loadProviders();
  });

  const groupClass =
    "inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]";
  const segmentClass =
    "rounded px-3 py-1 font-medium text-slate-600 transition-colors hover:bg-[#E6CEE3] hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-[#BB7FB5] dark:hover:text-white dark:disabled:hover:bg-transparent";
  const arrowClass = segmentClass.replace("px-3 py-1", "p-1");
  const activeSegmentClass =
    "rounded px-3 py-1 font-medium bg-[#E6CEE3] text-slate-900 dark:bg-[#BB7FB5] dark:text-white";
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    Providers
  </h3>
</div>
<div class="flex-1 space-y-6 overflow-y-auto p-6">
  <p class="text-sm text-slate-600 dark:text-neutral-300">
    Metadata providers higher in the list take precedence when they disagree.
    Disabled providers are skipped.
  </p>
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
  {#if loading}
    <p role="status" class="text-sm">Loading providers…</p>
  {:else if loadError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">
      Unable to load providers.
    </p>
    <button type="button" onclick={loadProviders} class="text-sm underline"
      >Retry</button
    >
  {:else if providers.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      No metadata providers are installed. Install a plugin that provides one.
    </p>
  {:else}
    <ol class="divide-y divide-slate-200 dark:divide-neutral-800">
      {#each providers as provider, idx (provider.provider_id)}
        <li class="flex flex-wrap items-center justify-between gap-3 py-4">
          <div class="min-w-0 space-y-1" class:opacity-60={!provider.enabled}>
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-sm font-medium">
                <span class="text-slate-400 tabular-nums dark:text-neutral-500"
                  >{idx + 1}.</span
                >
                {provider.display_name}
              </span>
              <span class="text-xs text-slate-400 dark:text-neutral-500"
                >{provider.provider_id}</span
              >
            </div>
            {#if provider.options.length > 0}
              <p class="text-xs text-slate-500 dark:text-neutral-400">
                Refresh options: {provider.options
                  .map((option) =>
                    option.available
                      ? option.label
                      : `${option.label} (unavailable)`,
                  )
                  .join(", ")}
              </p>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            <div
              class={groupClass}
              role="group"
              aria-label={`${provider.display_name} status`}
            >
              {#each [true, false] as enabled (enabled)}
                <button
                  type="button"
                  aria-pressed={provider.enabled === enabled}
                  disabled={busy}
                  class={provider.enabled === enabled
                    ? activeSegmentClass
                    : segmentClass}
                  onclick={() => {
                    if (provider.enabled !== enabled)
                      void update(provider, { enabled });
                  }}>{enabled ? "Enabled" : "Disabled"}</button
                >
              {/each}
            </div>
            <div class={groupClass}>
              {#each [{ label: "up", offset: -1, path: "M5 15l7-7 7 7" }, { label: "down", offset: 1, path: "M19 9l-7 7-7-7" }] as move (move.label)}
                {@const position = idx + move.offset}
                <button
                  type="button"
                  class={arrowClass}
                  disabled={busy ||
                    position < 0 ||
                    position >= providers.length}
                  aria-label={`Move ${provider.display_name} ${move.label}`}
                  title={`Move ${move.label}`}
                  onclick={() => update(provider, { position })}
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
                      d={move.path}
                    />
                  </svg>
                </button>
              {/each}
            </div>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>
