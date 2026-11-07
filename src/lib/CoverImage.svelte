<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  // A load this soon after the src was set came from the browser's cache.
  const CACHED_LOAD_MS = 50;

  interface Props {
    cover: { url: string | null; blurhash?: string | null } | null | undefined;
    alt?: string;
    // Size, shape and shadow of the box, such as "h-10 w-10 rounded".
    class?: string;
    imageClass?: string;
    icon?: "music" | "person";
    iconClass?: string;
    lazy?: boolean;
  }

  let {
    cover,
    alt = "",
    class: className = "",
    imageClass = "",
    icon = "music",
    iconClass = "h-1/2 w-1/2",
    lazy = false,
  }: Props = $props();

  let image = $state<HTMLImageElement | null>(null);
  let failedUrl = $state<string | null>(null);
  let loadedUrl = $state<string | null>(null);
  let fading = $state(false);
  let requestedAt = 0;

  let src = $derived(cover?.url && cover.url !== failedUrl ? cover.url : null);

  // Only a slow load fades in, so revisiting a list or page doesn't replay it.
  $effect(() => {
    if (!src) return;
    requestedAt = performance.now();
    fading = false;
    if (image?.complete && image.naturalWidth > 0) loadedUrl = src;
  });

  function handleLoad() {
    fading = performance.now() - requestedAt > CACHED_LOAD_MS;
    loadedUrl = src;
  }
</script>

<div
  class="relative shrink-0 overflow-hidden bg-slate-200 dark:bg-neutral-600 {className}"
>
  {#if cover?.blurhash}
    <BlurhashCanvas
      hash={cover.blurhash}
      class="absolute inset-0 h-full w-full object-cover"
    />
  {/if}
  {#if src}
    <!-- Browsers may draw the alt text while the image loads, so it stays
         transparent even if the image is shown before it finishes. -->
    <img
      bind:this={image}
      {src}
      {alt}
      class="relative h-full w-full object-cover text-transparent {fading
        ? 'transition-[opacity,scale]'
        : 'transition-[scale]'} {imageClass}"
      class:opacity-0={loadedUrl !== src}
      loading={lazy ? "lazy" : undefined}
      onload={handleLoad}
      onerror={() => (failedUrl = src)}
    />
  {:else if !cover?.blurhash}
    <div
      class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class={iconClass}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d={icon === "person"
            ? "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            : "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"}
        />
      </svg>
    </div>
  {/if}
</div>
