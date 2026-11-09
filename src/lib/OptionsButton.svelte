<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<!-- The ⋯ button that opens an entity's menu: `overlay` sits over a card's
     cover, shown on hovering its `group`; `header` sits among a page's
     favorite and rating buttons. -->
<script lang="ts">
  interface Props {
    label: string;
    variant?: "header" | "overlay";
    expanded?: boolean;
    busy?: boolean;
    onclick: (e: MouseEvent) => void;
  }

  let {
    label,
    variant = "header",
    expanded = false,
    busy = false,
    onclick,
  }: Props = $props();

  let styleClass = $derived(
    variant === "overlay"
      ? `absolute top-1.5 right-1.5 bg-black/50 text-white hover:bg-black/70 transition-opacity ${
          expanded || busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`
      : "text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200",
  );
  let iconClass = $derived(variant === "overlay" ? "h-4 w-4" : "h-5 w-5");
</script>

<button
  type="button"
  class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full {styleClass}"
  title={label}
  aria-label={label}
  aria-haspopup="menu"
  aria-expanded={expanded}
  aria-busy={busy}
  {onclick}
>
  {#if busy}
    <svg
      class="{iconClass} animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  {/if}
</button>
