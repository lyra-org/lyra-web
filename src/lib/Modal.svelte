<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount, tick, type Snippet } from "svelte";
  import CloseButton from "./CloseButton.svelte";

  interface Props {
    title: string;
    subtitle?: string;
    width?: "narrow" | "normal" | "wide";
    // Called for the close button, Escape, and backdrop clicks. The parent
    // closes the modal by unmounting it, or ignores the request while busy.
    onclose: () => void;
    // Fixed content between the header and the scrolling body.
    toolbar?: Snippet;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    title,
    subtitle,
    width = "normal",
    onclose,
    toolbar,
    children,
    footer,
  }: Props = $props();

  const widths = {
    narrow: "max-w-md",
    normal: "max-w-xl",
    wide: "max-w-2xl",
  };

  const titleId = $props.id();
  let dialog: HTMLDialogElement;
  let pressedBackdrop = false;

  onMount(() => {
    dialog.showModal();
  });

  function handleCancel(e: Event) {
    // An uncancelable cancel closes the dialog; handleClose takes it from there.
    if (!e.cancelable) return;
    e.preventDefault();
    onclose();
  }

  // The browser may close the dialog without a cancelable event, such as a
  // repeated Escape. Reopen it if the parent kept it mounted.
  async function handleClose() {
    onclose();
    await tick();
    if (dialog.isConnected && !dialog.open) dialog.showModal();
  }

  // Only a press and release both on the backdrop closes the modal, so a text
  // selection dragged out of the dialog does not.
  function handlePointerDown(e: PointerEvent) {
    pressedBackdrop = e.target === dialog;
  }

  function handleClick(e: MouseEvent) {
    // The modal renders inside its opener's markup; keep its clicks there.
    e.stopPropagation();
    if (pressedBackdrop && e.target === dialog) onclose();
    pressedBackdrop = false;
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  class="m-auto w-[calc(100%-2rem)] {widths[
    width
  ]} rounded-lg bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:shadow-black/50"
  oncancel={handleCancel}
  onclose={handleClose}
  onpointerdown={handlePointerDown}
  onclick={handleClick}
  onkeydown={(e) => e.stopPropagation()}
>
  <div class="flex max-h-[80vh] flex-col">
    <div
      class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-neutral-800"
    >
      <div class="min-w-0">
        <h2 id={titleId} class="text-lg font-semibold">{title}</h2>
        {#if subtitle}
          <p class="truncate text-sm text-slate-500 dark:text-neutral-400">
            {subtitle}
          </p>
        {/if}
      </div>
      <CloseButton onclick={onclose} />
    </div>

    {#if toolbar}
      <div class="border-b border-slate-200 px-5 py-3 dark:border-neutral-800">
        {@render toolbar()}
      </div>
    {/if}

    <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
      {@render children()}
    </div>

    {#if footer}
      <div
        class="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-neutral-800"
      >
        {@render footer()}
      </div>
    {/if}
  </div>
</dialog>
