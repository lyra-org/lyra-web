<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts" module>
  // "self" is this browser, "connection" another device running Lyra,
  // "external" a player a plugin reports, and "devices" the device list.
  export type DeviceKind = "self" | "connection" | "external" | "devices";
</script>

<script lang="ts">
  let {
    kind,
    class: className = "h-4 w-4",
  }: { kind: DeviceKind; class?: string } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  fill="none"
  viewBox="0 0 24 24"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === "self"}
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M2 20h20" />
  {:else if kind === "connection"}
    <rect x="6" y="2.5" width="12" height="19" rx="2" />
    <circle cx="12" cy="14.5" r="3.5" />
    <circle cx="12" cy="7" r="0.9" fill="currentColor" />
  {:else if kind === "external"}
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  {:else}
    <rect x="2" y="4" width="13" height="10" rx="1.5" />
    <path d="M5 18h7" />
    <rect x="16.5" y="7" width="5.5" height="13" rx="1.5" />
    <circle cx="19.25" cy="16" r="1" fill="currentColor" />
  {/if}
</svg>
