<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { ApiError, changePassword } from "./api";
  import { getSetup } from "./setup.svelte.ts";

  let { busy = $bindable(false) }: { busy?: boolean } = $props();

  const setup = getSetup();
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmation = $state("");
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#BB7FB5] focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100";

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    error = null;
    message = null;
    if (newPassword.length < 8 || /[^\x00-\x7F]/.test(newPassword)) {
      error = "Use a password with at least 8 ASCII characters.";
      return;
    }
    if (newPassword !== confirmation) {
      error = "Passwords do not match.";
      return;
    }
    if (
      !confirm(
        "Change your password? Your other sessions will be signed out and all of your API keys will be revoked.",
      )
    )
      return;
    busy = true;
    try {
      await changePassword(currentPassword, newPassword);
      currentPassword = "";
      newPassword = "";
      confirmation = "";
      message =
        "Password changed. Other sessions were signed out and API keys were revoked.";
    } catch (err) {
      const status = err instanceof ApiError ? err.status : null;
      error =
        status === 401
          ? "Your current password is incorrect."
          : status === 429
            ? "Too many incorrect attempts. Wait a while before trying again."
            : "Unable to change password. Check your connection and try again.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    Password
  </h3>
</div>
<div class="flex-1 space-y-6 overflow-y-auto p-6">
  {#if setup.info?.auth_enabled === false}
    <p class="text-sm text-slate-600 dark:text-neutral-300">
      Passwords can’t be changed while authentication is disabled on this
      server.
    </p>
  {:else}
    <p class="text-sm text-slate-600 dark:text-neutral-300">
      Changing your password signs out your other sessions and revokes all of
      your API keys.
    </p>
    <form class="max-w-md space-y-4" onsubmit={submit}>
      <fieldset disabled={busy} class="space-y-4 disabled:opacity-60">
        <div>
          <label
            for="current-password"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Current password</label
          >
          <input
            id="current-password"
            type="password"
            bind:value={currentPassword}
            required
            autocomplete="current-password"
            class={inputClass}
          />
        </div>
        <div>
          <label
            for="new-password"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >New password</label
          >
          <input
            id="new-password"
            type="password"
            bind:value={newPassword}
            required
            minlength={8}
            autocomplete="new-password"
            class={inputClass}
          />
        </div>
        <div>
          <label
            for="new-password-confirmation"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Confirm new password</label
          >
          <input
            id="new-password-confirmation"
            type="password"
            bind:value={confirmation}
            required
            minlength={8}
            autocomplete="new-password"
            class={inputClass}
          />
        </div>
        <button
          type="submit"
          class="rounded-md bg-[#E6CEE3] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
          >{busy ? "Changing…" : "Change password"}</button
        >
      </fieldset>
    </form>
  {/if}
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
  {#if message}
    <p role="status" class="text-sm text-green-700 dark:text-green-400">
      {message}
    </p>
  {/if}
</div>
