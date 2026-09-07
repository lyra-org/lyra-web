<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { getPlayer } from "./player.svelte.ts";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";

  const player = getPlayer();

  function formatTime(s: number): string {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function onSeek(e: MouseEvent) {
    e.stopPropagation();
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    player.seek(ratio * player.duration);
  }

  function handleBarClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input")) return;
    window.location.hash = "#/now-playing";
  }

  let artistNames = $derived(player.currentArtistNames);
  let coverSrc = $derived(player.playbackContext?.coverUrl ?? null);
  let coverBlurhash = $derived(player.playbackContext?.coverBlurhash ?? null);

  let progress = $derived(
    player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0,
  );
</script>

{#if player.currentTrack}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed right-0 bottom-0 left-0 z-50 cursor-pointer border-t border-slate-200 bg-white shadow-lg transition-colors hover:bg-slate-50 dark:border-neutral-900 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:hover:bg-[#202224]"
    onclick={handleBarClick}
    title="Open Now Playing"
  >
    <!-- Seek bar -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
      onclick={onSeek}
    >
      <div
        class="h-full bg-[#E6CEE3] transition-[width] duration-200 ease-out dark:bg-[#BB7FB5]"
        style="width: {progress}%"
      ></div>
    </div>

    <div class="flex items-center gap-4 px-4 py-2">
      <!-- Left: cover + track info -->
      <div class="flex min-w-0 flex-1 items-center gap-3">
        {#if coverSrc}
          <div class="relative h-10 w-10 shrink-0 overflow-hidden rounded">
            {#if coverBlurhash}
              <BlurhashCanvas
                hash={coverBlurhash}
                class="absolute inset-0 h-full w-full object-cover"
              />
            {/if}
            <img
              src={coverSrc}
              alt=""
              class="relative h-full w-full object-cover"
            />
          </div>
        {:else if coverBlurhash}
          <BlurhashCanvas
            hash={coverBlurhash}
            class="h-10 w-10 shrink-0 rounded object-cover"
          />
        {:else}
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-400 dark:bg-neutral-600 dark:text-neutral-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
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
        <div class="min-w-0">
          <p
            class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
          >
            {player.currentTrack.title}
          </p>
          {#if artistNames}
            <p class="truncate text-xs text-slate-500 dark:text-neutral-400">
              {artistNames}
            </p>
          {/if}
        </div>
      </div>

      <!-- Center: controls -->
      <div class="flex items-center gap-2">
        {#if player.currentTrack.id}
          <FavoriteButton
            targetId={player.currentTrack.id}
            label={player.currentTrack.title}
            size="sm"
            stopPropagation
          />
        {/if}
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onclick={() => player.prevTrack()}
          aria-label="Previous track"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"
            />
          </svg>
        </button>
        <button
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#E6CEE3] text-slate-900 shadow-sm transition-all hover:scale-105 hover:bg-[#d4b5cf] disabled:scale-100 disabled:opacity-40 disabled:hover:bg-[#E6CEE3] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9] dark:disabled:hover:bg-[#BB7FB5]"
          onclick={() => player.togglePlayback()}
          disabled={player.loading}
          aria-label={player.playing ? "Pause" : "Play"}
        >
          {#if player.loading}
            <div
              class="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent"
            ></div>
          {:else if player.playing}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
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
              class="ml-0.5 h-4 w-4"
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
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onclick={() => player.nextTrack()}
          aria-label="Next track"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z"
            />
          </svg>
        </button>
      </div>

      <!-- Right: volume + time -->
      <div class="flex flex-1 items-center justify-end gap-3">
        <div class="flex items-center gap-1.5">
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
        <button
          type="button"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
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
        <span class="text-xs text-slate-500 tabular-nums dark:text-neutral-400">
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
        </span>
      </div>
    </div>
  </div>
{/if}
