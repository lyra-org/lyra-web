<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { decodeBlurhash } from "./blurhash";

  interface Props {
    hash: string;
    class?: string;
  }

  let { hash, class: className = "" }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!canvas) return;
    const imageData = decodeBlurhash(hash);
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
  });
</script>

<canvas bind:this={canvas} class={className}></canvas>
