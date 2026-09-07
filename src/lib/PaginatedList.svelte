<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts" generics="T">
  import { tick, untrack, type Snippet } from "svelte";
  import { ApiError } from "./api";
  import type { Page } from "./types";

  interface Props {
    loadPage: (cursor: string | undefined, limit: number) => Promise<Page<T>>;
    scope?: string;
    label: string;
    pageSize?: number;
    children: Snippet<[T[]]>;
    toolbar?: Snippet;
    empty?: string;
  }

  let {
    loadPage,
    scope = "",
    label,
    pageSize = 96,
    children,
    toolbar,
    empty = "No items found.",
  }: Props = $props();
  let pages = $state.raw<Page<T>[]>([]);
  let index = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let expired = $state(false);
  let failedIndex = 0;
  let request = 0;
  let content: HTMLDivElement;
  let page = $derived(pages[index]);

  async function load(target: number, scroll = false) {
    const currentRequest = ++request;
    error = null;
    expired = false;
    loading = true;
    try {
      if (!pages[target]) {
        const cursor =
          target === 0
            ? undefined
            : (pages[target - 1]?.next_cursor ?? undefined);
        const result = await loadPage(cursor, pageSize);
        if (currentRequest !== request) return;
        pages = [...pages.slice(0, target), result];
      }
      index = target;
      if (scroll) {
        await tick();
        if (currentRequest === request)
          content?.scrollIntoView({ block: "start" });
      }
    } catch (e) {
      if (currentRequest !== request) return;
      expired = e instanceof ApiError && e.status === 409;
      error = expired
        ? "This list has changed or expired. Refresh to continue."
        : "Couldn't load this page. Please try again.";
      failedIndex = target;
      if (scroll) {
        await tick();
        if (currentRequest === request)
          content?.scrollIntoView({ block: "start" });
      }
    } finally {
      if (currentRequest === request) loading = false;
    }
  }

  export function reload() {
    pages = [];
    index = 0;
    return load(0);
  }

  $effect(() => {
    scope;
    loadPage;
    pageSize;
    untrack(reload);
    return () => {
      request += 1;
    };
  });

  const buttonClass =
    "inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BB7FB5] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800";
  const pagerButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BB7FB5] disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";
</script>

{#snippet navigation(position: "top" | "bottom")}
  <nav
    aria-label={`${label} pagination (${position})`}
    class="flex shrink-0 items-center gap-1"
  >
    <button
      type="button"
      class={pagerButtonClass}
      aria-label="Previous page"
      title="Previous page"
      disabled={loading || !page || index === 0}
      onclick={() => load(index - 1, true)}
    >
      <svg
        aria-hidden="true"
        class="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m14 6-6 6 6 6"
        /></svg
      >
    </button>
    <span
      class="min-w-12 text-center text-xs text-slate-500 tabular-nums dark:text-neutral-400"
      aria-live={position === "bottom" ? "polite" : "off"}
      >{loading ? "Loading…" : `Page ${index + 1}`}</span
    >
    <button
      type="button"
      class={pagerButtonClass}
      aria-label="Next page"
      title="Next page"
      disabled={loading || !page?.next_cursor}
      onclick={() => load(index + 1, true)}
    >
      <svg
        aria-hidden="true"
        class="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m10 6 6 6-6 6"
        /></svg
      >
    </button>
  </nav>
{/snippet}

<div bind:this={content} class="scroll-mt-6" aria-busy={loading}>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
    {#if toolbar}
      {@render toolbar()}
    {:else}
      <span class="text-xs text-slate-500 dark:text-neutral-400"
        >{pageSize} per page</span
      >
    {/if}
    {@render navigation("top")}
  </div>
  {#if error}
    <div class="mb-6 flex flex-wrap items-center justify-center gap-3 text-sm">
      <p role="alert" class="text-red-600 dark:text-red-400">{error}</p>
      <button
        type="button"
        class={buttonClass}
        disabled={loading}
        onclick={() => (expired ? reload() : load(failedIndex))}
        >{expired ? "Refresh" : "Retry"}</button
      >
    </div>
  {/if}

  {#if !page && loading}
    <div
      class="flex items-center justify-center py-20"
      role="status"
      aria-label="Loading items"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
      ></div>
    </div>
  {:else if page}
    {#if page.items.length > 0}
      {@render children(page.items)}
    {:else}
      <p class="py-20 text-center text-sm text-slate-500 dark:text-neutral-400">
        {empty}
      </p>
    {/if}
  {/if}

  {#if page}
    <div
      class="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
    >
      <div
        class="text-xs text-slate-500 dark:text-neutral-400"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          >{page.items.length}
          {page.items.length === 1 ? "item" : "items"}</span
        >
        <span
          class="mx-1.5 text-slate-300 dark:text-neutral-600"
          aria-hidden="true">·</span
        >
        <span>{pageSize} per page</span>
      </div>
      {@render navigation("bottom")}
    </div>
  {/if}
</div>
