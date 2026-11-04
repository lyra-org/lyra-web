<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  interface Props {
    scopes: string[];
  }

  let { scopes }: Props = $props();
</script>

<div class="flex flex-wrap gap-1">
  {#each scopes as scope (scope)}
    <span
      class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
      >{scope}</span
    >
  {/each}
</div>
