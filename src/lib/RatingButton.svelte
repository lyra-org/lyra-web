<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { tick, untrack } from "svelte";
  import ContextMenu, {
    anchorBelow,
    type MenuAnchor,
  } from "./ContextMenu.svelte";
  import RatingStars from "./RatingStars.svelte";
  import { getRating, loadRating } from "./ratings.svelte.ts";

  interface Props {
    targetId: string;
    label?: string;
    class?: string;
    size?: "sm" | "md";
    stopPropagation?: boolean;
  }

  let {
    targetId,
    label = "this",
    class: className = "",
    size = "md",
    stopPropagation = false,
  }: Props = $props();

  let rating = $derived(getRating(targetId) ?? null);
  let anchor = $state<MenuAnchor | null>(null);
  let trigger: HTMLButtonElement;
  let popover = $state<HTMLDivElement>();

  let title = $derived(
    rating == null
      ? `Rate ${label}`
      : `Rated ${rating} star${rating === 1 ? "" : "s"}, change rating`,
  );
  let iconClass = $derived(size === "sm" ? "h-4 w-4" : "h-5 w-5");
  let buttonClass = $derived(
    size === "sm" ? "h-6 min-w-6 text-xs" : "h-7 min-w-7 text-sm",
  );
  let colorClass = $derived(
    rating != null
      ? "text-amber-500 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200",
  );

  $effect(() => {
    const id = targetId;
    untrack(() => loadRating(id)).catch(() => {});
  });

  async function toggle(e: MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    if (anchor) {
      anchor = null;
      return;
    }
    anchor = anchorBelow(trigger);
    await tick();
    popover
      ?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
      ?.focus();
  }

  function close() {
    const hadFocus = popover?.contains(document.activeElement);
    anchor = null;
    if (hadFocus) trigger.focus();
  }
</script>

<button
  bind:this={trigger}
  type="button"
  class="flex {buttonClass} shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full px-1 font-medium tabular-nums transition-colors {colorClass} {className}"
  aria-label={title}
  aria-haspopup="dialog"
  aria-expanded={anchor != null}
  {title}
  onclick={toggle}
>
  <svg
    class={iconClass}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={rating != null ? "currentColor" : "none"}
    stroke="currentColor"
    stroke-width={rating != null ? 0 : 2}
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.39a.56.56 0 01-.84.61l-4.73-2.89a.56.56 0 00-.59 0l-4.72 2.89a.56.56 0 01-.84-.61l1.28-5.39a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.47-.35l2.13-5.11z"
    />
  </svg>
  {#if rating != null}<span aria-hidden="true">{rating}</span>{/if}
</button>

{#if anchor}
  <ContextMenu
    {anchor}
    onclose={close}
    minWidth="none"
    role="dialog"
    label="Rate {label}"
  >
    <div bind:this={popover} class="px-2 py-0.5">
      <RatingStars {targetId} {label} onpick={close} />
    </div>
  </ContextMenu>
{/if}
