<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ExternalIdResponse, ReleaseResponse } from "./types";
  import {
    fetchExternalIds,
    fetchProviders,
    inheritExternalId,
    refreshEntity,
  } from "./api";

  interface Props {
    album: ReleaseResponse;
    onclose: () => void;
  }

  let { album, onclose }: Props = $props();

  interface ProviderGroup {
    providerId: string;
    displayName: string;
    priority: number;
    ids: ExternalIdResponse[];
  }

  let groups = $state<ProviderGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let inheritingKey = $state<string | null>(null);

  $effect(() => {
    load();
  });

  function idKey(id: ExternalIdResponse): string {
    return `${id.provider_id}/${id.id_type}`;
  }

  async function load() {
    if (album.id == null) return;
    loading = true;
    error = null;
    try {
      const [ids, providers] = await Promise.all([
        fetchExternalIds(album.id),
        fetchProviders(),
      ]);
      const byProvider = new Map<string, ProviderGroup>();
      for (const id of [...ids].sort((a, b) =>
        a.id_type.localeCompare(b.id_type),
      )) {
        let group = byProvider.get(id.provider_id);
        if (!group) {
          const provider = providers.find(
            (p) => p.provider_id === id.provider_id,
          );
          group = {
            providerId: id.provider_id,
            displayName: provider?.display_name ?? id.provider_id,
            priority: provider?.priority ?? -1,
            ids: [],
          };
          byProvider.set(id.provider_id, group);
        }
        group.ids.push(id);
      }
      groups = [...byProvider.values()].sort(
        (a, b) =>
          b.priority - a.priority || a.displayName.localeCompare(b.displayName),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load IDs";
    } finally {
      loading = false;
    }
  }

  // Refreshes afterwards so the album's metadata follows the ID now in effect.
  async function handleInherit(id: ExternalIdResponse) {
    if (album.id == null) return;
    inheritingKey = idKey(id);
    error = null;
    try {
      await inheritExternalId(album.id, id.provider_id, id.id_type);
      await refreshEntity(album.id);
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update the ID";
    } finally {
      inheritingKey = null;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
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
    aria-label="External IDs"
    class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl dark:bg-[#1b1d1e] dark:shadow-black/50"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="border-b border-slate-200 px-5 py-3 dark:border-neutral-900">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">
        External IDs
      </h2>
      <p class="truncate text-sm text-slate-500 dark:text-neutral-400">
        {album.title}
      </p>
    </div>

    <div class="flex-1 space-y-4 overflow-y-auto px-5 py-3">
      {#if loading && groups.length === 0}
        <p class="text-sm text-slate-500 dark:text-neutral-400">Loading IDs…</p>
      {:else if groups.length === 0}
        <p class="text-sm text-slate-500 dark:text-neutral-400">
          This album has no external IDs.
        </p>
      {:else}
        {#each groups as group (group.providerId)}
          <section>
            <h3
              class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
            >
              {group.displayName}
            </h3>
            <ul class="space-y-2">
              {#each group.ids as id (idKey(id))}
                <li class="flex items-start justify-between gap-3 text-sm">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 dark:text-neutral-400">
                        {id.id_type}
                      </span>
                      {#if id.source === "manual"}
                        <span
                          class="rounded bg-[#E6CEE3] px-1.5 text-xs text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
                        >
                          Manual
                        </span>
                      {/if}
                    </div>
                    <p
                      class="font-mono text-xs break-all text-slate-900 dark:text-neutral-100"
                    >
                      {id.id_value || "Unmatched"}
                    </p>
                    {#if id.resolved_value != null}
                      <p
                        class="font-mono text-xs break-all text-slate-400 dark:text-neutral-500"
                      >
                        Provider: {id.resolved_value || "Unmatched"}
                      </p>
                    {/if}
                  </div>
                  {#if id.source === "manual"}
                    <button
                      type="button"
                      disabled={inheritingKey != null}
                      class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      title={id.resolved_value != null
                        ? "Drop the manual ID and use the provider's"
                        : "Drop the manual ID; the provider has none"}
                      onclick={() => handleInherit(id)}
                    >
                      {#if inheritingKey === idKey(id)}
                        Updating…
                      {:else if id.resolved_value != null}
                        Use provider's
                      {:else}
                        Remove
                      {/if}
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      {/if}
      {#if error}
        <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
      {/if}
    </div>

    <div
      class="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-neutral-900"
    >
      <button
        type="button"
        class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={onclose}
      >
        Close
      </button>
    </div>
  </div>
</div>
