<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  interface Props {
    description: string | null | undefined;
  }

  let { description }: Props = $props();
</script>

{#if description}
  <div class="mt-8">
    <h3
      class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-neutral-500"
    >
      About
    </h3>
    <p
      class="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-neutral-300"
    >
      {description}
    </p>
  </div>
{/if}
