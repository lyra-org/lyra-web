<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import { loginUser } from "./api";
  import { getAuth } from "./auth.svelte";
  import logo from "../assets/logo.svg";

  interface Props {
    initialUsername?: string;
    notice?: string | null;
    ondone?: () => void;
  }

  let { initialUsername = "", notice = null, ondone }: Props = $props();

  const auth = getAuth();

  let username = $state(untrack(() => initialUsername));
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    error = null;
    try {
      const session = await loginUser(username, password);
      auth.login(session);
      ondone?.();
      window.location.hash = "#/";
    } catch (err) {
      error = err instanceof Error ? err.message : "Login failed";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="w-full max-w-sm">
    <img src={logo} alt="Lyra" class="mx-auto mb-8 h-24 w-24 scale-175" />
    <h1
      class="mb-6 text-center text-2xl font-semibold text-slate-900 dark:text-neutral-100"
    >
      Log in
    </h1>
    {#if notice}
      <p
        class="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {notice}
      </p>
    {/if}
    <form class="space-y-4" onsubmit={handleSubmit}>
      <div>
        <label
          for="username"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
          >Username</label
        >
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          minlength={3}
          autocomplete="username"
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
        />
      </div>
      <div>
        <label
          for="password"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
          >Password</label
        >
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength={8}
          autocomplete="current-password"
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
        />
      </div>
      {#if error}
        <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
      {/if}
      <button
        type="submit"
        disabled={submitting}
        class="w-full rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      >
        {submitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  </div>
</div>
