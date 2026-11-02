<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from "svelte";

  interface Props {
    placeholder: string;
    search: (text: string, signal: AbortSignal) => Promise<T[]>;
    // IDs already chosen, left out of the results.
    exclude?: string[];
    onpick: (item: T) => void;
    row: Snippet<[T]>;
  }

  let {
    placeholder,
    search: find,
    exclude = [],
    onpick,
    row,
  }: Props = $props();

  let query = $state("");
  let results = $state<T[]>([]);
  let open = $state(false);
  let highlighted = $state(0);
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  let shown = $derived(results.filter((a) => !exclude.includes(a.id)));

  function search(text: string) {
    clearTimeout(timer);
    controller?.abort();
    if (!text.trim()) {
      results = [];
      return;
    }
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        results = await find(text.trim(), controller.signal);
        highlighted = 0;
      } catch {
        // Aborted by the next keystroke, or failed; keep the last results.
      }
    }, 200);
  }

  function pick(item: T) {
    onpick(item);
    query = "";
    results = [];
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open || shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlighted = (highlighted + 1) % shown.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlighted = (highlighted - 1 + shown.length) % shown.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(shown[highlighted]);
    } else if (e.key === "Escape") {
      // Closes the results, not the modal around them.
      e.preventDefault();
      open = false;
    }
  }
</script>

<div class="relative">
  <input
    type="search"
    {placeholder}
    bind:value={query}
    oninput={() => {
      open = true;
      search(query);
    }}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    onkeydown={handleKeydown}
    class="w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
  />
  {#if open && shown.length > 0}
    <ul
      class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#26292a] dark:ring-white/10"
    >
      {#each shown as item, i (item.id)}
        <li>
          <button
            type="button"
            class="w-full truncate px-3 py-1.5 text-left text-sm text-slate-700 dark:text-neutral-200"
            class:bg-slate-100={i === highlighted}
            class:dark:bg-neutral-600={i === highlighted}
            onmouseenter={() => (highlighted = i)}
            onpointerdown={(e) => e.preventDefault()}
            onclick={() => pick(item)}
          >
            {@render row(item)}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
