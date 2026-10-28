<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    OptionResponse,
    OptionValue,
    ProviderOptionValues,
    ProviderResponse,
    ReleaseResponse,
  } from "./types";
  import { fetchProviders, refreshEntity } from "./api";
  import Modal from "./Modal.svelte";

  interface Props {
    album: ReleaseResponse;
    onclose: () => void;
  }

  let { album, onclose }: Props = $props();

  let providers = $state<ProviderResponse[]>([]);
  let values = $state<ProviderOptionValues>({});
  let loading = $state(true);
  let refreshing = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    loadProviders();
  });

  function initialValue(option: OptionResponse): OptionValue {
    if (option.default != null) return option.default;
    if (option.type === "boolean") return false;
    if (option.type === "number") return 0;
    return "";
  }

  async function loadProviders() {
    loading = true;
    error = null;
    try {
      providers = (await fetchProviders()).filter(
        (p) => p.enabled && p.options.length > 0,
      );
      values = Object.fromEntries(
        providers.map((p) => [
          p.provider_id,
          Object.fromEntries(p.options.map((o) => [o.name, initialValue(o)])),
        ]),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load providers";
    } finally {
      loading = false;
    }
  }

  // Only options changed from their defaults are sent.
  function changedValues(): ProviderOptionValues {
    const changed: ProviderOptionValues = {};
    for (const provider of providers) {
      for (const option of provider.options) {
        const value = values[provider.provider_id][option.name];
        if (option.available && value !== initialValue(option)) {
          changed[provider.provider_id] ??= {};
          changed[provider.provider_id][option.name] = value;
        }
      }
    }
    return changed;
  }

  async function handleRefresh() {
    if (album.id == null) return;
    refreshing = true;
    error = null;
    try {
      await refreshEntity(album.id, false, false, changedValues());
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Refresh failed";
    } finally {
      refreshing = false;
    }
  }

  const inputClass =
    "w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";
</script>

<Modal title="Refresh with options" subtitle={album.title} {onclose}>
  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Loading providers…
    </p>
  {:else if providers.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      No enabled provider has refresh options.
    </p>
  {:else}
    {#each providers as provider (provider.provider_id)}
      <section>
        <h3
          class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
        >
          {provider.display_name}
        </h3>
        {#each provider.options as option (option.name)}
          <label
            class="flex items-center justify-between gap-3 py-1 text-sm text-slate-700 dark:text-neutral-300"
            title={option.available
              ? undefined
              : (option.unavailable_reason ?? undefined)}
          >
            <span class:opacity-50={!option.available}>
              {option.label}
              {#if !option.available && option.unavailable_reason}
                <span class="block text-xs text-slate-400">
                  {option.unavailable_reason}
                </span>
              {/if}
            </span>
            {#if option.type === "boolean"}
              <input
                type="checkbox"
                disabled={!option.available}
                bind:checked={
                  () => values[provider.provider_id][option.name] === true,
                  (checked) =>
                    (values[provider.provider_id][option.name] = checked)
                }
              />
            {:else if option.type === "number"}
              <input
                type="number"
                class={inputClass}
                disabled={!option.available}
                bind:value={
                  () => Number(values[provider.provider_id][option.name]),
                  (value) => (values[provider.provider_id][option.name] = value)
                }
              />
            {:else}
              <input
                type="text"
                class={inputClass}
                disabled={!option.available}
                bind:value={
                  () => String(values[provider.provider_id][option.name]),
                  (value) => (values[provider.provider_id][option.name] = value)
                }
              />
            {/if}
          </label>
        {/each}
      </section>
    {/each}
  {/if}
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={loading || refreshing || album.id == null}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={handleRefresh}
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  {/snippet}
</Modal>
