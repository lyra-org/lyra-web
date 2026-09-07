<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { getPlayer } from "./player.svelte.ts";
  import { fetchLyrics } from "./api";
  import type { LyricsResponse } from "./types";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";

  const player = getPlayer();

  let lyrics = $state<LyricsResponse | null>(null);
  let lyricsLoading = $state(false);
  let lineEls = $state<(HTMLElement | null)[]>([]);

  let coverSrc = $derived(player.playbackContext?.coverUrl ?? null);
  let coverBlurhash = $derived(player.playbackContext?.coverBlurhash ?? null);
  let artistNames = $derived(player.currentArtistNames);

  let isSynced = $derived(!!lyrics && lyrics.lines.length > 0);
  let currentMs = $derived(player.currentTime * 1000);

  let activeLineIndex = $derived.by(() => {
    if (!isSynced || !lyrics) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].ts_ms <= currentMs) idx = i;
      else break;
    }
    return idx;
  });

  let progressPct = $derived(
    player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0,
  );

  $effect(() => {
    const id = player.currentTrack?.id;
    if (!id) {
      lyrics = null;
      lyricsLoading = false;
      lineEls = [];
      return;
    }
    let cancelled = false;
    lyrics = null;
    lineEls = [];
    lyricsLoading = true;
    fetchLyrics(id)
      .then((res) => {
        if (!cancelled) lyrics = res;
      })
      .catch(() => {
        if (!cancelled) lyrics = null;
      })
      .finally(() => {
        if (!cancelled) lyricsLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const idx = activeLineIndex;
    if (idx < 0) return;
    const el = lineEls[idx];
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  function formatTime(s: number): string {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function onSeekBar(e: MouseEvent) {
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    player.seek(ratio * player.duration);
  }

  function seekTo(ms: number) {
    player.seek(ms / 1000);
  }
</script>

{#if !player.currentTrack}
  <div class="py-20 text-center">
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Nothing is playing right now.
    </p>
    <a
      href="#/"
      class="mt-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >&larr; Back to library</a
    >
  </div>
{:else}
  <div class="mx-auto max-w-5xl">
    <!-- Hero: cover + title + controls -->
    <section
      class="flex flex-col items-center gap-5 border-b border-slate-100 pb-8 dark:border-neutral-800"
    >
      <div
        class="relative h-56 w-56 shrink-0 overflow-hidden rounded-lg bg-slate-200 shadow-md sm:h-64 sm:w-64 dark:bg-neutral-700 dark:shadow-black/40"
      >
        {#if coverBlurhash}
          <BlurhashCanvas
            hash={coverBlurhash}
            class="absolute inset-0 h-full w-full object-cover"
          />
        {/if}
        {#if coverSrc}
          <img
            src={coverSrc}
            alt=""
            class="relative h-full w-full object-cover"
          />
        {:else if !coverBlurhash}
          <div
            class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        {/if}
      </div>

      <div class="flex flex-col items-center text-center">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-neutral-100">
            {player.currentTrack.title}
          </h1>
          {#if player.currentTrack.id}
            <FavoriteButton
              targetId={player.currentTrack.id}
              label={player.currentTrack.title}
            />
          {/if}
        </div>
        {#if artistNames}
          <p class="mt-1 text-base text-slate-600 dark:text-neutral-300">
            {artistNames}
          </p>
        {/if}
        {#if player.playbackContext?.title}
          <p class="mt-1 text-sm text-slate-400 dark:text-neutral-500">
            From {player.playbackContext.title}
          </p>
        {/if}
      </div>

      <!-- Seek bar -->
      <div class="flex w-full max-w-2xl items-center gap-3">
        <span
          class="w-10 text-right text-xs text-slate-500 tabular-nums dark:text-neutral-400"
          >{formatTime(player.currentTime)}</span
        >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="group relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
          onclick={onSeekBar}
        >
          <div
            class="h-full bg-[#E6CEE3] transition-[width] duration-200 ease-out dark:bg-[#BB7FB5]"
            style="width: {progressPct}%"
          ></div>
        </div>
        <span
          class="w-10 text-left text-xs text-slate-500 tabular-nums dark:text-neutral-400"
          >{formatTime(player.duration)}</span
        >
      </div>

      <!-- Controls -->
      <div class="flex w-full max-w-2xl items-center justify-between">
        <!-- Left: shuffle -->
        <div class="flex w-24 items-center">
          <button
            type="button"
            class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors"
            class:bg-[#E6CEE3]={player.shuffle}
            class:text-slate-900={player.shuffle}
            class:shadow-sm={player.shuffle}
            class:dark:bg-[#BB7FB5]={player.shuffle}
            class:dark:text-white={player.shuffle}
            class:text-slate-500={!player.shuffle}
            class:hover:bg-slate-100={!player.shuffle}
            class:hover:text-slate-700={!player.shuffle}
            class:dark:text-neutral-400={!player.shuffle}
            class:dark:hover:bg-neutral-800={!player.shuffle}
            class:dark:hover:text-neutral-200={!player.shuffle}
            onclick={() => player.toggleShuffle()}
            aria-label={player.shuffle ? "Disable shuffle" : "Enable shuffle"}
            aria-pressed={player.shuffle}
            title={player.shuffle ? "Shuffle on" : "Shuffle off"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
              />
            </svg>
          </button>
        </div>

        <!-- Center: prev, play, next, stop -->
        <div class="flex items-center gap-3">
          <button
            class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onclick={() => player.prevTrack()}
            aria-label="Previous track"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"
              />
            </svg>
          </button>
          <button
            class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#E6CEE3] text-slate-900 shadow-sm transition-all hover:scale-105 hover:bg-[#d4b5cf] disabled:scale-100 disabled:opacity-40 disabled:hover:bg-[#E6CEE3] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9] dark:disabled:hover:bg-[#BB7FB5]"
            onclick={() => player.togglePlayback()}
            disabled={player.loading}
            aria-label={player.playing ? "Pause" : "Play"}
          >
            {#if player.loading}
              <div
                class="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent"
              ></div>
            {:else if player.playing}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="ml-0.5 h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M6.3 3.6a1 1 0 011.03.05l9 6a1 1 0 010 1.7l-9 6A1 1 0 016 16.5v-13a1 1 0 01.3-.9z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
          <button
            class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onclick={() => player.nextTrack()}
            aria-label="Next track"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z"
              />
            </svg>
          </button>
          <button
            class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            onclick={() => player.stop()}
            aria-label="Stop"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <rect x="5" y="5" width="10" height="10" rx="1" />
            </svg>
          </button>
        </div>

        <!-- Right: volume -->
        <div class="flex w-24 items-center justify-end gap-2">
          <button
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            onclick={() => player.setVolume(player.volume > 0 ? 0 : 1)}
            aria-label={player.volume === 0 ? "Unmute" : "Mute"}
          >
            {#if player.volume === 0}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={player.volume}
            oninput={(e) =>
              player.setVolume(Number((e.target as HTMLInputElement).value))}
            class="h-1 w-20 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#E6CEE3] dark:bg-neutral-700 dark:accent-[#BB7FB5]"
            aria-label="Volume"
          />
        </div>
      </div>
    </section>

    <!-- Lyrics + Up Next -->
    <section class="mt-8 grid gap-8 lg:grid-cols-2">
      <!-- Lyrics -->
      <div class="flex flex-col">
        <h2
          class="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400"
        >
          Lyrics
        </h2>
        <div class="mt-3 max-h-[60vh] overflow-y-auto pr-2">
          {#if lyricsLoading}
            <p
              class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
            >
              Loading lyrics...
            </p>
          {:else if !lyrics}
            <p
              class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
            >
              No lyrics available
            </p>
          {:else if isSynced}
            <div class="flex flex-col items-center gap-0.5 text-center">
              {#each lyrics.lines as line, i (i)}
                <button
                  type="button"
                  bind:this={lineEls[i]}
                  onclick={() => seekTo(line.ts_ms)}
                  class="block w-full max-w-md cursor-pointer rounded-md px-2 py-1.5 text-base leading-snug text-slate-900 transition-opacity duration-700 ease-out hover:bg-slate-100/60 dark:text-neutral-100 dark:hover:bg-neutral-800/60"
                  class:opacity-100={i === activeLineIndex}
                  class:opacity-60={activeLineIndex < 0}
                  class:opacity-30={i !== activeLineIndex &&
                    activeLineIndex >= 0}
                >
                  {line.text || "‧"}
                </button>
              {/each}
            </div>
          {:else}
            <pre
              class="font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-neutral-300">{lyrics.plain_text}</pre>
          {/if}
        </div>
      </div>

      <!-- Up Next -->
      <div class="flex flex-col">
        <div class="flex items-baseline justify-between">
          <h2
            class="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400"
          >
            Up next
          </h2>
          {#if player.upNext.length > 0}
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              onclick={() => player.clearUpNext()}
            >
              Clear all
            </button>
          {/if}
        </div>
        <div class="mt-3 max-h-[60vh] overflow-y-auto pr-2">
          {#if player.upNext.length === 0}
            <p
              class="py-8 text-center text-sm text-slate-400 dark:text-neutral-500"
            >
              Nothing up next.
            </p>
          {:else}
            <ul class="divide-y divide-slate-100 dark:divide-neutral-800">
              {#each player.upNext as item, idx (item.source + (item.track.id ?? item.track.title) + idx)}
                <li class="group flex items-center gap-3 py-2.5">
                  <div
                    class="w-6 shrink-0 text-right text-xs text-slate-400 tabular-nums dark:text-neutral-500"
                  >
                    {idx + 1}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div
                      class="truncate text-sm text-slate-900 dark:text-neutral-100"
                    >
                      {item.track.title}
                    </div>
                    <div
                      class="truncate text-xs text-slate-500 dark:text-neutral-400"
                    >
                      {item.context.trackArtistNames[item.track.id] ?? ""}
                      {#if item.context.title}
                        <span class="text-slate-300 dark:text-neutral-600"
                          >&middot;</span
                        >
                        {item.context.title}
                      {/if}
                    </div>
                  </div>
                  {#if item.track.duration_ms != null}
                    <div
                      class="shrink-0 text-xs text-slate-400 tabular-nums dark:text-neutral-500"
                    >
                      {formatDuration(item.track.duration_ms)}
                    </div>
                  {/if}
                  <button
                    type="button"
                    class="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                    title="Remove"
                    aria-label="Remove from up next"
                    onclick={() => player.removeFromUpNext(idx)}
                  >
                    <svg
                      class="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
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
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </section>
  </div>
{/if}
