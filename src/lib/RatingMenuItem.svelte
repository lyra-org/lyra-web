<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import RatingStars from "./RatingStars.svelte";

  interface Props {
    targetId: string;
    label: string;
  }

  let { targetId, label }: Props = $props();
</script>

<div
  class="flex w-full items-center justify-between gap-4 px-3 py-1 text-sm text-slate-700 dark:text-neutral-200"
>
  <span class="flex items-center gap-2">
    <svg
      class="h-4 w-4 text-slate-400 dark:text-neutral-500"
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
        d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11a.56.56 0 00.48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.39a.56.56 0 01-.84.61l-4.73-2.89a.56.56 0 00-.59 0l-4.72 2.89a.56.56 0 01-.84-.61l1.28-5.39a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.47-.35l2.13-5.11z"
      />
    </svg>
    Rating
  </span>
  <RatingStars {targetId} {label} size="sm" />
</div>
