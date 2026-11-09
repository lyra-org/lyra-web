<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { TrackResponse } from "./types";
  import {
    fetchRelease,
    fetchReleaseChains,
    replaceReleaseChains,
  } from "./api";
  import Modal from "./Modal.svelte";

  interface Props {
    releaseId: string;
    onchanged?: () => void;
    onclose: () => void;
  }

  let { releaseId, onchanged, onclose }: Props = $props();

  let tracks = $state<TrackResponse[]>([]);
  // Each chain's track ids in play order.
  let chains = $state<string[][]>([]);
  let saved = $state("[]");
  let selected = $state<Set<string>>(new Set());
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  let titles = $derived(new Map(tracks.map((t) => [t.id, t.title])));
  let chainOf = $derived(
    new Map(chains.flatMap((chain, i) => chain.map((id) => [id, i]))),
  );
  let dirty = $derived(JSON.stringify(chains) !== saved);

  $effect(() => {
    load();
  });

  async function load() {
    loading = true;
    error = null;
    try {
      const [release, stored] = await Promise.all([
        fetchRelease(releaseId),
        fetchReleaseChains(releaseId),
      ]);
      tracks = [...(release.tracks ?? [])].sort(
        (a, b) =>
          (a.disc ?? 1) - (b.disc ?? 1) || (a.track ?? 0) - (b.track ?? 0),
      );
      chains = stored.chains.map((chain) => chain.track_ids);
      saved = JSON.stringify(chains);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load chains";
    } finally {
      loading = false;
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    selected = next;
  }

  // The selected tracks become a chain in album order.
  function chainSelected() {
    chains = [
      ...chains,
      tracks.map((t) => t.id).filter((id) => selected.has(id)),
    ];
    selected = new Set();
  }

  function unchain(index: number) {
    chains = chains.filter((_, i) => i !== index);
  }

  async function save() {
    saving = true;
    error = null;
    try {
      await replaceReleaseChains(releaseId, chains);
      onchanged?.();
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save chains";
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Edit chains" {onclose}>
  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">Loading tracks…</p>
  {:else}
    {#if chains.length > 0}
      <section>
        <h3
          class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
        >
          Chains
        </h3>
        <ul class="space-y-1">
          {#each chains as chain, i}
            <li
              class="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-neutral-800"
            >
              <span class="min-w-0">
                <span class="text-slate-400 tabular-nums dark:text-neutral-500"
                  >{i + 1}.</span
                >
                {chain.map((id) => titles.get(id) ?? id).join(" → ")}
              </span>
              <button
                type="button"
                class="shrink-0 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                onclick={() => unchain(i)}
              >
                Unchain
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h3
        class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
      >
        Tracks
      </h3>
      <ul>
        {#each tracks as track (track.id)}
          {@const chain = chainOf.get(track.id)}
          <li>
            <label
              class="flex items-center gap-3 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-neutral-800"
              class:opacity-60={chain != null}
            >
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-[#BB7FB5]"
                checked={selected.has(track.id)}
                disabled={chain != null}
                onchange={() => toggle(track.id)}
              />
              <span
                class="w-6 shrink-0 text-right text-slate-400 tabular-nums dark:text-neutral-500"
                >{track.track ?? ""}</span
              >
              <span class="min-w-0 flex-1 truncate">{track.title}</span>
              {#if chain != null}
                <span
                  class="shrink-0 text-xs text-slate-400 dark:text-neutral-500"
                  >Chain {chain + 1}</span
                >
              {/if}
            </label>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      disabled={selected.size < 2}
      class="mr-auto rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={chainSelected}
    >
      Chain selected
    </button>
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={loading || saving || !dirty}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={save}
    >
      {saving ? "Saving…" : "Save"}
    </button>
  {/snippet}
</Modal>
