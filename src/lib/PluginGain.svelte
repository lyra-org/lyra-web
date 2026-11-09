<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ScopeGainResponse } from "./types";
  import PluginEffects from "./PluginEffects.svelte";
  import PluginScopeList from "./PluginScopeList.svelte";

  interface Props {
    gain: ScopeGainResponse;
  }

  let { gain }: Props = $props();

  let rises = $derived(gain.risk.level !== gain.previous_risk);
</script>

<!-- What one installed plugin would newly reach. When that raises its risk, the
combined reasons follow, since the effects alone list only what is new. -->
<div
  class="rounded-md border border-slate-200 p-3 text-sm text-slate-700 dark:border-neutral-800 dark:text-neutral-300"
>
  <p class="font-medium text-slate-900 dark:text-neutral-100">{gain.plugin}</p>
  {#if gain.effects.length > 0}
    <p class="mt-1 mb-0.5 text-slate-500 dark:text-neutral-400">Would newly:</p>
    <PluginEffects effects={gain.effects} plugin={gain.plugin} />
  {/if}
  {#if gain.unresolved_dependencies.length > 0}
    <p class="mt-1 text-slate-600 dark:text-neutral-400">
      Depends on {gain.unresolved_dependencies.join(", ")}, which
      {gain.unresolved_dependencies.length === 1 ? "is" : "are"} not installed, so
      it may be able to do more than listed.
    </p>
  {/if}
  {#if rises && gain.risk.reasons.length > 0}
    <p class="mt-2 mb-0.5 text-slate-500 dark:text-neutral-400">
      Together with what it can already do:
    </p>
    <ul class="list-disc pl-5">
      {#each gain.risk.reasons as reason, i (i)}
        <li>{reason.description}</li>
      {/each}
    </ul>
  {/if}
  {#if gain.scopes.length > 0}
    <details class="mt-2">
      <summary
        class="cursor-pointer text-xs text-slate-400 select-none hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        New scopes ({gain.scopes.length})
      </summary>
      <div class="mt-1"><PluginScopeList scopes={gain.scopes} /></div>
    </details>
  {/if}
</div>
