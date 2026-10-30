<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type { MixerResponse } from "./types";
  import OptionField, { defaultOptionValue } from "./OptionField.svelte";
  import {
    loadMixers,
    mixOptionKey,
    readMixOptions,
    writeMixOptions,
    type MixOptionValues,
  } from "./mixOptions";

  let mixers = $state<MixerResponse[] | null>(null);
  let values = $state<MixOptionValues>({});
  let loadError = $state(false);
  // Saved values of mixers not listed here, kept for when they come back.
  let saved: MixOptionValues = {};

  async function load() {
    loadError = false;
    try {
      const listed = (await loadMixers()).filter(
        (mixer) => mixer.enabled && mixer.options.length > 0,
      );
      saved = readMixOptions();
      values = Object.fromEntries(
        listed.flatMap((mixer) =>
          mixer.options.map((option) => {
            const key = mixOptionKey(mixer.mixer_id, option.name);
            const value = saved[key];
            return [
              key,
              typeof value === option.type ? value : defaultOptionValue(option),
            ];
          }),
        ),
      );
      mixers = listed;
    } catch {
      loadError = true;
    }
  }

  // Only options changed from their defaults are saved.
  $effect(() => {
    if (mixers == null) return;
    const changed = { ...saved };
    for (const mixer of mixers) {
      for (const option of mixer.options) {
        const key = mixOptionKey(mixer.mixer_id, option.name);
        if (values[key] === defaultOptionValue(option)) {
          delete changed[key];
        } else {
          changed[key] = values[key];
        }
      }
    }
    writeMixOptions(changed);
  });

  onMount(() => {
    void load();
  });
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    Mixing
  </h3>
</div>
<div class="flex-1 space-y-6 overflow-y-auto p-6">
  <p class="text-sm text-slate-600 dark:text-neutral-300">
    Options apply to every mix you start in this browser.
  </p>
  {#if loadError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">
      Unable to load mixers.
    </p>
    <button type="button" onclick={load} class="text-sm underline">Retry</button
    >
  {:else if mixers == null}
    <p role="status" class="text-sm">Loading mixers…</p>
  {:else if mixers.length === 0}
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      No enabled mixer has options.
    </p>
  {:else}
    {#each mixers as mixer (mixer.mixer_id)}
      <section class="max-w-md">
        <h4
          class="mb-1.5 text-sm font-medium text-slate-700 dark:text-neutral-200"
        >
          {mixer.display_name}
        </h4>
        {#each mixer.options as option (option.name)}
          <OptionField
            {option}
            bind:value={values[mixOptionKey(mixer.mixer_id, option.name)]}
          />
        {/each}
      </section>
    {/each}
  {/if}
</div>
