<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { untrack } from "svelte";
  import {
    ApiError,
    createUser,
    deleteUser,
    fetchRoles,
    updateUserRole,
    fetchMe,
  } from "./api";
  import { getAuth } from "./auth.svelte";
  import type { PublicUser, RoleResponse } from "./types";

  const auth = getAuth();
  let {
    user = null,
    onupdate,
    onremove,
  }: {
    user?: PublicUser | null;
    onupdate: (user: PublicUser) => void;
    onremove: (id: string) => void;
  } = $props();
  let roles = $state<RoleResponse[]>([]);
  let loadingRoles = $state(false);
  let rolesError = $state<string | null>(null);
  let role = $state(untrack(() => user?.role ?? ""));
  let savingRole = $state(false);
  let availableRoles = $derived(
    roles.filter((role) =>
      role.permissions.every((permission) => auth.hasPermission(permission)),
    ),
  );
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);
  let username = $state("");
  let password = $state("");
  let confirmation = $state("");
  let creating = $state(false);
  let deletingId = $state<string | null>(null);
  let busy = $derived(creating || deletingId !== null || savingRole);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#BB7FB5] focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100";

  async function loadRoles() {
    loadingRoles = true;
    rolesError = null;
    try {
      roles = await fetchRoles();
    } catch {
      rolesError =
        "Unable to load roles. Check your connection and permissions, then retry.";
    } finally {
      loadingRoles = false;
    }
  }

  async function saveRole(e: SubmitEvent) {
    e.preventDefault();
    if (
      !user ||
      busy ||
      !role ||
      role === user.role ||
      !auth.hasPermission("manage_roles")
    )
      return;
    const target = user;
    const nextRole = role;
    savingRole = true;
    error = null;
    message = null;
    try {
      await updateUserRole(target.id, nextRole);
      onupdate({ ...target, role: nextRole });
      message = "Role updated.";
      if (target.id === auth.me?.id) {
        try {
          auth.setMe(await fetchMe());
        } catch {
          auth.setMe(null);
          error =
            "Role updated, but permissions could not be refreshed. Reload the page.";
        }
      }
    } catch (err) {
      error =
        err instanceof ApiError && (err.status === 400 || err.status === 403)
          ? "Unable to change this role. You can only grant permissions you hold, and cannot demote yourself, the default user, or the last administrator."
          : "Unable to change role. Check your connection and try again.";
    } finally {
      savingRole = false;
    }
  }

  async function addUser(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !auth.hasPermission("manage_users")) return;
    error = null;
    message = null;
    if (username.length < 3 || /[^\x00-\x7F]|\s/.test(username)) {
      error = "Use a username with at least 3 ASCII characters and no spaces.";
      return;
    }
    if (password.length < 8 || /[^\x00-\x7F]/.test(password)) {
      error = "Use a password with at least 8 ASCII characters.";
      return;
    }
    if (password !== confirmation) {
      error = "Passwords do not match.";
      return;
    }
    creating = true;
    try {
      const user = await createUser(username, password);
      onupdate(user);
      username = "";
      password = "";
      confirmation = "";
      message = `Added ${user.username}.`;
    } catch (err) {
      error =
        err instanceof ApiError && err.status === 400
          ? "Unable to add user. The username may already be taken or reserved."
          : "Unable to add user. Check your connection and permissions, then try again.";
    } finally {
      creating = false;
    }
  }

  async function removeUser(user: PublicUser) {
    if (busy || user.id === auth.me?.id || !auth.hasPermission("manage_users"))
      return;
    if (
      !window.confirm(
        `Remove ${user.username}? This permanently deletes their account.`,
      )
    )
      return;
    deletingId = user.id;
    error = null;
    message = null;
    try {
      await deleteUser(user.id);
      onremove(user.id);
      message = `Removed ${user.username}.`;
    } catch (err) {
      error =
        err instanceof ApiError && (err.status === 400 || err.status === 403)
          ? "Unable to remove this user. You cannot remove yourself or the last administrator; only administrators can remove other administrators."
          : "Unable to remove user. Check your connection and try again.";
    } finally {
      deletingId = null;
    }
  }

  $effect(() => {
    if (user?.id && auth.hasPermission("manage_roles")) {
      untrack(() => {
        void loadRoles();
      });
    }
  });

  $effect(() => {
    role = user?.role ?? "";
  });
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    {user ? user.username : "Add user"}
  </h3>
</div>
<div class="flex-1 space-y-6 overflow-y-auto px-6 py-5">
  {#if user}
    <form class="max-w-md space-y-4" onsubmit={saveRole}>
      {#if !auth.hasPermission("manage_roles")}
        <p class="text-sm text-slate-600 dark:text-neutral-300">
          {user.role ?? "No role"}. You do not have permission to change roles.
        </p>
      {:else if loadingRoles}
        <p role="status" class="text-sm">Loading roles…</p>
      {:else if rolesError}
        <p role="alert" class="text-sm text-red-600 dark:text-red-400">
          {rolesError}
        </p>
        <button type="button" onclick={loadRoles} class="text-sm underline"
          >Retry</button
        >
      {:else if availableRoles.length === 0}
        <p role="status" class="text-sm text-slate-600 dark:text-neutral-300">
          No assignable roles are available.
        </p>
        <button type="button" onclick={loadRoles} class="text-sm underline"
          >Retry</button
        >
      {:else}
        <label for="user-role" class="block text-sm font-medium">Role</label>
        <select
          id="user-role"
          bind:value={role}
          disabled={busy}
          class={inputClass}
        >
          {#if !availableRoles.some((item) => item.name === user.role)}
            <option value={user.role ?? ""} disabled
              >{user.role ?? "No role"}</option
            >
          {/if}
          {#each availableRoles as option (option.id)}
            <option value={option.name}>{option.name}</option>
          {/each}
        </select>
        <button
          type="submit"
          disabled={busy || !role || role === user.role}
          class="rounded-md bg-[#E6CEE3] px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white"
          >{savingRole ? "Saving…" : "Save role"}</button
        >
      {/if}
    </form>
    <div class="space-y-3">
      <p class="text-sm text-slate-600 dark:text-neutral-300">
        {user.id === auth.me?.id
          ? "You cannot remove your own account."
          : "Permanently delete this user’s account."}
      </p>
      <button
        type="button"
        onclick={() => user && removeUser(user)}
        disabled={busy || user.id === auth.me?.id}
        class="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
        >{deletingId ? "Removing…" : "Remove user"}</button
      >
    </div>
  {:else}
    <form class="max-w-md space-y-4" onsubmit={addUser}>
      <fieldset disabled={busy} class="space-y-4 disabled:opacity-60">
        <div>
          <label
            for="new-user-username"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Username</label
          >
          <input
            id="new-user-username"
            bind:value={username}
            required
            minlength={3}
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
            class={inputClass}
          />
        </div>
        <div>
          <label
            for="new-user-password"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Password</label
          >
          <input
            id="new-user-password"
            type="password"
            bind:value={password}
            required
            minlength={8}
            autocomplete="new-password"
            class={inputClass}
          />
        </div>
        <div>
          <label
            for="new-user-confirmation"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-neutral-300"
            >Confirm password</label
          >
          <input
            id="new-user-confirmation"
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
          >{creating ? "Adding…" : "Add user"}</button
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
