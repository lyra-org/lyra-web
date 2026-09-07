<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import {
    getFavoriteState,
    isFavoriteLoading,
    isFavoriteToggling,
    loadFavorite,
    toggleFavorite,
  } from "./favorites.svelte.ts";

  interface Props {
    targetId: string;
    label?: string;
    class?: string;
    size?: "sm" | "md";
    stopPropagation?: boolean;
  }

  let {
    targetId,
    label = "Favorite",
    class: className = "",
    size = "md",
    stopPropagation = false,
  }: Props = $props();

  let favorited = $derived(getFavoriteState(targetId) ?? false);
  let loading = $derived(isFavoriteLoading(targetId));
  let toggling = $derived(isFavoriteToggling(targetId));
  let busy = $derived(loading || toggling);

  let ariaLabel = $derived(
    favorited ? `Remove ${label} from favorites` : `Add ${label} to favorites`,
  );

  let iconClass = $derived(size === "sm" ? "h-4 w-4" : "h-5 w-5");
  let buttonClass = $derived(size === "sm" ? "h-6 w-6" : "h-7 w-7");

  let colorClass = $derived(
    favorited
      ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200",
  );

  $effect(() => {
    const id = targetId;
    loadFavorite(id).catch(() => {});
  });

  async function handleClick(e: MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    if (busy) return;
    try {
      await toggleFavorite(targetId);
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  }
</script>

<button
  type="button"
  class="flex {buttonClass} shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-50 {colorClass} {className}"
  disabled={busy}
  aria-label={ariaLabel}
  aria-pressed={favorited}
  title={ariaLabel}
  onclick={handleClick}
>
  {#if busy && getFavoriteState(targetId) === undefined}
    <svg
      class="{iconClass} animate-spin"
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
  {:else if favorited}
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  {:else}
    <svg
      class={iconClass}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  {/if}
</button>
