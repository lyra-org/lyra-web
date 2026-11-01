<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<!-- One menu row for refreshing: the row refreshes at once, and the button at
its end opens the provider options first. -->
<script lang="ts">
  import { menuItemClass } from "./ContextMenu.svelte";

  interface Props {
    onrefresh: () => void;
    onoptions: () => void;
  }

  let { onrefresh, onoptions }: Props = $props();
</script>

<!-- The whole row highlights on hover; the options button inside it gets its
own inset highlight. -->
<div class="flex items-center hover:bg-slate-100 dark:hover:bg-neutral-600">
  <button
    type="button"
    role="menuitem"
    class="{menuItemClass} flex-1"
    onclick={onrefresh}
  >
    <svg
      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0113.292-4.708M20 15a8 8 0 01-13.292 4.708"
      />
    </svg>
    Refresh metadata
  </button>
  <button
    type="button"
    role="menuitem"
    class="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-500 dark:hover:text-neutral-100"
    title="Refresh with options…"
    aria-label="Refresh with options…"
    onclick={onoptions}
  >
    <svg
      class="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.75"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
      />
    </svg>
  </button>
</div>
