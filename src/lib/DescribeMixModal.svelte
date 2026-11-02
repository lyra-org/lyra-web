<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { playMixFromTracks } from "./mix.svelte.ts";
  import { mix } from "./mixOptions";
  import Modal from "./Modal.svelte";

  interface Props {
    // What the page would mix from, offered alongside the description.
    seed?: { id: string; label: string };
    onclose: () => void;
  }

  let { seed, onclose }: Props = $props();

  // The server takes at most 512 bytes.
  const MAX_QUERY_LEN = 512;

  let query = $state("");
  let withSeed = $state(true);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let trimmed = $derived(query.trim());
  let tooLong = $derived(
    new TextEncoder().encode(trimmed).length > MAX_QUERY_LEN,
  );

  async function play(e: SubmitEvent) {
    e.preventDefault();
    if (!trimmed || tooLong || loading) return;
    loading = true;
    error = null;
    try {
      const tracks = await mix({
        q: trimmed,
        seeds: seed && withSeed ? [seed.id] : undefined,
      });
      if (tracks.length === 0) {
        error = "No tracks matched that description.";
        return;
      }
      await playMixFromTracks(tracks, `“${trimmed}”`);
      onclose();
    } catch (err) {
      error = err instanceof Error ? err.message : "The mix failed.";
    } finally {
      loading = false;
    }
  }
</script>

<Modal title="Describe a mix" width="narrow" {onclose}>
  <form id="describe-mix" class="space-y-3 text-sm" onsubmit={play}>
    <input
      type="text"
      bind:value={query}
      placeholder="Calm piano, rainy-day indie…"
      aria-label="Description"
      class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
    />
    {#if tooLong}
      <p class="text-xs text-red-600 dark:text-red-400">
        That description is too long.
      </p>
    {/if}
    {#if seed}
      <label
        class="flex items-center gap-2 text-slate-700 dark:text-neutral-300"
      >
        <input type="checkbox" bind:checked={withSeed} />
        Mix it with {seed.label}
      </label>
    {/if}
    {#if error}
      <p role="alert" class="text-red-600 dark:text-red-400">{error}</p>
    {/if}
  </form>

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={onclose}
    >
      Cancel
    </button>
    <button
      type="submit"
      form="describe-mix"
      disabled={!trimmed || tooLong || loading}
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
    >
      {loading ? "Mixing…" : "Mix"}
    </button>
  {/snippet}
</Modal>
