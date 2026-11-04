<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { ScopeGainResponse } from "./types";
  import PluginRiskBadge from "./PluginRiskBadge.svelte";
  import PluginRiskReasons from "./PluginRiskReasons.svelte";
  import PluginScopeList from "./PluginScopeList.svelte";

  interface Props {
    gain: ScopeGainResponse;
  }

  let { gain }: Props = $props();

  let rises = $derived(gain.risk.level !== gain.previous_risk);
</script>

<!-- What one installed plugin would newly reach, laid out like a plugin's own
access: name and badge, effects, then why the risk is what it is. -->
<div
  class="rounded-md border border-slate-200 p-3 text-sm text-slate-700 dark:border-neutral-800 dark:text-neutral-300"
>
  <p class="flex flex-wrap items-baseline gap-x-2">
    <span class="font-medium text-slate-900 dark:text-neutral-100"
      >{gain.plugin}</span
    >
    <PluginRiskBadge risk={gain.risk} />
    {#if rises}
      <span class="text-xs text-slate-500 dark:text-neutral-400"
        >up from {gain.previous_risk}</span
      >
    {/if}
  </p>
  {#if gain.effects.length > 0}
    <p class="mt-1 text-slate-500 dark:text-neutral-400">Would newly:</p>
    <ul class="list-disc pl-5">
      {#each gain.effects as effect, i (i)}
        <li>{effect.description}</li>
      {/each}
    </ul>
  {/if}
  {#if gain.unresolved_dependencies.length > 0}
    <p class="mt-1 text-amber-700 dark:text-amber-400">
      Depends on {gain.unresolved_dependencies.join(", ")}, which
      {gain.unresolved_dependencies.length === 1 ? "is" : "are"} not installed, so
      it may be able to do more than listed.
    </p>
  {/if}
  <PluginRiskReasons risk={gain.risk} prospective />
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
