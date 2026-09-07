<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { TrackResponse } from "./types";
  import { playMixFromTracks } from "./mix.svelte.ts";
  import MixIcon from "./MixIcon.svelte";

  interface Props {
    label?: string;
    title: string;
    load: () => Promise<TrackResponse[]>;
    startTrack?: TrackResponse;
    cover?: { url: string | null; blurhash: string | null };
    variant?: "pill" | "icon";
    class?: string;
  }

  let {
    label = "Mix",
    title,
    load,
    startTrack,
    cover,
    variant = "pill",
    class: className = "",
  }: Props = $props();

  let iconLabel = $derived(label === "Mix" ? title : label);

  let loading = $state(false);

  async function handleClick() {
    if (loading) return;
    loading = true;
    try {
      const tracks = await load();
      await playMixFromTracks(tracks, title, startTrack, cover);
    } catch (e) {
      console.error("Mix failed:", e);
    } finally {
      loading = false;
    }
  }
</script>

{#if variant === "icon"}
  <button
    type="button"
    class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 {className}"
    disabled={loading}
    aria-label={iconLabel}
    title={iconLabel}
    onclick={handleClick}
  >
    {#if loading}
      <svg
        class="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        ></path>
      </svg>
    {:else}
      <MixIcon />
    {/if}
  </button>
{:else}
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-200 dark:hover:bg-neutral-700 {className}"
    disabled={loading}
    onclick={handleClick}
  >
    <MixIcon class="h-4 w-4" />
    {loading ? "Loading..." : label}
  </button>
{/if}
