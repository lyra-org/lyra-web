<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fetchLyrics } from "./api";
  import { isSynced, plainLyrics } from "./lyrics";
  import { getPlayer } from "./player.svelte.ts";
  import type { LyricsResponse } from "./types";

  interface Props {
    trackId: string;
  }

  let { trackId }: Props = $props();

  const player = getPlayer();

  let lyrics = $state<LyricsResponse | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let revision = $state(0);
  let scroller = $state<HTMLElement>();
  let lineEls = $state<(HTMLElement | null)[]>([]);

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

  $effect(() => {
    const id = trackId;
    void revision;
    let cancelled = false;
    lyrics = null;
    lineEls = [];
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
    if (!el || !scroller) return;
    // scrollIntoView would also scroll the page around this box.
    const box = scroller.getBoundingClientRect();
    const line = el.getBoundingClientRect();
    scroller.scrollBy({
      top: line.top - box.top - (box.height - line.height) / 2,
      behavior: "smooth",
    });
  });

  function reload() {
    revision += 1;
  }

  function seekTo(ms: number) {
    player.seek(ms / 1000);
  }
</script>

<div class="flex flex-col">
  <h2
    class="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400"
  >
    Lyrics
  </h2>
  <div bind:this={scroller} class="mt-3 max-h-[60vh] overflow-y-auto pr-2">
    {#if loading}
      <p class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500">
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
      <p class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500">
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
</div>
