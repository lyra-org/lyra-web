<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    CoverUpdate,
    ProviderOptionValues,
    ProviderResponse,
  } from "./types";
  import { fetchProviders, refreshEntity } from "./api";
  import CoverOptionsFields from "./CoverOptionsFields.svelte";
  import Modal from "./Modal.svelte";
  import OptionField, {
    defaultOptionValue,
    optionChanged,
    type OptionFieldValue,
  } from "./OptionField.svelte";

  interface Props {
    entityId: string;
    // Releases and artists fetch covers on refresh; tracks do not.
    hasCover?: boolean;
    onclose: () => void;
    // Called once the refresh returns, after the server refreshed the entity.
    onrefreshed?: () => void;
  }

  let { entityId, hasCover = false, onclose, onrefreshed }: Props = $props();

  let covers = $state<CoverUpdate>("missing");
  let bypassCoverCache = $state(false);

  let providers = $state<ProviderResponse[]>([]);
  let values = $state<Record<string, Record<string, OptionFieldValue>>>({});
  let loading = $state(true);
  let refreshing = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    loadProviders();
  });

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
          Object.fromEntries(
            p.options.map((o) => [o.name, defaultOptionValue(o)]),
          ),
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
        if (option.available && optionChanged(option, value)) {
          changed[provider.provider_id] ??= {};
          changed[provider.provider_id][option.name] = value;
        }
      }
    }
    return changed;
  }

  async function handleRefresh() {
    refreshing = true;
    error = null;
    try {
      await refreshEntity(entityId, {
        covers,
        bypassCoverCache,
        providerOptions: changedValues(),
      });
      onrefreshed?.();
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Refresh failed";
    } finally {
      refreshing = false;
    }
  }
</script>

<Modal title="Refresh with options" {onclose}>
  {#if hasCover}
    <section>
      <h3
        class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
      >
        Covers
      </h3>
      <CoverOptionsFields bind:covers bind:bypassCoverCache />
    </section>
  {/if}
  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Loading providers…
    </p>
  {:else if providers.length === 0 && !hasCover}
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
          <OptionField
            {option}
            bind:value={values[provider.provider_id][option.name]}
          />
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
      disabled={loading || refreshing}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={handleRefresh}
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  {/snippet}
</Modal>
