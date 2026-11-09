<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginEffect } from "./types";

  interface Props {
    effects: PluginEffect[];
    // The plugin the effects belong to, left out when naming the plugins they
    // come through.
    plugin: string;
  }

  let { effects, plugin }: Props = $props();

  // Names the dependencies an effect comes through.
  function through(via: PluginEffect["via"]): string {
    const others = [
      ...new Set(
        via.map((source) => source.plugin).filter((id) => id !== plugin),
      ),
    ];
    return others.length > 0 ? ` (through ${others.join(", ")})` : "";
  }

  function reasonsOf(effect: PluginEffect): string[] {
    return [
      ...new Set(effect.via.flatMap((source) => source.author_reason ?? [])),
    ];
  }

  // A scope with several effects repeats its reason under each, so effects
  // given the same reasons share one entry. Effects with none stay separate.
  let entries = $derived.by(() => {
    const byReasons = new Map<
      string,
      { descriptions: string[]; reasons: string[] }
    >();
    effects.forEach((effect, i) => {
      const reasons = reasonsOf(effect);
      const key = reasons.length > 0 ? JSON.stringify(reasons) : `none:${i}`;
      const entry = byReasons.get(key) ?? { descriptions: [], reasons };
      entry.descriptions.push(`${effect.description}${through(effect.via)}`);
      byReasons.set(key, entry);
    });
    return [...byReasons.values()];
  });

  let hasReasons = $derived(entries.some((entry) => entry.reasons.length > 0));
</script>

<ul
  class="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-neutral-300"
>
  {#each entries as entry, i (i)}
    <li>
      {#each entry.descriptions as description, d (d)}
        <span class="block">{description}</span>
      {/each}
      {#each entry.reasons as reason, r (r)}
        <span class="block text-slate-500 dark:text-neutral-400"
          >“{reason}”</span
        >
      {/each}
    </li>
  {/each}
</ul>
{#if hasReasons}
  <p class="mt-1.5 text-xs text-slate-400 dark:text-neutral-500">
    Quoted reasons are the plugin author's own and aren't checked by Lyra.
  </p>
{/if}
