<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginPreviewResponse } from "./types";
  import PluginAccessLabels from "./PluginAccessLabels.svelte";
  import PluginEffects from "./PluginEffects.svelte";
  import PluginGain from "./PluginGain.svelte";
  import PluginScopeList from "./PluginScopeList.svelte";

  interface Props {
    plugin: PluginPreviewResponse;
    // Lists everything outright, for a page already asking about this plugin.
    expanded?: boolean;
  }

  let { plugin, expanded = false }: Props = $props();

  let access = $derived(plugin.access);
</script>

{#if access}
  {#if access.effects.length === 0}
    <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
      Only reads the shared library.
    </p>
  {:else if expanded}
    <div class="mt-2">
      <PluginEffects effects={access.effects} plugin={plugin.id} />
    </div>
  {:else}
    <div class="mt-2">
      <PluginAccessLabels effects={access.effects} />
    </div>
  {/if}
  {#if access.unresolved_dependencies.length > 0}
    <p class="mt-1 text-sm text-slate-600 dark:text-neutral-400">
      Depends on {access.unresolved_dependencies.join(", ")}, which
      {access.unresolved_dependencies.length === 1 ? "is" : "are"} not available,
      so it may be able to do more than listed.
    </p>
  {/if}
  {#if !expanded && (access.effects.length > 0 || access.reached_scopes.length > 0)}
    <details class="mt-2">
      <summary
        class="cursor-pointer text-xs text-slate-400 select-none hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        {access.effects.length > 0
          ? "What it can do and why"
          : `Scopes (${access.reached_scopes.length})`}
      </summary>
      <div class="mt-1 space-y-2">
        {#if access.effects.length > 0}
          <PluginEffects effects={access.effects} plugin={plugin.id} />
        {/if}
        {#if access.reached_scopes.length > 0}
          <PluginScopeList scopes={access.reached_scopes.map((s) => s.scope)} />
        {/if}
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
