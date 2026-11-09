<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { shortOrigin } from "./pluginSource";

  interface Props {
    official: boolean;
    origin: string;
  }

  let { official, origin }: Props = $props();
</script>

{#if official}
  <span
    class="text-xs font-medium text-[#8e5a88] dark:text-[#cfa2c9]"
    title={origin}>Official</span
  >
{:else}
  <span
    class="text-xs break-all text-slate-500 dark:text-neutral-400"
    title={origin}>From {shortOrigin(origin)}</span
  >
{/if}
