<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type {
    ActivePlayback,
    Connection,
    RemoteAction,
    ResumablePlayback,
  } from "./types";
  import { coverUrl } from "./api";
  import { getDevices } from "./devices.svelte.ts";
  import { getPlayer } from "./player.svelte.ts";
  import CloseButton from "./CloseButton.svelte";
  import DeviceIcon from "./DeviceIcon.svelte";
  import TrackCover from "./TrackCover.svelte";
  import VolumeControl from "./VolumeControl.svelte";

  let { onclose }: { onclose: () => void } = $props();

  const devices = getDevices();
  const player = getPlayer();

  // The server doesn't report a device's volume, so the slider only sets it.
  let volumes = $state<Record<string, number>>({});

  function isSelf(c: Connection): boolean {
    return c.id === devices.selfId;
  }

  function remotePlayback(c: Connection): ActivePlayback | null {
    const p = devices.playbackOf(c);
    return p && p.state !== "stopped" && p.state !== "completed" ? p : null;
  }

  let others = $derived(devices.connections.filter((c) => !isSelf(c)));
  let self = $derived(devices.connections.find((c) => isSelf(c)) ?? null);
  let playing = $derived(others.filter((c) => remotePlayback(c) != null));
  let idle = $derived([
    ...(self && !player.currentTrack ? [self] : []),
    ...others.filter((c) => remotePlayback(c) == null),
  ]);

  function supports(c: Connection, a: RemoteAction): boolean {
    return devices.online && c.supported_commands.includes(a);
  }

  function canMoveTo(c: Connection): boolean {
    return (
      devices.online &&
      player.currentTrack != null &&
      !player.loading &&
      devices.pendingTarget == null &&
      c.supported_commands.includes("handoff_queue")
    );
  }

  function formatTime(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "0:00";
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
  }

  function seekRatio(e: MouseEvent): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  function coverOf(trackId: string) {
    const cover = devices.trackOf(trackId)?.releases?.[0]?.cover;
    return {
      url: cover ? coverUrl(cover.id) : null,
      blurhash: cover?.blurhash ?? null,
    };
  }

  function leftBy(p: ResumablePlayback): string {
    const name =
      p.client_name?.trim() || (p.plugin_id ? "External player" : "Lyra");
    return p.plugin_id ? `${name} · via ${p.plugin_id}` : name;
  }

  function leftAt(p: ResumablePlayback): string {
    const at = new Date(p.updated_at);
    return Number.isNaN(at.getTime())
      ? ""
      : at.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }

  function artistsOf(trackId: string): string {
    const artists = devices.trackOf(trackId)?.artists ?? [];
    return artists.map((a) => a.name).join(", ");
  }

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";
  const playButton =
    "flex h-9 w-9 items-center justify-center rounded-full bg-[#E6CEE3] text-slate-900 shadow-sm transition-all hover:scale-105 hover:bg-[#d4b5cf] disabled:scale-100 disabled:opacity-40 disabled:hover:bg-[#E6CEE3] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9] dark:disabled:hover:bg-[#BB7FB5]";
  const pillButton =
    "shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800";
  const card =
    "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-[#222425] dark:shadow-black/40";
  const sectionLabel =
    "mb-2 px-1 text-xs font-medium text-slate-500 dark:text-neutral-400";
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

