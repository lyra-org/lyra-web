<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  export interface MenuAnchor {
    x: number;
    y: number;
    // "end" puts the menu's right edge at x, as for a button's dropdown.
    align: "start" | "end";
    // Pressing the element that opened the menu leaves the closing to it, so
    // that it can toggle.
    trigger?: Element;
  }

  export function anchorAtPointer(e: MouseEvent): MenuAnchor {
    return { x: e.clientX, y: e.clientY, align: "start" };
  }

  export function anchorBelow(trigger: Element): MenuAnchor {
    const rect = trigger.getBoundingClientRect();
    return { x: rect.right, y: rect.bottom + 4, align: "end", trigger };
  }

  export const menuItemClass =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left sm:py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-600";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    anchor: MenuAnchor;
    onclose: () => void;
    minWidth?: "narrow" | "wide" | "none";
    // A dialog holds controls other than menu items, such as rating stars.
    role?: "menu" | "dialog";
    label?: string;
    children: Snippet;
  }

  let {
    anchor,
    onclose,
    minWidth = "narrow",
    role = "menu",
    label,
    children,
  }: Props = $props();

  const MARGIN = 8;

  let menu: HTMLDivElement;
  let width = $state(0);
  let height = $state(0);

  let left = $derived(
    clamp(
      anchor.align === "end" ? anchor.x - width : anchor.x,
      window.innerWidth - width,
    ),
  );
  let top = $derived(clamp(anchor.y, window.innerHeight - height));

  function clamp(value: number, max: number): number {
    return Math.max(MARGIN, Math.min(value, max - MARGIN));
  }

  function isOutside(target: EventTarget | null): boolean {
    return !(target instanceof Node && menu.contains(target));
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isOutside(e.target)) return;
    if (anchor.trigger?.contains(e.target as Node)) return;
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  function handleScroll(e: Event) {
    if (isOutside(e.target)) onclose();
  }
</script>

<svelte:window
  onpointerdowncapture={handlePointerDown}
  onkeydown={handleKeydown}
  onscrollcapture={handleScroll}
  onresize={onclose}
  onblur={onclose}
/>

<!-- Hidden until measured, so that it never shows unclamped. Clicks and keys
stay inside, away from the rows and page shortcuts around it. -->
<div
  bind:this={menu}
  bind:offsetWidth={width}
  bind:offsetHeight={height}
  {role}
  aria-label={label}
  tabindex="-1"
  class="fixed z-30 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-[#1b1d1e] dark:shadow-black/50 dark:ring-white/10"
  class:min-w-40={minWidth === "narrow"}
  class:min-w-56={minWidth === "wide"}
  style:left="{left}px"
  style:top="{top}px"
  style:visibility={width > 0 ? "visible" : "hidden"}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => {
    e.stopPropagation();
    handleKeydown(e);
  }}
  oncontextmenu={(e) => e.preventDefault()}
>
  {@render children()}
</div>
