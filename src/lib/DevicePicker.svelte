<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { Connection } from "./types";
  import { getDevices } from "./devices.svelte.ts";
  import { getPlayer } from "./player.svelte.ts";
  import DeviceIcon from "./DeviceIcon.svelte";
  import NowPlayingBars from "./NowPlayingBars.svelte";

  let { onopenpanel }: { onopenpanel: () => void } = $props();

  const devices = getDevices();
  const player = getPlayer();

  // This browser first, then the rest in the order they connected.
  let rows = $derived(
    [...devices.connections].sort(
      (a, b) =>
        Number(b.id === devices.selfId) - Number(a.id === devices.selfId),
    ),
  );
  let activeId = $derived(
    player.currentTrack ? devices.selfId : (devices.controlled?.id ?? null),
  );

  function isSelf(c: Connection): boolean {
    return c.id === devices.selfId;
  }

  function canTakeOver(c: Connection): boolean {
    return c.supported_commands.includes("handoff_queue");
  }

  function action(c: Connection): (() => void) | null {
    if (!devices.online || devices.pendingTarget != null || c.id === activeId) {
      return null;
    }
    if (isSelf(c)) {
      const controlled = devices.controlled;
      const playback = controlled ? devices.playbackOf(controlled) : null;
      if (!controlled || playback?.queue_revision == null) return null;
      return () => devices.playHere(controlled.id);
    }
    if (!player.currentTrack || !canTakeOver(c)) return null;
    return () => devices.moveTo(c.id);
  }

  function subline(c: Connection): string {
    const playback = devices.playbackOf(c);
    if (devices.pendingTarget === c.id) return "Moving playback…";
    if (c.id === activeId) {
      return (isSelf(c) ? !player.playing : playback?.state === "paused")
        ? "Paused"
        : "Now playing";
    }
    if (isSelf(c)) return "Idle";
    if (!canTakeOver(c)) return "Can't take over playback";
    if (c.remote_control_degraded) return "Not responding";
    if (playback) {
      const title = devices.trackOf(playback.track_id)?.title;
      const verb = playback.state === "paused" ? "Paused" : "Playing";
      return title ? `${verb} · ${title}` : verb;
    }
    return "Ready";
  }
</script>

<div
  class="absolute right-0 bottom-full z-20 mb-2 w-80 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
  role="dialog"
  aria-label="Play on"
>
  <div class="px-3 pt-2 pb-1">
    <p class="text-xs font-medium text-slate-500 dark:text-neutral-400">
      Play on
    </p>
    {#if !devices.online}
      <p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
        Reconnecting…
      </p>
    {:else if activeId == null}
      <p class="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
        Start playing something to move it to another device.
      </p>
    {/if}
  </div>

  <ul>
    {#each rows as c (c.id)}
      {@const active = c.id === activeId}
      {@const run = action(c)}
      {@const unavailable = !isSelf(c) && !canTakeOver(c)}
      {@const warn =
        c.remote_control_degraded && !active && devices.pendingTarget !== c.id}
      {@const error = devices.errors[c.id]}
      <li>
        <button
          type="button"
          disabled={run == null}
          onclick={() => run?.()}
          class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors enabled:hover:bg-slate-100 disabled:cursor-default dark:enabled:hover:bg-neutral-800"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            class:bg-[#E6CEE3]={active}
            class:text-slate-900={active}
            class:dark:bg-[#BB7FB5]={active}
            class:dark:text-white={active}
            class:bg-slate-100={!active}
            class:text-slate-500={!active}
            class:dark:bg-neutral-800={!active}
            class:dark:text-neutral-400={!active}
            class:opacity-50={unavailable}
          >
            <DeviceIcon kind={isSelf(c) ? "self" : "connection"} />
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-sm font-medium"
              class:text-slate-900={!unavailable}
              class:dark:text-neutral-100={!unavailable}
              class:text-slate-400={unavailable}
              class:dark:text-neutral-500={unavailable}
            >
              {devices.deviceName(c)}
            </span>
            <span
              class="block truncate text-xs"
              class:text-amber-600={warn}
              class:dark:text-amber-400={warn}
              class:text-slate-500={!warn}
              class:dark:text-neutral-400={!warn}
            >
              {subline(c)}
            </span>
          </span>
          {#if devices.pendingTarget === c.id}
            <span
              class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-transparent dark:border-neutral-400 dark:border-t-transparent"
            ></span>
          {:else if active}
            <NowPlayingBars
              playing={isSelf(c)
                ? player.playing
                : devices.playbackOf(c)?.state === "playing"}
            />
          {/if}
        </button>
        {#if error}
          <div
            class="mx-3 mb-2 flex items-start justify-between gap-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            <span>{error}</span>
            <button
              type="button"
              class="shrink-0 font-medium hover:underline"
              onclick={() => devices.dismissError(c.id)}>Dismiss</button
            >
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="my-1 h-px bg-slate-100 dark:bg-neutral-700"></div>
  <div class="flex justify-end px-3 py-1">
    <button
      type="button"
      class="rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      onclick={onopenpanel}
    >
      All devices
    </button>
  </div>
</div>
