<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { sortFields, type SortKind, type SortOrder } from "./sort.svelte.ts";

  interface Props {
    kind: SortKind;
    sortBy: string;
    sortOrder: SortOrder;
  }

  let { kind, sortBy = $bindable(), sortOrder = $bindable() }: Props = $props();

  const labels: Record<string, string> = {
    name: "Name",
    date_created: "Date added",
    created_at: "Date created",
    updated_at: "Last updated",
    release_date: "Release date",
    last_played_at: "Last played",
    listen_count: "Play count",
    release_count: "Album count",
    track_count: "Track count",
    total_duration: "Total duration",
    duration: "Duration",
    favorited_at: "Date favorited",
  };

  let directionLabels = $derived(
    sortBy === "name"
      ? ["A–Z", "Z–A"]
      : [
            "date_created",
            "created_at",
            "updated_at",
            "release_date",
            "last_played_at",
            "favorited_at",
          ].includes(sortBy)
        ? ["Oldest first", "Newest first"]
        : ["duration", "total_duration"].includes(sortBy)
          ? ["Shortest first", "Longest first"]
          : ["Lowest first", "Highest first"],
  );

  const selectClass =
    "h-9 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs sm:text-sm text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BB7FB5] dark:border-neutral-700 dark:bg-[#1b1d1e] dark:text-neutral-300";
</script>

<div class="flex min-w-0 flex-wrap items-center gap-2">
  <label
    class="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400"
  >
    <span class="sr-only sm:not-sr-only">Sort by</span>
    <select
      class={selectClass}
      bind:value={sortBy}
      onchange={(event) =>
        (sortOrder =
          event.currentTarget.value === "name" ? "ascending" : "descending")}
    >
      {#each sortFields[kind] as field}
        <option value={field}>{labels[field]}</option>
      {/each}
    </select>
  </label>
  <label>
    <span class="sr-only">Sort direction</span>
    <select class={selectClass} bind:value={sortOrder}>
      <option value="ascending">{directionLabels[0]}</option>
      <option value="descending">{directionLabels[1]}</option>
    </select>
  </label>
</div>
