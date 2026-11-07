<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { coverUrl } from "./api";
  import { getDevices } from "./devices.svelte.ts";
  import { getPlayer } from "./player.svelte.ts";
  import DeviceIcon from "./DeviceIcon.svelte";
  import DevicePicker from "./DevicePicker.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import CoverImage from "./CoverImage.svelte";
  import VolumeControl from "./VolumeControl.svelte";

  const player = getPlayer();
  const devices = getDevices();

  let pickerOpen = $state(false);
  // The server doesn't report a device's volume, so this only sets it.
  let remoteVolume = $state(1);

  function formatTime(s: number): string {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // The device this browser handed its playback to, when it isn't playing
  // anything itself; the bar then controls that device.
  let remote = $derived(player.currentTrack ? null : devices.controlled);
  let remotePlayback = $derived(remote ? devices.playbackOf(remote) : null);
  let remoteTrack = $derived(
    remotePlayback ? devices.trackOf(remotePlayback.track_id) : undefined,
  );

  let trackId = $derived(
    remote
      ? (remotePlayback?.track_id ?? null)
      : (player.currentTrack?.id ?? null),
  );
  let title = $derived(
    remote ? (remoteTrack?.title ?? "") : (player.currentTrack?.title ?? ""),
  );
  let artistNames = $derived(
    remote
      ? (remoteTrack?.artists ?? []).map((a) => a.name).join(", ")
      : player.currentArtistNames,
  );
  let cover = $derived.by(() => {
    if (!remote) return player.currentCover;
    const c = remoteTrack?.releases?.[0]?.cover;
    return { url: c ? coverUrl(c.id) : null, blurhash: c?.blurhash ?? null };
  });
  let playing = $derived(
    remote
      ? remotePlayback?.state === "playing" ||
          remotePlayback?.state === "buffering"
      : player.playing,
  );
  let positionS = $derived(
    remote
      ? remotePlayback
        ? devices.livePosition(remotePlayback) / 1000
        : 0
      : player.currentTime,
  );
  let durationS = $derived(
    remote ? (remotePlayback?.duration_ms ?? 0) / 1000 : player.duration,
  );
  let progress = $derived(durationS > 0 ? (positionS / durationS) * 100 : 0);

  function supports(action: string): boolean {
    return (
      !remote ||
      (devices.online && remote.supported_commands.some((c) => c === action))
    );
  }

  function onSeek(e: MouseEvent) {
    e.stopPropagation();
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (remote) {
      if (supports("seek"))
        devices.seek(remote.id, Math.round(ratio * durationS * 1000));
    } else {
      player.seek(ratio * player.duration);
    }
  }

  function handleBarClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, [data-device-picker]")) return;
    if (remote) devices.openPanel();
    else window.location.hash = "#/now-playing";
  }

  function previous() {
    if (remote) devices.previousTrack(remote.id);
    else player.prevTrack();
  }

  function toggle() {
    if (remote) devices.togglePlay(remote.id);
    else player.togglePlayback();
  }

  function stop() {
    if (remote) devices.stop(remote.id);
    else player.stop();
  }

  function next() {
    if (remote) devices.nextTrack(remote.id);
    else player.nextTrack();
  }

  let volume = $derived(remote ? remoteVolume : player.volume);

  function setVolume(v: number) {
    if (remote) remoteVolume = v;
    else player.setVolume(v);
  }

  // A device's volume is sent once the slider settles.
  function commitVolume() {
    if (remote) devices.setVolume(remote.id, remoteVolume);
  }

  function onWindowClick(e: MouseEvent) {
    if (!(e.target as HTMLElement | null)?.closest("[data-device-picker]")) {
      pickerOpen = false;
    }
  }
</script>

<svelte:window
  onclick={onWindowClick}
  onkeydown={(e) => e.key === "Escape" && (pickerOpen = false)}
/>

{#if player.notice}
  <div
    role="status"
    class="fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-neutral-700"
  >
    <span class="min-w-0">{player.notice}</span>
    <button
      type="button"
      class="shrink-0 text-xs text-slate-300 underline hover:text-white"
      onclick={player.dismissNotice}
    >
      Dismiss
    </button>
  </div>
{/if}

{#if player.currentTrack || remote}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed right-0 bottom-0 left-0 z-50 cursor-pointer border-t border-slate-200 bg-white shadow-lg transition-colors hover:bg-slate-50 dark:border-neutral-900 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:hover:bg-[#202224]"
    onclick={handleBarClick}
    title={remote ? "Open devices" : "Open Now Playing"}
  >
    {#if remote}
      <div
        class="flex items-center justify-center gap-1.5 bg-[#E6CEE3] px-4 py-0.5 text-xs font-medium text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
      >
        <DeviceIcon kind="connection" class="h-3.5 w-3.5" />
        Playing on {devices.deviceName(remote)}
      </div>
    {/if}
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
        <CoverImage {cover} class="h-10 w-10 rounded" />
        <div class="min-w-0">
          <p
            class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
          >
            {title}
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
        {#if trackId}
          <FavoriteButton
            targetId={trackId}
            label={title}
            size="sm"
            stopPropagation
          />
        {/if}
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onclick={previous}
          disabled={!supports("previous_track")}
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
          onclick={toggle}
          disabled={remote
            ? !supports(playing ? "pause" : "unpause") && !supports("play")
            : player.loading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {#if remote ? remotePlayback?.state === "buffering" : player.loading}
            <div
              class="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent"
            ></div>
          {:else if playing}
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
          onclick={stop}
          disabled={!supports("stop")}
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
          onclick={next}
          disabled={!supports("next_track")}
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
        <VolumeControl
          value={volume}
          disabled={!supports("set_volume")}
          title={remote
            ? "Sets the device's volume; its current level isn't reported"
            : undefined}
          oninput={setVolume}
          onchange={commitVolume}
        />
        <div class="relative" data-device-picker>
          <button
            type="button"
            class="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
            class:bg-[#E6CEE3]={remote}
            class:text-slate-900={remote}
            class:shadow-sm={remote}
            class:dark:bg-[#BB7FB5]={remote}
            class:dark:text-white={remote}
            class:text-slate-500={!remote}
            class:hover:bg-slate-100={!remote}
            class:hover:text-slate-700={!remote}
            class:dark:text-neutral-400={!remote}
            class:dark:hover:bg-neutral-800={!remote}
            class:dark:hover:text-neutral-200={!remote}
            aria-label="Choose a device"
            aria-expanded={pickerOpen}
            title={remote
              ? `Playing on ${devices.deviceName(remote)}`
              : "Devices"}
            onclick={() => (pickerOpen = !pickerOpen)}
          >
            <DeviceIcon kind="devices" />
            {#if !devices.online}
              <span
                class="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#1b1d1e]"
              ></span>
            {/if}
          </button>
          {#if pickerOpen}
            <DevicePicker
              onopenpanel={() => {
                pickerOpen = false;
                devices.openPanel();
              }}
            />
          {/if}
        </div>
        {#if !remote}
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
        {/if}
        <span class="text-xs text-slate-500 tabular-nums dark:text-neutral-400">
          {formatTime(positionS)} / {formatTime(durationS)}
        </span>
      </div>
    </div>
  </div>
{/if}
