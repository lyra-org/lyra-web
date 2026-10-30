<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { PluginRisk } from "./types";

  interface Props {
    risk: PluginRisk;
  }

  let { risk }: Props = $props();

  let reasons = $derived(
    risk.reasons.map((reason) => reason.description).join("\n"),
  );
</script>

<!-- Standard plugins carry no badge, so a badge always calls for attention. -->
{#if risk.level === "high"}
  <span
    class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300"
    title={reasons}>High risk</span
  >
{:else if risk.level === "elevated"}
  <span
    class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    title={reasons}>Elevated risk</span
  >
{/if}
