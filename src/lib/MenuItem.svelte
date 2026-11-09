<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  export const editIcon =
    "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z";
  export const coverIcon =
    "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { menuItemClass } from "./ContextMenu.svelte";

  interface Props {
    // An outlined icon's path, in a 24-unit square.
    icon?: string;
    onclick: () => void;
    children: Snippet;
  }

  let { icon, onclick, children }: Props = $props();
</script>

<button type="button" role="menuitem" class={menuItemClass} {onclick}>
  {#if icon}
    <svg
      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d={icon} />
    </svg>
  {/if}
  {@render children()}
</button>
