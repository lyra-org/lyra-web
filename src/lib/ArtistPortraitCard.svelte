<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { CoverResponse } from "./types";
  import BlurhashCanvas from "./BlurhashCanvas.svelte";

  interface Props {
    id: string;
    name: string;
    cover?: CoverResponse | null;
    role?: string | null;
  }

  let { id, name, cover = null, role = null }: Props = $props();

  let coverFailed = $state(false);
  let coverSrc = $derived(cover && !coverFailed ? cover.url : null);
</script>

<a
  href={`#/artists/${id}`}
  class="group flex w-28 shrink-0 flex-col items-center"
  aria-label="Open {name}"
>
  <div
    class="relative aspect-square w-full overflow-hidden rounded-full bg-slate-200 shadow-sm transition-shadow group-hover:shadow-md dark:bg-neutral-700 dark:shadow-black/30"
  >
    {#if cover?.blurhash}
      <BlurhashCanvas
        hash={cover.blurhash}
        class="absolute inset-0 h-full w-full object-cover"
      />
    {/if}
    {#if coverSrc}
      <img
        src={coverSrc}
        alt="Photo of {name}"
        class="relative h-full w-full object-cover transition-transform group-hover:scale-105"
        loading="lazy"
        onerror={() => (coverFailed = true)}
      />
    {:else if !cover?.blurhash}
      <div
        class="flex h-full w-full items-center justify-center text-slate-400 dark:text-neutral-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
    {/if}
  </div>
  <p
    class="mt-2 w-full truncate text-center text-sm font-medium text-slate-900 group-hover:underline dark:text-neutral-100"
    title={name}
  >
    {name}
  </p>
  {#if role}
    <p
      class="mt-0.5 w-full truncate text-center text-xs text-slate-500 dark:text-neutral-400"
      title={role}
    >
      {role}
    </p>
  {/if}
</a>
