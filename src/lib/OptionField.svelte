<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  import type { OptionResponse, OptionValue } from "./types";

  export function defaultOptionValue(option: OptionResponse): OptionValue {
    if (option.default != null) return option.default;
    if (option.type === "boolean") return false;
    if (option.type === "number") return 0;
    return "";
  }
</script>

<script lang="ts">
  interface Props {
    option: OptionResponse;
    value: OptionValue;
  }

  let { option, value = $bindable() }: Props = $props();

  const inputClass =
    "w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";
</script>

<label
  class="flex items-center justify-between gap-3 py-1 text-sm text-slate-700 dark:text-neutral-300"
  title={option.available
    ? undefined
    : (option.unavailable_reason ?? undefined)}
>
  <span class:opacity-50={!option.available}>
    {option.label}
    {#if !option.available && option.unavailable_reason}
      <span class="block text-xs text-slate-400">
        {option.unavailable_reason}
      </span>
    {/if}
  </span>
  {#if option.type === "boolean"}
    <input
      type="checkbox"
      disabled={!option.available}
      bind:checked={() => value === true, (checked) => (value = checked)}
    />
  {:else if option.type === "number"}
    <input
      type="number"
      class={inputClass}
      disabled={!option.available}
      bind:value={() => Number(value), (number) => (value = number)}
    />
  {:else}
    <input
      type="text"
      class={inputClass}
      disabled={!option.available}
      bind:value={() => String(value), (text) => (value = text)}
    />
  {/if}
</label>
