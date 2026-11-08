<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { getPlayer } from "./player.svelte.ts";
  import CoverImage from "./CoverImage.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import LyricsPanel from "./LyricsPanel.svelte";
  import RatingButton from "./RatingButton.svelte";
  import VolumeControl from "./VolumeControl.svelte";

  const player = getPlayer();

  let artistNames = $derived(player.currentArtistNames);
  let track = $derived(
    player.playbackContext?.tracks.find(
      (track) => track.id === player.currentTrack?.id,
    ) ?? player.currentTrack,
  );
  let release = $derived(track?.releases?.[0] ?? null);
  let artists = $derived.by(() => {
    const credits = track?.artists ?? [];
    const primary = credits.filter(
      (artist) => (artist.credit?.type ?? "artist") === "artist",
    );
    return primary.length > 0 ? primary : credits;
  });

  let progressPct = $derived(
    player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0,
  );

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
      <CoverImage
        cover={player.currentCover}
        class="h-56 w-56 rounded-lg shadow-md sm:h-64 sm:w-64 dark:shadow-black/40"
        iconClass="h-16 w-16"
      />

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
            <RatingButton
              targetId={player.currentTrack.id}
              label={player.currentTrack.title}
            />
          {/if}
        </div>
        {#if artists.length > 0}
          <p class="mt-1 text-base text-slate-600 dark:text-neutral-300">
            {#each artists as artist, i}
              {#if i > 0},
              {/if}
              <a
                href={`#/artists/${artist.id}`}
                class="rounded-sm hover:text-slate-900 hover:underline focus-visible:underline dark:hover:text-neutral-100"
                >{artist.name}</a
              >
            {/each}
          </p>
        {:else if artistNames}
          <p class="mt-1 text-base text-slate-600 dark:text-neutral-300">
            {artistNames}
          </p>
        {/if}
        {#if release}
          <p class="mt-1 text-sm text-slate-400 dark:text-neutral-500">
            From <a
              href={`#/albums/${release.id}`}
              class="rounded-sm hover:text-slate-700 hover:underline focus-visible:underline dark:hover:text-neutral-200"
              >{release.title}</a
            >
          </p>
        {:else if player.playbackContext?.title}
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
        <div class="flex w-24 items-center justify-end">
          <VolumeControl
            value={player.volume}
            oninput={(v) => player.setVolume(v)}
          />
        </div>
      </div>
    </section>

    <!-- Lyrics + Up Next -->
    <section class="mt-8 grid gap-8 lg:grid-cols-2">
      {#if player.currentTrack.id}
        <LyricsPanel trackId={player.currentTrack.id} />
      {/if}

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
