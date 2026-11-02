<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import ContextMenu, {
    anchorBelow,
    menuItemClass,
    type MenuAnchor,
  } from "./ContextMenu.svelte";
  import DescribeMixModal from "./DescribeMixModal.svelte";
  import type { HeaderMixConfig } from "./headerMix.svelte.ts";
  import { mixSupport, type MixSupport } from "./mixOptions";
  import PathMixModal from "./PathMixModal.svelte";

  interface Props {
    config: HeaderMixConfig;
  }

  let { config }: Props = $props();

  let support = $state<MixSupport>({ path: false, query: false });
  mixSupport().then(
    (found) => (support = found),
    () => {},
  );

  let canPath = $derived(support.path && config.pathFrom != null);
  let anchor = $state<MenuAnchor | null>(null);
  // Kept apart from config so a dialog survives the page changing under it.
  let describing = $state<HeaderMixConfig["seed"] | false>(false);
  let pathFrom = $state<HeaderMixConfig["pathFrom"]>(undefined);
</script>

{#if support.query || canPath}
  <button
    type="button"
    class="-ml-1.5 flex h-8 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
    aria-label="More mixes"
    title="More mixes"
    aria-haspopup="menu"
    aria-expanded={anchor != null}
    onclick={(e) => (anchor = anchor ? null : anchorBelow(e.currentTarget))}
  >
    <svg
      class="h-3 w-3"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  </button>
{/if}

{#if anchor}
  <ContextMenu {anchor} onclose={() => (anchor = null)}>
    {#if support.query}
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => {
          describing = config.seed;
          anchor = null;
        }}
      >
        Describe a mix…
      </button>
    {/if}
    {#if canPath}
      <button
        type="button"
        role="menuitem"
        class={menuItemClass}
        onclick={() => {
          pathFrom = config.pathFrom;
          anchor = null;
        }}
      >
        Path from this track to…
      </button>
    {/if}
  </ContextMenu>
{/if}

{#if describing !== false}
  <DescribeMixModal seed={describing} onclose={() => (describing = false)} />
{/if}

{#if pathFrom}
  <PathMixModal from={pathFrom} onclose={() => (pathFrom = undefined)} />
{/if}
