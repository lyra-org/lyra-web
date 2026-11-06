<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import {
    applyMetadataChanges,
    fetchGenres,
    previewMetadataChanges,
  } from "./api";
  import { catalogChanged } from "./catalog.svelte.ts";
  import { staleReview, withExpected } from "./metadataChanges";
  import type {
    GenreSummary,
    MergePreview,
    MetadataChange,
    MetadataChangePreview,
  } from "./types";
  import MergeReview from "./MergeReview.svelte";
  import Modal from "./Modal.svelte";
  import SearchPicker from "./SearchPicker.svelte";

  interface Props {
    genre: GenreSummary;
    onclose: () => void;
  }

  let { genre, onclose }: Props = $props();

  let losers = $state<GenreSummary[]>([]);
  let previews = $state<MetadataChangePreview[] | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  let changes = $derived<MetadataChange[]>([
    {
      action: "merge",
      winner_id: genre.id,
      loser_ids: losers.map((l) => l.id),
    },
  ]);
  let names = $derived(Object.fromEntries(losers.map((l) => [l.id, l.name])));

  async function search(query: string, signal: AbortSignal) {
    return (await fetchGenres({ query, limit: 8, signal })).items;
  }

  async function review() {
    busy = true;
    error = null;
    try {
      previews = await previewMetadataChanges(changes);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to check the merge";
    } finally {
      busy = false;
    }
  }

  async function apply() {
    if (!previews) return;
    busy = true;
    error = null;
    notice = null;
    try {
      await applyMetadataChanges(withExpected(changes, previews));
      catalogChanged();
      onclose();
    } catch (err) {
      await reviewAgain(err);
    } finally {
      busy = false;
    }
  }

  async function reviewAgain(failure: unknown) {
    try {
      const next = await staleReview(changes, failure);
      if (next) {
        previews = next;
        notice =
          "The genres no longer match what you reviewed. This is the merge as it stands now.";
      } else {
        error = failure instanceof Error ? failure.message : "Failed to merge";
      }
    } catch (previewErr) {
      previews = null;
      error =
        previewErr instanceof Error
          ? previewErr.message
          : "Failed to check the merge";
    }
  }
</script>

<Modal
  title="Merge into {genre.name}"
  onclose={() => {
    if (!busy) onclose();
  }}
>
  {#if previews}
    {#if notice}
      <p class="text-sm font-medium text-slate-900 dark:text-neutral-100">
        {notice}
      </p>
    {/if}
    <MergeReview preview={previews[0] as MergePreview} {names} />
  {:else}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Duplicates added here merge into this one and are deleted. Their names
      keep finding this genre.
    </p>
    <ul class="space-y-1">
      {#each losers as loser (loser.id)}
        <li class="flex items-center justify-between gap-2 text-sm">
          <span class="min-w-0 truncate text-slate-900 dark:text-neutral-100"
            >{loser.name}</span
          >
          <button
            type="button"
            class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            onclick={() => (losers = losers.filter((l) => l.id !== loser.id))}
          >
            Remove
          </button>
        </li>
      {/each}
    </ul>
    <SearchPicker
      placeholder="Find a duplicate genre…"
      {search}
      exclude={[genre.id, ...losers.map((l) => l.id)]}
      onpick={(picked) => (losers = [...losers, picked])}
    >
      {#snippet row(item)}
        {item.name}
      {/snippet}
    </SearchPicker>
  {/if}
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      disabled={busy}
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={() => {
        if (previews) {
          previews = null;
          notice = null;
        } else {
          onclose();
        }
      }}
    >
      {previews ? "Back" : "Cancel"}
    </button>
    {#if previews}
      <button
        type="button"
        disabled={busy}
        class="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
        onclick={apply}
      >
        {busy ? "Merging…" : "Merge"}
      </button>
    {:else}
      <button
        type="button"
        disabled={busy || losers.length === 0}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={review}
      >
        {busy ? "Checking…" : "Review merge"}
      </button>
    {/if}
  {/snippet}
</Modal>
