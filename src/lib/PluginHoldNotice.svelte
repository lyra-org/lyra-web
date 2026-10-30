<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginHold } from "./types";
  import { describeGain, describeHold } from "./pluginUpdates.svelte.ts";

  interface Props {
    hold: PluginHold;
    version: string;
  }

  let { hold, version }: Props = $props();
</script>

<div class="space-y-1 text-sm text-amber-700 dark:text-amber-400">
  <p>{describeHold(hold, version)}</p>
  {#if hold.reason === "adds_scopes"}
    <ul class="list-disc space-y-1 pl-5">
      {#each hold.gains as gain (gain.plugin)}
        <li>
          {describeGain(gain)}.
          {#if gain.effects.length > 0}
            <ul class="list-[circle] pl-5">
              {#each gain.effects as effect, i (i)}
                <li>{effect.description}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
