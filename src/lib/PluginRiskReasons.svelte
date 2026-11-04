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
    // The risk the plugin would have after a change, not the one it has.
    prospective?: boolean;
  }

  let { risk, prospective = false }: Props = $props();
</script>

<!-- Standard risk carries no reasons. Colour marks the box and heading only;
the reasons stay in body text so they read easily. -->
{#if risk.level !== "standard" && risk.reasons.length > 0}
  <div
    class={[
      "mt-2 rounded-md border-l-4 px-3 py-2 text-sm",
      risk.level === "high"
        ? "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950/40"
        : "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40",
    ]}
  >
    <p
      class={[
        "font-medium",
        risk.level === "high"
          ? "text-red-800 dark:text-red-300"
          : "text-amber-900 dark:text-amber-300",
      ]}
    >
      Why it {prospective ? "would be" : "is"}
      {risk.level} risk
    </p>
    <ul
      class="mt-0.5 list-disc space-y-0.5 pl-5 text-slate-700 dark:text-neutral-300"
    >
      {#each risk.reasons as reason, i (i)}
        <li>{reason.description}</li>
      {/each}
    </ul>
  </div>
{/if}
