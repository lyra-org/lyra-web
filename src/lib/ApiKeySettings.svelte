<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import { createApiKey, fetchApiKeys, revokeApiKey } from "./api";
  import type { ApiKeyResponse, CreatedApiKeyResponse } from "./types";

  let { busy = $bindable(false) }: { busy?: boolean } = $props();
  let keys = $state<ApiKeyResponse[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let error = $state("");
  let message = $state("");
  let name = $state("");
  let created = $state<CreatedApiKeyResponse | null>(null);
  let copied = $state(false);

  async function loadKeys() {
    loading = true;
    loadError = false;
    try {
      keys = await fetchApiKeys();
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !name.trim() || created) return;
    busy = true;
    error = "";
    message = "";
    try {
      created = await createApiKey(name.trim());
      const { id, name: keyName, created_at, last_used_at } = created;
      keys = [...keys, { id, name: keyName, created_at, last_used_at }];
      name = "";
      copied = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to create API key.";
    } finally {
      busy = false;
    }
  }

  async function revoke(key: ApiKeyResponse) {
    if (
      busy ||
      !confirm(
        `Revoke “${key.name}”? Apps using this key will lose access immediately.`,
      )
    )
      return;
    busy = true;
    error = "";
    message = "";
    try {
      await revokeApiKey(key.id);
      keys = keys.filter((item) => item.id !== key.id);
      if (created?.id === key.id) created = null;
      message = `Revoked “${key.name}”.`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to revoke API key.";
    } finally {
      busy = false;
    }
  }

  async function copyKey() {
    if (!created) return;
    error = "";
    try {
      await navigator.clipboard.writeText(created.key);
      copied = true;
    } catch {
      error = "Unable to copy. Select the key and copy it manually.";
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  onMount(() => {
    void loadKeys();
  });
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    API keys
  </h3>
</div>
<div class="flex-1 space-y-6 overflow-y-auto p-6">
  <p class="text-sm text-slate-600 dark:text-neutral-300">
    Connect apps and scripts to your Lyra account.
  </p>
  {#if loading}
    <p role="status" class="text-sm">Loading API keys…</p>
  {:else if loadError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">
      Unable to load API keys.
    </p>
    <button type="button" onclick={loadKeys} class="text-sm underline"
      >Retry</button
    >
  {:else}
    <form onsubmit={create} class="max-w-md space-y-3">
      <label for="api-key-name" class="block text-sm font-medium"
        >Key name</label
      >
      <input
        id="api-key-name"
        bind:value={name}
        required
        disabled={busy || created !== null}
        placeholder="e.g. Music assistant"
        autocomplete="off"
        class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#BB7FB5] focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
      />
      <button
        type="submit"
        disabled={busy || !name.trim() || created !== null}
        class="rounded-md bg-[#E6CEE3] px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white"
        >Create key</button
      >
    </form>
    {#if created}
      <div
        class="space-y-3 rounded-md border border-slate-300 p-4 dark:border-neutral-700"
      >
        <p class="text-sm font-medium">Key created: {created.name}</p>
        <p class="text-sm text-slate-600 dark:text-neutral-300">
          Copy this key now. You won’t be able to see it again.
        </p>
        <input
          aria-label="New API key"
          readonly
          value={created.key}
          spellcheck={false}
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
        />
        <div class="flex gap-4 text-sm">
          <button type="button" onclick={copyKey} class="underline"
            >{copied ? "Copied" : "Copy key"}</button
          >
          <button
            type="button"
            disabled={busy}
            onclick={() => {
              created = null;
              error = "";
            }}
            class="underline">Done</button
          >
        </div>
      </div>
    {/if}
    {#if keys.length === 0}
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        You haven’t created any API keys.
      </p>
    {:else}
      <ul class="divide-y divide-slate-200 dark:divide-neutral-800">
        {#each keys as key (key.id)}
          <li class="flex flex-wrap items-center justify-between gap-3 py-4">
            <div class="min-w-0 space-y-1">
              <p class="text-sm font-medium break-all">{key.name}</p>
              <p class="text-xs text-slate-500 dark:text-neutral-400">
                Created {formatDate(key.created_at)}
              </p>
              <p class="text-xs text-slate-500 dark:text-neutral-400">
                {key.last_used_at
                  ? `Last used ${formatDate(key.last_used_at)}`
                  : "Never used"}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onclick={() => revoke(key)}
              aria-label={`Revoke ${key.name}`}
              class="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
              >Revoke</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if busy}<p
      role="status"
      class="text-sm text-slate-500 dark:text-neutral-400"
    >
      Saving…
    </p>{/if}
  {#if error}<p role="alert" class="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>{/if}
  {#if message}<p
      role="status"
      class="text-sm text-green-700 dark:text-green-400"
    >
      {message}
    </p>{/if}
</div>
