<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ExternalIdResponse } from "./types";
  import {
    fetchExternalIds,
    fetchProviders,
    inheritExternalId,
    refreshEntity,
    setExternalId,
  } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import Modal from "./Modal.svelte";

  interface Props {
    entityId: string;
    // Names the entity in the empty state, as in "This album has no…".
    noun: "album" | "artist" | "track";
    onclose: () => void;
  }

  let { entityId, noun, onclose }: Props = $props();

  interface ProviderGroup {
    providerId: string;
    displayName: string;
    position: number;
    ids: ExternalIdResponse[];
  }

  const auth = getAuth();

  let groups = $state<ProviderGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  // The row being saved or reset; other rows wait for it.
  let busyKey = $state<string | null>(null);
  let editingKey = $state<string | null>(null);
  let draft = $state("");

  $effect(() => {
    load();
  });

  function idKey(id: ExternalIdResponse): string {
    return `${id.provider_id}/${id.id_type}`;
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const [ids, providers] = await Promise.all([
        fetchExternalIds(entityId),
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
            position: provider?.position ?? Infinity,
            ids: [],
          };
          byProvider.set(id.provider_id, group);
        }
        group.ids.push(id);
      }
      groups = [...byProvider.values()].sort(
        (a, b) =>
          a.position - b.position || a.displayName.localeCompare(b.displayName),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load IDs";
    } finally {
      loading = false;
    }
  }

  // Each change applies at once, then refreshes the entity so its metadata
  // follows the ID now in effect. Refreshing needs its own permission; without
  // it, the metadata catches up on the next refresh.
  async function change(id: ExternalIdResponse, apply: () => Promise<unknown>) {
    busyKey = idKey(id);
    error = null;
    notice = null;
    try {
      await apply();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update the ID";
      busyKey = null;
      return false;
    }
    try {
      if (auth.hasPermission("sync_metadata")) {
        await refreshEntity(entityId);
      } else {
        notice = `The ID is saved. The ${noun}'s metadata follows it on the next refresh.`;
      }
    } catch (err) {
      error = `The ID is saved, but refreshing failed: ${
        err instanceof Error ? err.message : "unknown error"
      }`;
    }
    await load();
    busyKey = null;
    return true;
  }

  function startEdit(id: ExternalIdResponse) {
    editingKey = idKey(id);
    draft = id.id_value;
    error = null;
  }

  function cancelEdit() {
    editingKey = null;
    draft = "";
  }

  async function saveEdit(id: ExternalIdResponse) {
    const value = draft.trim();
    if (!value || value === id.id_value) return;
    const saved = await change(id, () =>
      setExternalId(entityId, id.provider_id, id.id_type, value),
    );
    if (saved) cancelEdit();
  }

  function handleInherit(id: ExternalIdResponse) {
    change(id, () => inheritExternalId(entityId, id.provider_id, id.id_type));
  }

  function handleEditKeydown(e: KeyboardEvent, id: ExternalIdResponse) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === "Escape") {
      // Leaves the edit, not the modal.
      e.preventDefault();
      cancelEdit();
    }
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  const smallButtonClass =
    "shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700";
</script>

<Modal
  title="External IDs"
  onclose={() => {
    if (busyKey == null) onclose();
  }}
>
  {#if loading && groups.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">Loading IDs…</p>
  {:else if groups.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      This {noun} has no external IDs.
    </p>
  {:else}
    {#each groups as group (group.providerId)}
      <section>
        <h3
          class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
        >
          {group.displayName}
        </h3>
        <ul class="space-y-3">
          {#each group.ids as id (idKey(id))}
            {@const key = idKey(id)}
            {@const busy = busyKey === key}
            <li class="text-sm">
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
              {#if editingKey === key}
                <div class="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="{id.id_type} value"
                    class="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
                    bind:value={draft}
                    disabled={busy}
                    onkeydown={(e) => handleEditKeydown(e, id)}
                    use:focus
                  />
                  <button
                    type="button"
                    class={smallButtonClass}
                    disabled={busy}
                    onclick={cancelEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="shrink-0 rounded-md bg-[#E6CEE3] px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
                    disabled={busy ||
                      !draft.trim() ||
                      draft.trim() === id.id_value}
                    onclick={() => saveEdit(id)}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
                {#if id.resolved_value != null || id.source === "resolved"}
                  <p
                    class="mt-1 font-mono text-xs break-all text-slate-400 dark:text-neutral-500"
                  >
                    Provider: {(id.resolved_value ?? id.id_value) ||
                      "Unmatched"}
                  </p>
                {/if}
              {:else}
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
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
                  <div class="flex shrink-0 items-center gap-1">
                    {#if id.source === "manual"}
                      <button
                        type="button"
                        disabled={busyKey != null}
                        class={smallButtonClass}
                        title={id.resolved_value != null
                          ? "Drop the manual ID and use the provider's"
                          : "Drop the manual ID; the provider has none"}
                        onclick={() => handleInherit(id)}
                      >
                        {#if busy}
                          Updating…
                        {:else if id.resolved_value != null}
                          Use provider's
                        {:else}
                          Remove
                        {/if}
                      </button>
                    {/if}
                    <button
                      type="button"
                      disabled={busyKey != null}
                      class={smallButtonClass}
                      onclick={() => startEdit(id)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
  {#if notice}
    <p class="text-sm text-slate-600 dark:text-neutral-300">{notice}</p>
  {/if}
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      disabled={busyKey != null}
      onclick={onclose}
    >
      Close
    </button>
  {/snippet}
</Modal>
