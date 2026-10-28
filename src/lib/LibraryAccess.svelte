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
    fetchLibraryAccess,
    fetchUsers,
    grantLibraryAccess,
    revokeLibraryAccess,
  } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import type { LibraryAccessResponse, PublicUser } from "./types";

  let { libraryId }: { libraryId: string } = $props();

  const auth = getAuth();
  // Without manage_users the user list is unavailable, so grants fall back
  // to a typed username.
  const canListUsers = auth.hasPermission("manage_users");

  let grants = $state<LibraryAccessResponse[]>([]);
  let users = $state<PublicUser[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let selected = $state("");
  let granting = $state(false);
  let revokingId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $derived(granting || revokingId !== null);
  let ungranted = $derived(
    users.filter((user) => !grants.some((grant) => grant.id === user.id)),
  );

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [access, allUsers] = await Promise.all([
        fetchLibraryAccess(libraryId),
        canListUsers ? fetchUsers() : Promise.resolve([]),
      ]);
      grants = access;
      users = allUsers;
    } catch {
      loadError = "Unable to load library access.";
    } finally {
      loading = false;
    }
  }

  async function grant(e: SubmitEvent) {
    e.preventDefault();
    const user = selected.trim();
    if (!user || busy) return;
    granting = true;
    error = null;
    try {
      await grantLibraryAccess(libraryId, user);
      grants = await fetchLibraryAccess(libraryId);
      selected = "";
    } catch (err) {
      error =
        err instanceof ApiError && err.status === 404
          ? `User not found: ${user}`
          : "Unable to grant access.";
    } finally {
      granting = false;
    }
  }

  async function revoke(grant: LibraryAccessResponse) {
    if (busy) return;
    revokingId = grant.id;
    error = null;
    try {
      await revokeLibraryAccess(libraryId, grant.id);
      grants = grants.filter((item) => item.id !== grant.id);
    } catch {
      error = `Unable to revoke access for ${grant.username}.`;
    } finally {
      revokingId = null;
    }
  }

  $effect(() => {
    void libraryId;
    untrack(() => {
      void load();
    });
  });
</script>

<section
  aria-labelledby="lib-access-heading"
  class="space-y-3 border-t border-slate-200 pt-4 dark:border-neutral-800"
>
  <div>
    <h3
      id="lib-access-heading"
      class="text-sm font-medium text-slate-700 dark:text-neutral-200"
    >
      Access
    </h3>
    <p class="text-sm text-slate-500 dark:text-neutral-400">
      Administrators can access every library.
    </p>
  </div>

  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">Loading access…</p>
  {:else if loadError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">
      {loadError}
    </p>
    <button type="button" onclick={load} class="text-sm underline">Retry</button
    >
  {:else}
    {#if grants.length === 0}
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        No other users have access.
      </p>
    {:else}
      <ul class="space-y-2">
        {#each grants as grant (grant.id)}
          <li class="flex items-center justify-between gap-3 text-sm">
            <div class="flex min-w-0 items-center gap-2">
              <span class="truncate text-slate-900 dark:text-neutral-100">
                {grant.username}
              </span>
              {#if grant.role}
                <span
                  class="rounded bg-[#E6CEE3] px-1.5 text-xs text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
                >
                  {grant.role}
                </span>
              {/if}
            </div>
            <button
              type="button"
              disabled={busy}
              onclick={() => revoke(grant)}
              class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >{revokingId === grant.id ? "Revoking…" : "Revoke"}</button
            >
          </li>
        {/each}
      </ul>
    {/if}

    <form class="flex gap-2" onsubmit={grant}>
      {#if canListUsers}
        <select
          aria-label="User"
          bind:value={selected}
          disabled={busy || ungranted.length === 0}
          class={inputClass}
        >
          <option value="" disabled>
            {ungranted.length === 0 ? "No users to add" : "Select a user"}
          </option>
          {#each ungranted as user (user.id)}
            <option value={user.id}>{user.username}</option>
          {/each}
        </select>
      {:else}
        <input
          type="text"
          aria-label="Username"
          bind:value={selected}
          disabled={busy}
          placeholder="Username"
          autocomplete="off"
          autocapitalize="none"
          class={inputClass}
        />
      {/if}
      <button
        type="submit"
        disabled={busy || !selected.trim()}
        class="shrink-0 rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        >{granting ? "Granting…" : "Grant"}</button
      >
    </form>

    {#if error}
      <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
    {/if}
  {/if}
</section>
