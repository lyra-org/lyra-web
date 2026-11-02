<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import {
    getRating,
    isRatingLoading,
    isRatingSaving,
    loadRating,
    rate,
  } from "./ratings.svelte.ts";

  interface Props {
    targetId: string;
    label?: string;
    class?: string;
    size?: "sm" | "md";
    stopPropagation?: boolean;
    // Called when a star is clicked, or chosen with Enter or Space.
    onpick?: () => void;
  }

  let {
    targetId,
    label = "this",
    class: className = "",
    size = "md",
    stopPropagation = false,
    onpick,
  }: Props = $props();

  const values = [1, 2, 3, 4, 5];

  let rating = $derived(getRating(targetId) ?? null);
  let busy = $derived(isRatingLoading(targetId) || isRatingSaving(targetId));
  let hovered = $state<number | null>(null);
  let shown = $derived(hovered ?? rating ?? 0);
  // The checked star takes focus in the group, else the first one.
  let focusable = $derived(rating ?? 1);

  let buttons: HTMLButtonElement[] = $state([]);

  let iconClass = $derived(size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5");
  let buttonClass = $derived(size === "sm" ? "h-6 w-4" : "h-7 w-6");

  $effect(() => {
    const id = targetId;
    untrack(() => loadRating(id)).catch(() => {});
  });

  function starTitle(value: number): string {
    if (value === rating) return "Clear rating";
    return `Rate ${value} star${value === 1 ? "" : "s"}`;
  }

  async function choose(value: number | null) {
    if (busy || getRating(targetId) === undefined) return;
    if (value === rating) return;
    try {
      await rate(targetId, value);
    } catch (err) {
      console.error("Rating update failed:", err);
    }
  }

  function handleClick(e: MouseEvent, value: number) {
    if (stopPropagation) e.stopPropagation();
    choose(value === rating ? null : value);
    onpick?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (stopPropagation) e.stopPropagation();
    let next: number | null | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = Math.min(5, (rating ?? 0) + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = Math.max(1, (rating ?? 2) - 1);
    } else if (e.key === "Home") {
      next = 1;
    } else if (e.key === "End") {
      next = 5;
    } else if (/^[1-5]$/.test(e.key)) {
      next = Number(e.key);
    } else if (e.key === "0" || e.key === "Delete" || e.key === "Backspace") {
      next = null;
    }
    if (next === undefined) return;
    e.preventDefault();
    buttons[(next ?? 1) - 1]?.focus();
    choose(next);
  }
</script>

<div
  role="radiogroup"
  aria-label="Rate {label}"
  aria-busy={busy}
  class="flex shrink-0 items-center {className}"
  class:opacity-50={rating === null && busy}
  tabindex="-1"
  onkeydown={handleKeydown}
  onmouseleave={() => (hovered = null)}
>
  {#each values as value (value)}
    <button
      bind:this={buttons[value - 1]}
      type="button"
      role="radio"
      aria-checked={value === rating}
      aria-label="{value} star{value === 1 ? '' : 's'}"
      title={starTitle(value)}
      tabindex={value === focusable ? 0 : -1}
      class="flex {buttonClass} cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-[#BB7FB5]"
      onmouseenter={() => (hovered = value)}
      onclick={(e) => handleClick(e, value)}
    >
      <svg
        class="{iconClass} transition-colors {value > shown
          ? 'text-slate-300 dark:text-neutral-600'
          : hovered !== null
            ? 'text-amber-300 dark:text-amber-200'
            : 'text-amber-400 dark:text-amber-300'}"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
        />
      </svg>
    </button>
  {/each}
</div>
