<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import type { CoverUpdate } from "./types";

  interface Props {
    covers: CoverUpdate;
    bypassCoverCache: boolean;
  }

  let { covers = $bindable(), bypassCoverCache = $bindable() }: Props =
    $props();

  const inputClass =
    "w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";
</script>

<label
  class="flex items-center justify-between gap-3 py-1 text-sm text-slate-700 dark:text-neutral-300"
>
  <span>Update</span>
  <select
    class={inputClass}
    bind:value={
      () => covers,
      (mode) => {
        covers = mode;
        // The server rejects a cache bypass when no covers are fetched.
        if (mode === "skip") bypassCoverCache = false;
      }
    }
  >
    <option value="missing">Fetch where missing</option>
    <option value="replace">Replace existing</option>
    <option value="skip">Don't fetch</option>
  </select>
</label>
<label
  class="flex items-center justify-between gap-3 py-1 text-sm text-slate-700 dark:text-neutral-300"
>
  <span class:opacity-50={covers === "skip"}>
    Bypass cover cache
    <span class="block text-xs text-slate-400">
      Look covers up again instead of using cached lookups
    </span>
  </span>
  <input
    type="checkbox"
    disabled={covers === "skip"}
    bind:checked={bypassCoverCache}
  />
</label>
