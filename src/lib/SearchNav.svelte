<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";

  let {
    query = $bindable(""),
    committedQuery = $bindable(""),
    onclose,
  }: {
    query: string;
    committedQuery: string;
    onclose: () => void;
  } = $props();

  let input: HTMLInputElement;
  let previousFocus: Element | null = null;
  let composing = $state(false);

  onMount(() => {
    previousFocus = document.activeElement;
    input.focus();
  });

  $effect(() => {
    const term = query.trim();
    committedQuery = "";
    if (!term || composing) return;
    const timer = setTimeout(() => (committedQuery = term), 250);
    return () => clearTimeout(timer);
  });

  function closeSearch() {
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus();
    }
    onclose();
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.isComposing && !composing) {
      event.preventDefault();
      closeSearch();
    }
  }
</script>

<div
  role="search"
  aria-label="Music search"
  class="order-last flex w-full items-center gap-2 xl:absolute xl:top-4 xl:left-1/2 xl:order-none xl:w-[min(40%,36rem)] xl:-translate-x-1/2"
>
  <input
    bind:this={input}
    bind:value={query}
    type="search"
    aria-label="Search your music"
    aria-controls="search-results"
    placeholder="Search your music…"
    autocomplete="off"
    spellcheck="false"
    onkeydown={handleEscape}
    oncompositionstart={() => (composing = true)}
    oncompositionend={() => (composing = false)}
    class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-[#BB7FB5] focus:ring-2 focus:ring-[#BB7FB5]/30 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
  />
  <button
    type="button"
    aria-label="Close search"
    onclick={closeSearch}
    onkeydown={handleEscape}
    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#BB7FB5] dark:text-neutral-400 dark:hover:bg-neutral-700"
  >
    <svg
      aria-hidden="true"
      class="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      ><path d="m6 6 12 12M6 18 18 6" stroke-linecap="round" /></svg
    >
  </button>
</div>
