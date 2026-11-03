<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<!-- Opens the cover manager from over a page's cover. The cover's wrapper is
     the `group` it shows on hover in, and positions it through `class`. -->
<script lang="ts">
  interface Props {
    class?: string;
    onclick: () => void;
  }

  let { class: className = "", onclick }: Props = $props();
</script>

<button
  type="button"
  title="Change cover"
  aria-label="Change cover"
  class="absolute flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-black/75 focus-visible:opacity-100 {className}"
  {onclick}
>
  <svg
    class="h-4.5 w-4.5"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="2"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
</button>
