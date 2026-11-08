<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fly } from "svelte/transition";
  import { fetchLyrics } from "./api";
  import { isSynced, plainLyrics } from "./lyrics";
  import { getPlayer } from "./player.svelte.ts";
  import type { LyricsResponse } from "./types";

  interface Props {
    trackId: string;
  }

  let { trackId }: Props = $props();

  const SCROLL_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
  ]);

  const player = getPlayer();

  let lyrics = $state<LyricsResponse | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let revision = $state(0);
  let scroller = $state<HTMLElement>();
  let lineEls = $state<(HTMLElement | null)[]>([]);
  let following = $state(true);
  let activeLineAt = $state<"above" | "below" | "here">("here");

  let lines = $derived(lyrics?.lines ?? []);
  let showTimed = $derived(lyrics != null && isSynced(lyrics));
  let activeLine = $derived.by(() => {
    if (!showTimed) return -1;
    const currentMs = player.currentTime * 1000;
    let active = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].ts_ms <= currentMs) active = i;
      else break;
    }
    return active;
  });

  let paused = $derived(!following && showTimed);

  $effect(() => {
    const id = trackId;
    void revision;
    let cancelled = false;
    lyrics = null;
    lineEls = [];
    following = true;
    failed = false;
    loading = true;
    fetchLyrics(id)
      .then((res) => {
        if (!cancelled) lyrics = res;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const el = lineEls[activeLine];
    if (!following || !el || !scroller) return;
    // scrollIntoView would also scroll the page around this box.
    const box = scroller.getBoundingClientRect();
    const line = el.getBoundingClientRect();
    scroller.scrollBy({
      top: line.top - box.top - (box.height - line.height) / 2,
      behavior: "smooth",
    });
  });

  $effect(locateActiveLine);

  function reload() {
    revision += 1;
  }

  function locateActiveLine() {
    if (!paused || !scroller) return;
    const el = lineEls[activeLine];
    const box = scroller.getBoundingClientRect();
    const line = el?.getBoundingClientRect();
    if (line && line.bottom <= box.top) activeLineAt = "above";
    else if (line && line.top >= box.bottom) activeLineAt = "below";
    else activeLineAt = "here";
  }

  function stopFollowing() {
    if (
      showTimed &&
      scroller &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      following = false;
    }
  }

  function pressScroller(e: PointerEvent) {
    // Only a press on the scrollbar lands on the box itself.
    if (e.target === scroller) stopFollowing();
  }

  function pressScrollKey(e: KeyboardEvent) {
    if (SCROLL_KEYS.has(e.key)) stopFollowing();
  }

  function seekTo(ms: number) {
    player.seek(ms / 1000);
    following = true;
  }
</script>

<div class="flex flex-col">
  <h2
    class="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400"
  >
    Lyrics
  </h2>
  <div class="relative mt-3">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={scroller}
      class="max-h-[60vh] overflow-y-auto pr-2"
      class:pb-12={paused}
      onwheel={stopFollowing}
      ontouchmove={stopFollowing}
      onpointerdown={pressScroller}
      onkeydown={pressScrollKey}
      onscroll={locateActiveLine}
    >
      {#if loading}
        <p
          class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
        >
          Loading lyrics...
        </p>
      {:else if failed}
        <div
          class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
        >
          <p>Couldn't load lyrics.</p>
          <button
            type="button"
            class="mt-2 underline hover:text-slate-700 dark:hover:text-neutral-200"
            onclick={reload}
          >
            Try again
          </button>
        </div>
      {:else if !lyrics}
        <p
          class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
        >
          No lyrics available
        </p>
      {:else if showTimed}
        <div class="flex flex-col items-center gap-0.5 text-center">
          {#each lines as line, i (i)}
            <button
              type="button"
              bind:this={lineEls[i]}
              onclick={() => seekTo(line.ts_ms)}
              class="block w-full max-w-md cursor-pointer rounded-md px-2 py-1.5 text-base leading-snug text-slate-900 transition-opacity duration-700 ease-out hover:bg-slate-100/60 dark:text-neutral-100 dark:hover:bg-neutral-800/60"
              class:opacity-100={i === activeLine}
              class:opacity-60={activeLine < 0}
              class:opacity-30={i !== activeLine && activeLine >= 0}
            >
              {line.text || "‧"}
            </button>
          {/each}
        </div>
      {:else}
        <pre
          class="font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-neutral-300">{plainLyrics(
            lyrics,
          )}</pre>
      {/if}
    </div>
    {#if paused}
      <div
        class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
        transition:fly={{ y: 8, duration: 150 }}
      >
        <button
          type="button"
          class="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#E6CEE3] px-3.5 py-1.5 text-xs font-medium text-slate-900 shadow-md hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:shadow-black/40 dark:hover:bg-[#cfa2c9]"
          onclick={() => (following = true)}
        >
          {#if activeLineAt !== "here"}
            <svg
              class="h-3.5 w-3.5"
              class:rotate-180={activeLineAt === "above"}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 5v14M19 12l-7 7-7-7"
              />
            </svg>
          {/if}
          Resume autoscroll
        </button>
      </div>
    {/if}
  </div>
</div>
