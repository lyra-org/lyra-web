<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    ActivePlaybackSession,
    PlaybackState,
    RemoteAction,
    TrackResponse,
  } from "./types";
  import { getRemote } from "./remote.svelte";
  import { getPlayer } from "./player.svelte";
  import { coverUrl } from "./api";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  const remote = getRemote();
  const player = getPlayer();

  let now = $state(Date.now());
  let pendingVolume = $state<Record<string, number>>({});

  $effect(() => {
    const tick = setInterval(() => {
      now = Date.now();
    }, 250);
    return () => clearInterval(tick);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function trackOf(id: string): TrackResponse | undefined {
    return remote.tracks[id];
  }

  function coverFor(track?: TrackResponse) {
    const release = track?.releases?.[0];
    const cover = release?.cover;
    if (!cover)
      return { url: null as string | null, blurhash: null as string | null };
    return {
      url: coverUrl(cover.id),
      blurhash: cover.blurhash ?? null,
    };
  }

  function artistNamesFor(track?: TrackResponse): string {
    if (!track?.artists?.length) return "";
    return track.artists.map((a) => a.name).join(", ");
  }

  function livePosition(s: ActivePlaybackSession): number {
    if (s.state !== "playing") return s.effective_position_ms;
    const updated = Date.parse(s.updated_at);
    if (!Number.isFinite(updated)) return s.effective_position_ms;
    const elapsed = Math.max(0, now - updated);
    const max = s.duration_ms ?? Number.POSITIVE_INFINITY;
    return Math.min(max, s.position_ms + elapsed);
  }

  function formatTime(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "0:00";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function relativeTime(ms: number): string {
    if (ms <= 0) return "just now";
    const s = Math.floor((now - ms) / 1000);
    if (s < 2) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  function supports(s: ActivePlaybackSession, a: RemoteAction): boolean {
    return s.supported_commands.includes(a);
  }

  function isSelf(s: ActivePlaybackSession): boolean {
    return (
      player.playbackSessionId != null &&
      player.playbackSessionId === s.playback_session_id
    );
  }

  function deviceLabel(s: ActivePlaybackSession): string {
    if (isSelf(s)) return "This browser";
    const key = s.connection_session_key;
    if (key && key.length > 0) {
      if (/^[0-9a-f-]{8,}$/i.test(key)) return `Device ${key.slice(0, 6)}`;
      return key;
    }
    if (!s.connection_token) return "Offline session";
    return "Connected device";
  }

  function stateBadge(state: PlaybackState): string {
    switch (state) {
      case "playing":
        return "Playing";
      case "paused":
        return "Paused";
      case "buffering":
        return "Buffering";
      case "completed":
        return "Completed";
      case "stopped":
      default:
        return "Stopped";
    }
  }

  function controllable(s: ActivePlaybackSession): boolean {
    return s.connection_token != null && s.supported_commands.length > 0;
  }

  function onSeekClick(e: MouseEvent, s: ActivePlaybackSession) {
    if (!controllable(s) || !supports(s, "seek")) return;
    if (s.duration_ms == null || s.duration_ms <= 0) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const ms = Math.round(ratio * s.duration_ms);
    remote.seek(s.connection_token!, ms);
  }

  function togglePlay(s: ActivePlaybackSession) {
    if (!controllable(s) || !s.connection_token) return;
    if (s.state === "playing" || s.state === "buffering") {
      if (supports(s, "pause")) remote.pause(s.connection_token);
    } else if (s.state === "paused") {
      if (supports(s, "unpause")) remote.unpause(s.connection_token);
      else if (supports(s, "play")) remote.play(s.connection_token);
    } else {
      if (supports(s, "play")) remote.play(s.connection_token);
    }
  }

  function togglePlayDisabled(s: ActivePlaybackSession): boolean {
    if (!controllable(s)) return true;
    if (s.state === "playing" || s.state === "buffering") {
      return !supports(s, "pause");
    }
    if (s.state === "paused") {
      return !supports(s, "unpause") && !supports(s, "play");
    }
    return !supports(s, "play");
  }

  function volumeOf(s: ActivePlaybackSession): number {
    return pendingVolume[s.playback_session_id] ?? 1;
  }

  function onVolumeInput(e: Event, s: ActivePlaybackSession) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    pendingVolume = { ...pendingVolume, [s.playback_session_id]: v };
  }

  function onVolumeCommit(s: ActivePlaybackSession) {
    if (!controllable(s) || !supports(s, "set_volume") || !s.connection_token)
      return;
    const v = volumeOf(s);
    remote.setVolume(s.connection_token, v);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="dialog"
    aria-label="Remote control"
    tabindex="-1"
    class="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#1b1d1e] dark:shadow-black/60"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <header
      class="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-neutral-800"
    >
      <div class="flex items-center gap-3">
        <div class="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-slate-700 dark:text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 11h5M2 15h3" stroke-linecap="round" />
            <circle cx="17" cy="14" r="1.6" fill="currentColor" />
          </svg>
          {#if remote.sessions.length > 0}
            <span
              class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E6CEE3] px-1 text-[10px] font-semibold text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
            >
              {remote.sessions.length}
            </span>
          {/if}
        </div>
        <div>
          <h2
            class="text-base font-semibold text-slate-900 dark:text-neutral-100"
          >
            Remote control
          </h2>
          <p class="text-xs text-slate-500 dark:text-neutral-400">
            {#if remote.loading && remote.sessions.length === 0}
              Loading…
            {:else if remote.lastRefreshAt > 0}
              Updated {relativeTime(remote.lastRefreshAt)}
            {:else}
              &nbsp;
            {/if}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          aria-label="Refresh"
          title="Refresh"
          disabled={remote.loading}
          onclick={() => remote.refresh()}
          class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            class:animate-spin={remote.loading}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-4M20 14a8 8 0 01-14 4"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Close"
          class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-4 py-4">
      {#if remote.error}
        <div
          class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {remote.error}
        </div>
      {/if}

      {#if remote.sessions.length === 0}
        {#if remote.loading}
          <div class="space-y-3">
            {#each [0, 1] as _ (_)}
              <div
                class="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-neutral-800/60"
              ></div>
            {/each}
          </div>
        {:else}
          <div
            class="mt-12 flex flex-col items-center justify-center gap-3 text-center"
          >
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" stroke-linecap="round" />
              </svg>
            </div>
            <div>
              <p
                class="text-sm font-medium text-slate-700 dark:text-neutral-200"
              >
                No active sessions
              </p>
              <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Start playing on any device to control it from here.
              </p>
            </div>
          </div>
        {/if}
      {:else}
        <ul class="space-y-3">
          {#each remote.sessions as s (s.playback_session_id)}
            {@const t = trackOf(s.track_id)}
            {@const cv = coverFor(t)}
            {@const artistNames = artistNamesFor(t)}
            {@const badge = stateBadge(s.state)}
            {@const pos = livePosition(s)}
            {@const dur = s.duration_ms ?? 0}
            {@const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0}
            {@const playing = s.state === "playing" || s.state === "buffering"}
            {@const self = isSelf(s)}
            {@const ctrl = controllable(s)}
            <li
              class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-[#222425] dark:shadow-black/40"
              class:opacity-90={!ctrl}
            >
              <!-- Header row -->
              <div class="flex items-start gap-3 px-3 pt-3">
                <div
                  class="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-neutral-800"
                >
                  {#if cv.blurhash}
                    <BlurhashCanvas
                      hash={cv.blurhash}
                      class="absolute inset-0 h-full w-full object-cover"
                    />
                  {/if}
                  {#if cv.url}
                    <img
                      src={cv.url}
                      alt=""
                      class="relative h-full w-full object-cover"
                    />
                  {:else if !cv.blurhash}
                    <div
                      class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z"
                        />
                      </svg>
                    </div>
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      class="inline-flex items-center text-xs font-medium text-slate-500 dark:text-neutral-400"
                    >
                      {badge}
                    </span>
                    {#if self}
                      <span
                        class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-neutral-800 dark:text-neutral-400"
                        >This browser</span
                      >
                    {/if}
                    {#if s.remote_control_degraded}
                      <span
                        class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        title="Commands dispatched but no state update received within timeout"
                        >Degraded</span
                      >
                    {/if}
                    {#if !s.connection_token}
                      <span
                        class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-neutral-800 dark:text-neutral-500"
                        >Read-only</span
                      >
                    {/if}
                  </div>
                  <p
                    class="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
                    title={t?.title ?? s.track_id}
                  >
                    {t?.title ?? "Loading track…"}
                  </p>
                  <p
                    class="truncate text-xs text-slate-500 dark:text-neutral-400"
                    title={artistNames || deviceLabel(s)}
                  >
                    {#if artistNames}
                      {artistNames} · {deviceLabel(s)}
                    {:else}
                      {deviceLabel(s)}
                    {/if}
                  </p>
                </div>
              </div>

              <!-- Progress -->
              <div class="px-3 pt-3">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="group relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
                  class:cursor-pointer={ctrl && supports(s, "seek") && dur > 0}
                  class:cursor-not-allowed={!(
                    ctrl &&
                    supports(s, "seek") &&
                    dur > 0
                  )}
                  onclick={(e) => onSeekClick(e, s)}
                >
                  <div
                    class="h-full transition-[width] duration-200 ease-out"
                    class:bg-slate-400={!playing}
                    class:dark:bg-neutral-500={!playing}
                    class:bg-[#E6CEE3]={playing}
                    class:dark:bg-[#BB7FB5]={playing}
                    style="width: {pct}%"
                  ></div>
                </div>
                <div
                  class="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums dark:text-neutral-500"
                >
                  <span>{formatTime(pos)}</span>
                  <span>{dur > 0 ? formatTime(dur) : "--:--"}</span>
                </div>
              </div>

              <!-- Controls -->
              <div
                class="flex items-center justify-between gap-2 px-3 pt-2 pb-3"
              >
                <div class="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Previous"
                    disabled={!ctrl || !supports(s, "previous_track")}
                    onclick={() =>
                      s.connection_token &&
                      remote.previousTrack(s.connection_token)}
                    class="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
                    type="button"
                    aria-label={playing ? "Pause" : "Play"}
                    disabled={togglePlayDisabled(s)}
                    onclick={() => togglePlay(s)}
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6CEE3] text-slate-900 shadow-sm transition-all hover:scale-105 hover:bg-[#d4b5cf] disabled:scale-100 disabled:opacity-40 disabled:hover:bg-[#E6CEE3] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9] dark:disabled:hover:bg-[#BB7FB5]"
                  >
                    {#if s.state === "buffering"}
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
                    type="button"
                    aria-label="Stop"
                    disabled={!ctrl || !supports(s, "stop")}
                    onclick={() =>
                      s.connection_token && remote.stop(s.connection_token)}
                    class="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
                    type="button"
                    aria-label="Next"
                    disabled={!ctrl || !supports(s, "next_track")}
                    onclick={() =>
                      s.connection_token &&
                      remote.nextTrack(s.connection_token)}
                    class="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
                <div class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M9.4 3.1A1 1 0 0110 4v12a1 1 0 01-1.7.7L4.6 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.6l3.7-3.7a1 1 0 011.1-.2zM14.7 2.9a1 1 0 011.4 0A10 10 0 0119 10a10 10 0 01-2.9 7.1 1 1 0 01-1.4-1.4A8 8 0 0017 10c0-2.2-.9-4.2-2.3-5.7a1 1 0 010-1.4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volumeOf(s)}
                    disabled={!ctrl || !supports(s, "set_volume")}
                    title={supports(s, "set_volume")
                      ? "Set remote volume"
                      : "Volume not supported"}
                    oninput={(e) => onVolumeInput(e, s)}
                    onchange={() => onVolumeCommit(s)}
                    class="h-1 w-20 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#E6CEE3] disabled:cursor-not-allowed disabled:opacity-30 dark:bg-neutral-700 dark:accent-[#BB7FB5]"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>
