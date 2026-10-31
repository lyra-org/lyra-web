<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts" generics="K extends string">
  interface Props {
    options: { value: K; label: string }[];
    value: K;
  }

  let { options, value = $bindable() }: Props = $props();

  const selectClass =
    "h-9 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs sm:text-sm text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BB7FB5] dark:border-neutral-700 dark:bg-[#1b1d1e] dark:text-neutral-300";
</script>

<label>
  <span class="sr-only">Show</span>
  <select class={selectClass} bind:value>
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</label>
