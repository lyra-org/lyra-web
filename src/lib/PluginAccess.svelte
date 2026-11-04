<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginEffect, PluginPreviewResponse } from "./types";
  import PluginGain from "./PluginGain.svelte";
  import PluginRiskReasons from "./PluginRiskReasons.svelte";
  import PluginScopeList from "./PluginScopeList.svelte";

  interface Props {
    plugin: PluginPreviewResponse;
  }

  let { plugin }: Props = $props();

  let access = $derived(plugin.access);

  // Names the dependencies an effect comes through, leaving out the plugin
  // itself.
  function through(via: PluginEffect["via"]): string {
    const others = [
      ...new Set(
        via.map((source) => source.plugin).filter((id) => id !== plugin.id),
      ),
    ];
    return others.length > 0 ? ` (through ${others.join(", ")})` : "";
  }
</script>

{#if access}
  {#if access.effects.length > 0}
    <ul
      class="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-neutral-300"
    >
      {#each access.effects as effect, i (i)}
        <li>{effect.description}{through(effect.via)}</li>
      {/each}
    </ul>
  {:else}
    <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
      Only reads the shared library.
    </p>
  {/if}
  {#if access.unresolved_dependencies.length > 0}
    <p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
      Depends on {access.unresolved_dependencies.join(", ")}, which
      {access.unresolved_dependencies.length === 1 ? "is" : "are"} not available,
      so it may be able to do more than listed.
    </p>
  {/if}
  <PluginRiskReasons risk={access.risk} />
  {#if access.reached_scopes.length > 0}
    <details class="mt-2">
      <summary
        class="cursor-pointer text-xs text-slate-400 select-none hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        Scopes ({access.reached_scopes.length})
      </summary>
      <div class="mt-1">
        <PluginScopeList scopes={access.reached_scopes.map((s) => s.scope)} />
      </div>
    </details>
  {/if}
  {#if access.widens.length > 0}
    <div class="mt-3 space-y-2 text-sm">
      <p class="text-slate-700 dark:text-neutral-300">
        Installing it also lets installed plugins do more:
      </p>
      {#each access.widens as gain (gain.plugin)}
        <PluginGain {gain} />
      {/each}
    </div>
  {/if}
{:else if plugin.scopes.length > 0}
  <!-- Without an access summary, the declared scopes are all there is. -->
  <div class="mt-2 flex flex-wrap gap-1">
    <span class="text-xs text-slate-400 dark:text-neutral-500">Requests:</span>
    <PluginScopeList scopes={plugin.scopes} />
  </div>
{/if}
