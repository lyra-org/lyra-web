<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginHold } from "./types";
  import { describeHold } from "./pluginUpdates.svelte.ts";
  import PluginGain from "./PluginGain.svelte";

  interface Props {
    hold: PluginHold;
    version: string;
  }

  let { hold, version }: Props = $props();
</script>

<div class="space-y-2 text-sm">
  <p class="text-amber-700 dark:text-amber-400">
    {describeHold(hold, version)}
  </p>
  {#if hold.reason === "adds_reach"}
    {#each hold.gains as gain (gain.plugin)}
      <PluginGain {gain} />
    {/each}
  {/if}
</div>
