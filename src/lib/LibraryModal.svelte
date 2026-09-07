<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import type { LibraryResponse } from "./types";
  import { createLibrary, updateLibrary } from "./api";

  interface Props {
    library?: LibraryResponse | null;
    onclose: () => void;
    onsave: (lib: LibraryResponse) => void;
  }

  let { library = null, onclose, onsave }: Props = $props();

  let isEdit = $derived(library != null);
  let name = $state(untrack(() => library?.name ?? ""));
  let directory = $state(untrack(() => library?.directory ?? ""));
  let language = $state(untrack(() => library?.language ?? ""));
  let country = $state(untrack(() => library?.country ?? ""));
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    saving = true;
    error = null;
    try {
      if (isEdit && library?.id != null) {
        const result = await updateLibrary(library.id, {
          name: name.trim(),
          language: language.trim() || null,
          country: country.trim() || null,
        });
        onsave(result);
      } else {
        if (!directory.trim()) return;
        const result = await createLibrary(
          name.trim(),
          directory.trim(),
          language.trim() || null,
          country.trim() || null,
        );
        onsave(result);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save library";
    } finally {
      saving = false;
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
    aria-label={isEdit ? "Edit library" : "New library"}
    class="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-[#1b1d1e] dark:shadow-black/50"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-neutral-900"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">
        {isEdit ? "Edit library" : "New library"}
      </h2>
      <button
        type="button"
        aria-label="Close"
        class="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        onclick={onclose}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Form -->
    <form class="space-y-4 px-5 py-4" onsubmit={handleSubmit}>
      <div>
        <label
          for="lib-name"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
          >Name</label
        >
        <input
          id="lib-name"
          type="text"
          bind:value={name}
          required
          placeholder="My Music"
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
        />
      </div>

      <div>
        <label
          for="lib-dir"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
          >Directory</label
        >
        {#if isEdit}
          <p class="text-sm text-slate-500 dark:text-neutral-400">
            {library?.directory}
          </p>
        {:else}
          <input
            id="lib-dir"
            type="text"
            bind:value={directory}
            required
            placeholder="/path/to/music"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
          />
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label
            for="lib-lang"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Language</label
          >
          <input
            id="lib-lang"
            type="text"
            bind:value={language}
            placeholder="en"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
          />
        </div>
        <div>
          <label
            for="lib-country"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Country</label
          >
          <input
            id="lib-country"
            type="text"
            bind:value={country}
            placeholder="US"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
          />
        </div>
      </div>

      {#if error}
        <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
      {/if}

      <div class="flex justify-end gap-2 pt-1">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          onclick={onclose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || (!isEdit && !directory.trim())}
          class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        >
          {saving ? "Saving..." : isEdit ? "Save" : "Create"}
        </button>
      </div>
    </form>
  </div>
</div>
