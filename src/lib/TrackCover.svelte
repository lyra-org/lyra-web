<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  interface Props {
    url: string | null;
    blurhash: string | null;
    // Size and rounding, such as "h-10 w-10 rounded".
    class?: string;
  }

  let {
    url,
    blurhash,
    class: className = "h-10 w-10 rounded",
  }: Props = $props();
</script>

{#if url}
  <div class="relative shrink-0 overflow-hidden {className}">
    {#if blurhash}
      <BlurhashCanvas
        hash={blurhash}
        class="absolute inset-0 h-full w-full object-cover"
      />
    {/if}
    <img src={url} alt="" class="relative h-full w-full object-cover" />
  </div>
{:else if blurhash}
  <BlurhashCanvas hash={blurhash} class="shrink-0 object-cover {className}" />
{:else}
  <div
    class="flex shrink-0 items-center justify-center bg-slate-200 text-slate-400 dark:bg-neutral-600 dark:text-neutral-500 {className}"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-1/2 w-1/2"
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