{#snippet transport(
  isPlaying: boolean,
  buffering: boolean,
  can: {
    previous: boolean;
    toggle: boolean;
    next: boolean;
    stop: boolean;
  },
  on: {
    previous: () => void;
    toggle: () => void;
    next: () => void;
    stop: () => void;
  },
)}
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      aria-label="Previous"
      class={iconButton}
      disabled={!can.previous}
      onclick={on.previous}
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"
        />
      </svg>
    </button>
    <button
      type="button"
      aria-label={isPlaying ? "Pause" : "Play"}
      class={playButton}
      disabled={!can.toggle}
      onclick={on.toggle}
    >
      {#if buffering}
        <div
          class="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent"
        ></div>
      {:else if isPlaying}
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M5 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
            clip-rule="evenodd"
          />
        </svg>
      {:else}
        <svg class="ml-0.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
      aria-label="Next"
      class={iconButton}
      disabled={!can.next}
      onclick={on.next}
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z"
        />
      </svg>
    </button>
    <button
      type="button"
      aria-label="Stop"
      class={iconButton}
      disabled={!can.stop}
      onclick={on.stop}
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <rect x="5" y="5" width="10" height="10" rx="1" />
      </svg>
    </button>
  </div>
{/snippet}

{#snippet progress(
  positionMs: number,
  durationMs: number,
  isPlaying: boolean,
  canSeek: boolean,
  onseek: (ratio: number) => void,
)}
  {@const pct =
    durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0}
  <div class="px-3 pt-3">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
      class:cursor-pointer={canSeek && durationMs > 0}
      onclick={(e) => canSeek && durationMs > 0 && onseek(seekRatio(e))}
    >
      <div
        class="h-full transition-[width] duration-200 ease-out"
        class:bg-[#E6CEE3]={isPlaying}
        class:dark:bg-[#BB7FB5]={isPlaying}
        class:bg-slate-400={!isPlaying}
        class:dark:bg-neutral-500={!isPlaying}
        style="width: {pct}%"
      ></div>
    </div>
    <div
      class="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums dark:text-neutral-500"
    >
      <span>{formatTime(positionMs)}</span>
      <span>{durationMs > 0 ? formatTime(durationMs) : "--:--"}</span>
    </div>
  </div>
{/snippet}

{#snippet cardHeader(
  name: string,
  kind: "self" | "connection",
  degraded: boolean,
  controlled: boolean,
)}
  <div
    class="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-neutral-800"
  >
    <span class="text-slate-500 dark:text-neutral-400">
      <DeviceIcon {kind} />
    </span>
    <span
      class="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-neutral-200"
    >
      {name}
    </span>
    {#if degraded}
      <span
        class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        title="Commands were sent but the device hasn't reported back"
        >Not responding</span
      >
    {/if}
    {#if controlled}
      <span
        class="rounded-full bg-[#E6CEE3]/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-[#BB7FB5]/25 dark:text-[#E6CEE3]"
        title="The player bar controls this device">Active</span
      >
    {/if}
  </div>
{/snippet}

{#snippet trackRow(
  cover: { url: string | null; blurhash: string | null },
  title: string,
  artists: string,
)}
  <div class="flex items-center gap-3 px-3 pt-3">
    <TrackCover
      url={cover.url}
      blurhash={cover.blurhash}
      class="h-12 w-12 rounded-md"
    />
    <div class="min-w-0 flex-1">
      <p
        class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
        {title}
      >
        {title}
      </p>
      {#if artists}
        <p class="truncate text-xs text-slate-500 dark:text-neutral-400">
          {artists}
        </p>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet errorNote(id: string)}
  {#if devices.errors[id]}
    <div
      class="mt-2 flex items-start justify-between gap-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      <span>{devices.errors[id]}</span>
      <button
        type="button"
        class="shrink-0 font-medium hover:underline"
        onclick={() => devices.dismissError(id)}>Dismiss</button
      >
    </div>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-black/50"
  onclick={(e) => e.target === e.currentTarget && onclose()}
>
  <div
    role="dialog"
    aria-label="Devices"
    tabindex="-1"
    class="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#1b1d1e] dark:shadow-black/60"
  >
    <header
      class="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-neutral-800"
    >
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">
          Devices
        </h2>
        {#if !devices.online}
          <p class="text-sm text-amber-600 dark:text-amber-400">
            Reconnecting… controls are paused
          </p>
        {/if}
      </div>
      <CloseButton onclick={onclose} />
    </header>

    <div class="flex-1 space-y-6 overflow-y-auto px-4 py-4">
      {#if player.currentTrack || playing.length > 0}
        <section>
          <h3 class={sectionLabel}>Playing</h3>
          <ul class="space-y-3">
            {#if player.currentTrack}
              {@const track = player.currentTrack}
              <li class={card}>
                {@render cardHeader("This browser", "self", false, true)}
                {@render trackRow(
                  player.currentCover,
                  track.title,
                  player.currentArtistNames,
                )}
                {@render progress(
                  player.currentTime * 1000,
                  player.duration * 1000,
                  player.playing,
                  true,
                  (ratio) => player.seek(ratio * player.duration),
                )}
                <div class="flex items-center gap-2 px-3 pt-1 pb-3">
                  {@render transport(
                    player.playing,
                    player.loading,
                    {
                      previous: true,
                      toggle: !player.loading,
                      next: true,
                      stop: true,
                    },
                    {
                      previous: () => player.prevTrack(),
                      toggle: () => player.togglePlayback(),
                      next: () => player.nextTrack(),
                      stop: () => player.stop(),
                    },
                  )}
                  <VolumeControl
                    class="ml-2"
                    value={player.volume}
                    oninput={(v) => player.setVolume(v)}
                  />
                </div>
              </li>
            {/if}
            {#each playing as c (c.id)}
              {@const p = remotePlayback(c)!}
              {@const isPlaying =
                p.state === "playing" || p.state === "buffering"}
              {@const controlled = devices.controlled?.id === c.id}
              <li class={card}>
                {@render cardHeader(
                  devices.deviceName(c),
                  "connection",
                  c.remote_control_degraded,
                  controlled,
                )}
                {@render trackRow(
                  coverOf(p.track_id),
                  devices.trackOf(p.track_id)?.title ?? "Loading track…",
                  artistsOf(p.track_id),
                )}
                {@render progress(
                  devices.livePosition(p),
                  p.duration_ms ?? 0,
                  isPlaying,
                  supports(c, "seek"),
                  (ratio) =>
                    devices.seek(
                      c.id,
                      Math.round(ratio * (p.duration_ms ?? 0)),
                    ),
                )}
                <div
                  class="flex items-center justify-between gap-2 px-3 pt-1 pb-3"
                >
                  <div class="flex items-center">
                    {@render transport(
                      isPlaying,
                      p.state === "buffering",
                      {
                        previous: supports(c, "previous_track"),
                        toggle: isPlaying
                          ? supports(c, "pause")
                          : supports(c, "unpause") || supports(c, "play"),
                        next: supports(c, "next_track"),
                        stop: supports(c, "stop"),
                      },
                      {
                        previous: () => devices.previousTrack(c.id),
                        toggle: () => devices.togglePlay(c.id),
                        next: () => devices.nextTrack(c.id),
                        stop: () => devices.stop(c.id),
                      },
                    )}
                    {#if c.supported_commands.includes("set_volume")}
                      <VolumeControl
                        class="ml-2"
                        value={volumes[c.id] ?? 1}
                        disabled={!supports(c, "set_volume")}
                        title="Sets the device's volume; its current level isn't reported"
                        oninput={(v) => (volumes = { ...volumes, [c.id]: v })}
                        onchange={() =>
                          devices.setVolume(c.id, volumes[c.id] ?? 1)}
                      />
                    {/if}
                  </div>
                  {#if p.queue_revision != null}
                    <button
                      type="button"
                      class={pillButton}
                      disabled={!devices.online}
                      onclick={() => devices.playHere(c.id)}
                    >
                      Play here
                    </button>
                  {/if}
                </div>
                {#if devices.errors[c.id]}
                  <div class="px-3 pb-3">{@render errorNote(c.id)}</div>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if !player.currentTrack && playing.length === 0 && devices.resumable.length > 0}
        <section>
          <h3 class={sectionLabel}>Continue</h3>
          <ul class="space-y-2">
            {#each devices.resumable as p (p.playback_id)}
              {@const trackId = p.current?.track_id}
              <li
                class="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-neutral-800"
              >
                <div class="flex items-center gap-3">
                  <TrackCover
                    {...trackId
                      ? coverOf(trackId)
                      : { url: null, blurhash: null }}
                    class="h-10 w-10 rounded"
                  />
                  <div class="min-w-0 flex-1">
                    <p
                      class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
                    >
                      {trackId
                        ? (devices.trackOf(trackId)?.title ?? "Loading track…")
                        : "Saved queue"}
                    </p>
                    <p
                      class="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-neutral-400"
                    >
                      <DeviceIcon
                        kind={p.plugin_id ? "external" : "connection"}
                        class="h-3 w-3 shrink-0"
                      />
                      <span class="truncate">
                        {leftBy(p)}{leftAt(p) ? ` · ${leftAt(p)}` : ""}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    class={pillButton}
                    disabled={player.loading}
                    onclick={() => devices.resume(p.playback_id)}
                  >
                    Resume
                  </button>
                </div>
                {@render errorNote(p.playback_id)}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section>
        <h3 class={sectionLabel}>
          {player.currentTrack || playing.length > 0
            ? "Other devices"
            : "Connected devices"}
        </h3>
        <ul
          class="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-neutral-800 dark:border-neutral-800"
        >
          {#each idle as c (c.id)}
            {@const pending = devices.pendingTarget === c.id}
            {@const handoff =
              isSelf(c) || c.supported_commands.includes("handoff_queue")}
            <li class="px-3 py-2.5">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
                  class:opacity-50={!handoff}
                >
                  <DeviceIcon kind={isSelf(c) ? "self" : "connection"} />
                </span>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
                  >
                    {devices.deviceName(c)}
                  </p>
                  <p
                    class="truncate text-xs"
                    class:text-amber-600={c.remote_control_degraded}
                    class:dark:text-amber-400={c.remote_control_degraded}
                    class:text-slate-500={!c.remote_control_degraded}
                    class:dark:text-neutral-400={!c.remote_control_degraded}
                  >
                    {#if pending}
                      Moving playback…
                    {:else if !handoff}
                      Remote control only
                    {:else if c.remote_control_degraded}
                      Not responding
                    {:else}
                      Idle
                    {/if}
                  </p>
                </div>
                {#if pending}
                  <span
                    class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-transparent dark:border-neutral-400 dark:border-t-transparent"
                  ></span>
                {:else if handoff && !isSelf(c)}
                  <button
                    type="button"
                    class={pillButton}
                    disabled={!canMoveTo(c)}
                    title={player.currentTrack
                      ? undefined
                      : "Nothing is playing in this browser"}
                    onclick={() => devices.moveTo(c.id)}
                  >
                    Play on this
                  </button>
                {/if}
              </div>
              {@render errorNote(c.id)}
            </li>
          {:else}
            <li
              class="px-3 py-4 text-center text-xs text-slate-500 dark:text-neutral-400"
            >
              Open Lyra on another device to control it from here.
            </li>
          {/each}
        </ul>
      </section>

      {#if devices.externalPlaybacks.length > 0}
        <section>
          <h3 class={sectionLabel}>Other players</h3>
          <ul class="space-y-2">
            {#each devices.externalPlaybacks as p (p.playback_id)}
              {@const dur = p.duration_ms ?? 0}
              {@const pct =
                dur > 0
                  ? Math.min(100, (devices.livePosition(p) / dur) * 100)
                  : 0}
              <li
                class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-neutral-800"
              >
                <TrackCover
                  {...coverOf(p.track_id)}
                  class="h-10 w-10 rounded"
                />
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium text-slate-900 dark:text-neutral-100"
                  >
                    {devices.trackOf(p.track_id)?.title ?? "Loading track…"}
                  </p>
                  <p
                    class="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-neutral-400"
                  >
                    <DeviceIcon kind="external" class="h-3 w-3 shrink-0" />
                    <span class="truncate">
                      {p.client_name?.trim() || "External player"} · via {p.plugin_id}
                    </span>
                  </p>
                  <div
                    class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700"
                  >
                    <div
                      class="h-full"
                      class:bg-[#E6CEE3]={p.state === "playing"}
                      class:dark:bg-[#BB7FB5]={p.state === "playing"}
                      class:bg-slate-400={p.state !== "playing"}
                      class:dark:bg-neutral-500={p.state !== "playing"}
                      style="width: {pct}%"
                    ></div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
          <p class="mt-2 px-1 text-xs text-slate-400 dark:text-neutral-500">
            Reported by plugins. Lyra can see these but not control them.
          </p>
        </section>
      {/if}
    </div>
  </div>
</div>
