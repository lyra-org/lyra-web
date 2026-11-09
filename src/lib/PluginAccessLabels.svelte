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
  }

  let { effects }: Props = $props();

  function isPersonal(effect: PluginEffect): boolean {
    return (
      effect.kind === "reads_personal" || effect.kind === "writes_personal"
    );
  }

  // One short label per kind of access, broadest first. Reaching every user's
  // data covers reaching some, so only the wider label shows.
  let labels = $derived.by(() => {
    const everyUser = effects.filter(
      (effect) => isPersonal(effect) && effect.users === "all",
    );
    const candidates: [string, PluginEffect[]][] = [
      ["Signs users in", effects.filter((e) => e.kind === "authority")],
      ["Adds endpoints", effects.filter((e) => e.kind === "exposes")],
      ["Sends data off the server", effects.filter((e) => e.kind === "egress")],
      ["Uses every user's data", everyUser],
      [
        "Uses personal data",
        everyUser.length > 0 ? [] : effects.filter(isPersonal),
      ],
      [
        "Changes library data",
        effects.filter((e) => e.kind === "writes_library"),
      ],
    ];
    return candidates
      .filter(([, matching]) => matching.length > 0)
      .map(([text, matching]) => ({
        text,
        title: matching.map((effect) => effect.description).join("\n"),
      }));
  });
</script>

<div class="flex flex-wrap gap-1">
  {#each labels as label (label.text)}
    <span
      class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
      title={label.title}>{label.text}</span
    >
  {/each}
</div>
