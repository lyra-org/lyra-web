<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginPreviewResponse } from "./types";
  import { shortOrigin } from "./pluginSource";
  import Modal from "./Modal.svelte";
  import PluginAccess from "./PluginAccess.svelte";

  interface Props {
    entries: { plugin: PluginPreviewResponse; origin: string }[];
    onconfirm: () => void;
    onclose: () => void;
  }

  let { entries, onconfirm, onclose }: Props = $props();

  let only = $derived(entries.length === 1 ? entries[0] : null);
</script>

<Modal
  title={only
    ? `Install ${only.plugin.name}?`
    : `Install ${entries.length} plugins?`}
  {onclose}
>
  <p class="text-sm text-slate-600 dark:text-neutral-300">
    {#if only}
      This plugin comes from {shortOrigin(only.origin)}, not the official Lyra
      repository, so Lyra hasn't reviewed it.
    {:else}
      These plugins aren't from the official Lyra repository, so Lyra hasn't
      reviewed them.
    {/if}
  </p>
  {#each entries as { plugin, origin } (plugin.id)}
    <section>
      {#if !only}
        <h3 class="text-sm font-medium">{plugin.name}</h3>
        <p class="text-xs break-all text-slate-500 dark:text-neutral-400">
          {shortOrigin(origin)}
        </p>
      {/if}
      {#if plugin.access && plugin.access.effects.length > 0}
        <p class="mt-2 text-sm text-slate-500 dark:text-neutral-400">
          Once installed, it:
        </p>
      {/if}
      <PluginAccess {plugin} expanded />
    </section>
  {/each}

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      onclick={onclose}>Cancel</button
    >
    <button
      type="button"
      class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      onclick={onconfirm}>Install</button
    >
  {/snippet}
</Modal>
