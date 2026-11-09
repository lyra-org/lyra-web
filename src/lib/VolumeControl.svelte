<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  let {
    value,
    disabled = false,
    title,
    class: className = "",
    oninput,
    onchange,
  }: {
    value: number;
    disabled?: boolean;
    title?: string;
    class?: string;
    oninput: (v: number) => void;
    /** Called once a change settles: on slider release and on (un)mute. */
    onchange?: () => void;
  } = $props();

  // The level unmuting returns to. Taken when the slider settles rather than
  // on every input, so dragging down to zero doesn't leave a sliver behind.
  let restoreLevel = 1;

  function toggleMute() {
    if (value > 0) {
      restoreLevel = value;
      oninput(0);
    } else {
      oninput(restoreLevel);
    }
    onchange?.();
  }

  function settle() {
    if (value > 0) restoreLevel = value;
    onchange?.();
  }
</script>

<div class="flex min-w-0 items-center gap-1.5 {className}" {title}>
  <button
    type="button"
    class="cursor-pointer text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-300"
    onclick={toggleMute}
    {disabled}
    aria-label={value === 0 ? "Unmute" : "Mute"}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
        clip-rule="evenodd"
      />
      {#if value === 0}
        <path
          fill-rule="evenodd"
          d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      {:else}
        <path
          fill-rule="evenodd"
          d="M11.828 5.757a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
          clip-rule="evenodd"
        />
        {#if value >= 0.5}
          <path
            fill-rule="evenodd"
            d="M14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        {/if}
      {/if}
    </svg>
  </button>
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    {value}
    {disabled}
    oninput={(e) => oninput(Number(e.currentTarget.value))}
    onchange={settle}
    class="h-1 w-20 min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#E6CEE3] disabled:cursor-not-allowed disabled:opacity-30 dark:bg-neutral-700 dark:accent-[#BB7FB5]"
    aria-label="Volume"
  />
</div>
