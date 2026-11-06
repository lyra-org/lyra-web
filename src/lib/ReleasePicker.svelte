<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { fetchReleases } from "./api";
  import SearchPicker from "./SearchPicker.svelte";
  import type { ReleaseResponse } from "./types";

  interface Props {
    placeholder: string;
    // Albums already listed, left out of the results.
    exclude?: string[];
    onpick: (release: ReleaseResponse) => void;
  }

  let { placeholder, exclude, onpick }: Props = $props();

  async function search(query: string, signal: AbortSignal) {
    return (await fetchReleases({ query, limit: 8, signal })).items;
  }
</script>

<SearchPicker {placeholder} {search} {exclude} {onpick}>
  {#snippet row(release)}
    {release.title}
    <span class="text-slate-400 dark:text-neutral-500">
      {[
        release.artists?.map((a) => a.name).join(", "),
        release.release_date?.slice(0, 4),
      ]
        .filter(Boolean)
        .join(" · ")}
    </span>
  {/snippet}
</SearchPicker>
