<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  let { playing }: { playing: boolean } = $props();
</script>

<span class="flex h-3 items-end gap-[2px]" aria-hidden="true">
  {#each [60, 100, 40] as height, i (i)}
    <span
      class="bar w-[3px] rounded-sm bg-[#BB7FB5] dark:bg-[#E6CEE3]"
      class:animate={playing}
      style="animation-delay: {i * -0.35}s; height: {height}%"
    ></span>
  {/each}
</span>

<style>
  .bar.animate {
    animation: bounce 0.9s ease-in-out infinite alternate;
  }
  @keyframes bounce {
    from {
      height: 25%;
    }
    to {
      height: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar.animate {
      animation: none;
    }
  }
</style>
