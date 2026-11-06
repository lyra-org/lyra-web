<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { describeFill } from "./metadataFields";
  import type { MergePreview } from "./types";

  interface Props {
    preview: MergePreview;
    // Names of the losers, by ID.
    names: Record<string, string>;
    artistName?: (id: string) => string;
    providerName?: (id: string) => string;
  }

  let {
    preview,
    names,
    artistName = () => "Unknown artist",
    providerName = (id) => id,
  }: Props = $props();

  const NOUNS = {
    artist: "artist",
    release: "album",
    genre: "genre",
    label: "label",
  };

  function count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? "" : "s"}`;
  }

  let noun = $derived(NOUNS[preview.kind]);
  let moved = $derived(
    [
      preview.counts.releases > 0 && count(preview.counts.releases, "album"),
      preview.counts.tracks > 0 && count(preview.counts.tracks, "track"),
      preview.counts.relatives > 0 &&
        count(preview.counts.relatives, "related genre"),
    ].filter((part) => part !== false),
  );
  let lockedNames = $derived(
    preview.locked_ids.map((id) =>
      id === preview.winner_id ? `This ${noun}` : (names[id] ?? id),
    ),
  );
  // Shared track numbers by disc, as in "Disc 1: 1, 2, 3".
  let sharedNumbers = $derived.by(() => {
    const byDisc = new Map<number, number[]>();
    for (const { disc, track } of preview.track_collisions) {
      byDisc.set(disc, [...(byDisc.get(disc) ?? []), track]);
    }
    return [...byDisc].map(
      ([disc, tracks]) => `Disc ${disc}: ${tracks.join(", ")}`,
    );
  });
  // What the details hold, so that closing them hides no surprise.
  let summary = $derived(
    [
      preview.manual_fills.length > 0 &&
        count(preview.manual_fills.length, "manual value"),
      preview.kept_external_ids.length > 0 &&
        `${preview.kept_external_ids.length} ${preview.kept_external_ids.length === 1 ? "alias" : "aliases"}`,
      preview.track_collisions.length > 0 &&
        count(preview.track_collisions.length, "shared track number"),
      preview.locked_ids.length > 0 && `${preview.locked_ids.length} locked`,
    ].filter((part) => part !== false),
  );
</script>

{#snippet row(name: string)}
  <dt class="text-slate-500 dark:text-neutral-400">{name}</dt>
{/snippet}

<div class="grid grid-cols-[9rem_1fr] gap-x-3 text-sm">
  <span class="text-slate-500 dark:text-neutral-400">Merge in</span>
  <div class="min-w-0">
    {#each Object.values(names) as name, i (i)}
      <p class="break-words text-slate-900 dark:text-neutral-100">{name}</p>
    {/each}
    <p class="mt-1 text-slate-500 dark:text-neutral-400">
      {#if moved.length > 0}
        Brings {moved.join(" and ")} to this {noun}.
      {/if}
      This can't be undone.
    </p>
  </div>
</div>

{#if summary.length > 0}
  <details class="mt-3 text-sm">
    <summary class="cursor-pointer text-slate-500 dark:text-neutral-400">
      {summary.join(" · ")}
    </summary>
    <dl class="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
      {#if preview.manual_fills.length > 0}
        {@render row("Manual values")}
        <dd class="min-w-0 text-slate-900 dark:text-neutral-100">
          {#each preview.manual_fills as fill (fill.key)}
            {@const { name, lines } = describeFill(fill, artistName)}
            <p class="break-words">{name}: {lines.join(", ")}</p>
          {/each}
        </dd>
      {/if}
      {#if preview.kept_external_ids.length > 0}
        {@render row("Aliases")}
        <dd class="min-w-0 text-slate-900 dark:text-neutral-100">
          {#each preview.kept_external_ids as id (`${id.provider_id}/${id.id_type}/${id.id_value}`)}
            <p class="break-words">
              {providerName(id.provider_id)}
              {id.id_type}:
              <span class="font-mono text-xs break-all">{id.id_value}</span>
            </p>
          {/each}
        </dd>
      {/if}
      {#if sharedNumbers.length > 0}
        {@render row("Shared numbers")}
        <dd class="min-w-0 text-slate-900 dark:text-neutral-100">
          {#each sharedNumbers as line, i (i)}<p>{line}</p>{/each}
          <p class="text-slate-500 dark:text-neutral-400">Both tracks stay.</p>
        </dd>
      {/if}
      {#if lockedNames.length > 0}
        {@render row("Locked")}
        <dd class="min-w-0 text-slate-900 dark:text-neutral-100">
          {#each lockedNames as name, i (i)}
            <p class="break-words">{name}</p>
          {/each}
          <p class="text-slate-500 dark:text-neutral-400">
            The merge applies anyway.
          </p>
        </dd>
      {/if}
    </dl>
  </details>
{/if}
