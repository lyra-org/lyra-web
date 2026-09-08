<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { PublicUser } from "./types";
  import { fetchUsers } from "./api";
  import ServerSettings from "./ServerSettings.svelte";
  import UserSettings from "./UserSettings.svelte";
  import { getAuth } from "./auth.svelte";
  import type {
    PluginManifestResponse,
    PluginSettingsResponse,
    PluginSettingsEntry,
    PluginSettingsScope,
    PluginSettingValue,
    GroupResponse,
    FieldResponse,
  } from "./types";
  import {
    fetchPlugins,
    fetchAllPluginSettings,
    fetchAllUserPluginSettings,
    updatePluginSettings,
    updateUserPluginSettings,
    deletePluginSettings,
    deleteUserPluginSettings,
    restartPlugin,
  } from "./api";

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();
  const auth = getAuth();
  let section = $state<"server" | "plugins" | "users">(
    untrack(() =>
      auth.hasPermission("manage_server")
        ? "server"
        : auth.hasPermission("manage_users")
          ? "users"
          : "plugins",
    ),
  );
  let serverDirty = $state(false);
  let serverBusy = $state(false);

  function closeSettings() {
    if (serverBusy) return;
    if (serverDirty && !confirm("Discard unsaved server settings?")) return;
    onclose();
  }

  let usersExpanded = $state(true);
  let users = $state<PublicUser[]>([]);
  let loadingUsers = $state(true);
  let usersError = $state<string | null>(null);
  let selectedUserId = $state<string | null>(null);
  let selectedUser = $derived(
    users.find((user) => user.id === selectedUserId) ?? null,
  );

  async function loadUsers() {
    loadingUsers = true;
    usersError = null;
    try {
      users = await fetchUsers();
    } catch {
      usersError = "Unable to load users.";
    } finally {
      loadingUsers = false;
    }
  }

  function updateUser(user: PublicUser) {
    users = users.some((item) => item.id === user.id)
      ? users.map((item) => (item.id === user.id ? user : item))
      : [...users, user];
  }

  function removeUser(id: string) {
    users = users.filter((user) => user.id !== id);
    if (selectedUserId === id) selectedUserId = null;
  }

  function toggleUsers() {
    usersExpanded = !usersExpanded;
    if (usersExpanded) {
      section = "users";
      selectedUserId = null;
    }
  }

  onMount(() => {
    if (auth.hasPermission("manage_users")) void loadUsers();
  });
  let pluginsExpanded = $state(false);

  let plugins = $state<PluginManifestResponse[]>([]);
  let loadingPlugins = $state(true);
  let pluginsError = $state<string | null>(null);

  let selectedPluginId = $state<string | null>(null);
  let scope = $state<PluginSettingsScope>("server");

  let entriesByScope = $state<
    Record<PluginSettingsScope, Map<string, PluginSettingsEntry> | null>
  >({ server: null, user: null });
  let loadingByScope = $state<Record<PluginSettingsScope, boolean>>({
    server: false,
    user: false,
  });
  let errorByScope = $state<Record<PluginSettingsScope, string | null>>({
    server: null,
    user: null,
  });

  let values = $state<Record<string, PluginSettingValue>>({});
  let dirty = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let actionMessage = $state<string | null>(null);

  let selectedPlugin = $derived(
    plugins.find((p) => p.id === selectedPluginId) ?? null,
  );

  let entry = $derived.by<PluginSettingsEntry | null>(() => {
    if (selectedPluginId == null) return null;
    const map = entriesByScope[scope];
    if (map == null) return null;
    return map.get(selectedPluginId) ?? null;
  });

  let groups = $derived<GroupResponse[]>(
    entry != null && entry.status === "ready" ? entry.groups : [],
  );

  async function loadPlugins() {
    loadingPlugins = true;
    pluginsError = null;
    try {
      const list = await fetchPlugins();
      plugins = list;
      if (list.length > 0 && selectedPluginId == null) {
        selectedPluginId = list[0].id;
      }
    } catch (err) {
      pluginsError =
        err instanceof Error ? err.message : "Failed to load plugins";
    } finally {
      loadingPlugins = false;
    }
  }

  async function loadEntries(s: PluginSettingsScope, force = false) {
    if (!force && (entriesByScope[s] != null || loadingByScope[s])) return;
    loadingByScope = { ...loadingByScope, [s]: true };
    errorByScope = { ...errorByScope, [s]: null };
    try {
      const result =
        s === "server"
          ? await fetchAllPluginSettings()
          : await fetchAllUserPluginSettings();
      const map = new Map<string, PluginSettingsEntry>();
      for (const e of result.entries) map.set(e.plugin_id, e);
      entriesByScope = { ...entriesByScope, [s]: map };
    } catch (err) {
      errorByScope = {
        ...errorByScope,
        [s]: err instanceof Error ? err.message : "Failed to load settings",
      };
    } finally {
      loadingByScope = { ...loadingByScope, [s]: false };
    }
  }

  function setEntry(s: PluginSettingsScope, e: PluginSettingsEntry) {
    const existing = entriesByScope[s];
    const next = new Map(existing ?? []);
    next.set(e.plugin_id, e);
    entriesByScope = { ...entriesByScope, [s]: next };
  }

  function removeEntry(s: PluginSettingsScope, pluginId: string) {
    const existing = entriesByScope[s];
    if (existing == null) return;
    const next = new Map(existing);
    next.delete(pluginId);
    entriesByScope = { ...entriesByScope, [s]: next };
  }

  function collectValuesFromGroups(
    gs: GroupResponse[],
  ): Record<string, PluginSettingValue> {
    const out: Record<string, PluginSettingValue> = {};
    for (const group of gs) {
      for (const field of group.fields) {
        out[field.key] = field.value ?? null;
      }
    }
    return out;
  }

  function setField(key: string, value: PluginSettingValue) {
    values = { ...values, [key]: value };
    dirty = true;
    saveError = null;
    actionMessage = null;
  }

  async function save() {
    if (selectedPluginId == null || !dirty || saving) return;
    saving = true;
    saveError = null;
    actionMessage = null;
    try {
      const updated =
        scope === "server"
          ? await updatePluginSettings(selectedPluginId, values)
          : await updateUserPluginSettings(selectedPluginId, values);
      setEntry(scope, {
        status: "ready",
        plugin_id: updated.plugin_id,
        groups: updated.groups,
      });
      values = collectValuesFromGroups(updated.groups);
      dirty = false;
      actionMessage = "Settings saved.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to save";
    } finally {
      saving = false;
    }
  }

  async function reset() {
    if (selectedPluginId == null || saving) return;
    if (
      !confirm(
        scope === "server"
          ? "Delete all stored settings for this plugin?"
          : "Delete your saved preferences for this plugin?",
      )
    ) {
      return;
    }
    const pluginId = selectedPluginId;
    const targetScope = scope;
    saving = true;
    saveError = null;
    actionMessage = null;
    try {
      if (targetScope === "server") {
        await deletePluginSettings(pluginId);
      } else {
        await deleteUserPluginSettings(pluginId);
      }
      removeEntry(targetScope, pluginId);
      await loadEntries(targetScope, true);
      actionMessage = "Settings cleared.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to reset";
    } finally {
      saving = false;
    }
  }

  async function restart() {
    if (selectedPluginId == null || saving) return;
    saving = true;
    saveError = null;
    actionMessage = null;
    try {
      await restartPlugin(selectedPluginId);
      actionMessage = "Plugin restarted.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to restart";
    } finally {
      saving = false;
    }
  }

  function selectPlugin(id: string) {
    section = "plugins";
    if (selectedPluginId === id) return;
    if (
      dirty &&
      !confirm("You have unsaved changes. Discard them and switch?")
    ) {
      return;
    }
    selectedPluginId = id;
  }

  function setScope(next: PluginSettingsScope) {
    if (scope === next) return;
    if (
      dirty &&
      !confirm("You have unsaved changes. Discard them and switch?")
    ) {
      return;
    }
    scope = next;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeSettings();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeSettings();
  }

  $effect(() => {
    loadPlugins();
  });

  $effect(() => {
    loadEntries(scope);
  });

  $effect(() => {
    void selectedPluginId;
    void scope;
    saveError = null;
    actionMessage = null;
  });

  $effect(() => {
    if (entry != null && entry.status === "ready") {
      values = collectValuesFromGroups(entry.groups);
    } else {
      values = {};
    }
    dirty = false;
  });

  function fieldId(key: string) {
    return `plugin-setting-${key}`;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex bg-black/50"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="dialog"
    aria-label="Settings"
    tabindex="-1"
    class="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl dark:bg-[#1b1d1e] dark:shadow-black/60"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-neutral-800"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-neutral-100">
        Settings
      </h2>
      <button
        type="button"
        aria-label="Close settings"
        class="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        onclick={closeSettings}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Left sidebar -->
      <aside
        class="flex w-40 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 sm:w-64 dark:border-neutral-800 dark:bg-[#181a1b]"
      >
        {#if auth.hasPermission("manage_server")}
          <div class="px-2 pt-2">
            <button
              type="button"
              onclick={() => (section = "server")}
              aria-current={section === "server" ? "page" : undefined}
              class="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
              class:bg-slate-200={section === "server"}
              class:dark:bg-neutral-800={section === "server"}>Server</button
            >
          </div>
        {/if}
        {#if auth.hasPermission("manage_users")}
          <div class="px-2 pt-2">
            <button
              type="button"
              onclick={toggleUsers}
              aria-expanded={usersExpanded}
              aria-controls="settings-user-list"
              aria-current={section === "users" && selectedUserId === null
                ? "page"
                : undefined}
              class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
              class:bg-slate-200={section === "users" &&
                selectedUserId === null}
              class:dark:bg-neutral-800={section === "users" &&
                selectedUserId === null}
            >
              Users
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 transition-transform"
                class:-rotate-90={!usersExpanded}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </button>
            <nav
              id="settings-user-list"
              aria-label="Users"
              class:hidden={!usersExpanded}
            >
              {#if loadingUsers}
                <p
                  role="status"
                  class="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400"
                >
                  Loading users…
                </p>
              {:else if usersError}
                <p
                  role="alert"
                  class="px-3 py-2 text-sm text-red-600 dark:text-red-400"
                >
                  {usersError}
                </p>
                <button
                  type="button"
                  onclick={loadUsers}
                  class="px-3 py-2 text-sm underline">Retry</button
                >
              {:else}
                <ul class="space-y-0.5">
                  {#each users as user (user.id)}
                    {@const active =
                      section === "users" && selectedUserId === user.id}
                    <li>
                      <button
                        type="button"
                        onclick={() => {
                          section = "users";
                          selectedUserId = user.id;
                        }}
                        aria-current={active ? "page" : undefined}
                        class="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        class:bg-slate-200={active}
                        class:dark:bg-neutral-800={active}
                      >
                        <div class="font-medium break-all">
                          {user.username}{user.id === auth.me?.id
                            ? " (you)"
                            : ""}
                        </div>
                        <div
                          class="text-xs text-slate-500 dark:text-neutral-400"
                        >
                          {user.role ?? "No role"}
                        </div>
                      </button>
                    </li>
                  {:else}
                    <li
                      class="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400"
                    >
                      No users found.
                    </li>
                  {/each}
                </ul>
              {/if}
            </nav>
          </div>
        {/if}
        <div class="p-2">
          <button
            type="button"
            aria-expanded={pluginsExpanded}
            aria-controls="settings-plugin-list"
            onclick={() => (pluginsExpanded = !pluginsExpanded)}
            class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Plugins
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 transition-transform"
              class:-rotate-90={!pluginsExpanded}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m6 9 6 6 6-6"
              />
            </svg>
          </button>
        </div>
        <nav
          id="settings-plugin-list"
          aria-label="Plugins"
          class="shrink-0 px-2 pb-4"
          class:hidden={!pluginsExpanded}
        >
          {#if loadingPlugins}
            <p class="px-2 py-1 text-sm text-slate-500 dark:text-neutral-400">
              Loading…
            </p>
          {:else if pluginsError}
            <p class="px-2 py-1 text-sm text-red-600 dark:text-red-400">
              {pluginsError}
            </p>
          {:else if plugins.length === 0}
            <p class="px-2 py-1 text-sm text-slate-500 dark:text-neutral-400">
              No plugins loaded.
            </p>
          {:else}
            <ul class="space-y-0.5">
              {#each plugins as plugin (plugin.id)}
                {@const active =
                  section === "plugins" && plugin.id === selectedPluginId}
                <li>
                  <button
                    type="button"
                    class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors"
                    class:bg-slate-200={active}
                    class:dark:bg-neutral-800={active}
                    class:text-slate-900={active}
                    class:dark:text-neutral-100={active}
                    class:text-slate-600={!active}
                    class:dark:text-neutral-400={!active}
                    class:hover:bg-slate-100={!active}
                    class:dark:hover:bg-neutral-800={!active}
                    onclick={() => selectPlugin(plugin.id)}
                  >
                    <div class="font-medium">{plugin.name}</div>
                    <div
                      class="truncate text-xs text-slate-500 dark:text-neutral-500"
                    >
                      v{plugin.version}
                    </div>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </nav>
      </aside>

      <!-- Main content -->
      <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
        {#if auth.hasPermission("manage_server")}
          <div
            class="flex min-h-0 flex-1 flex-col"
            class:hidden={section !== "server"}
          >
            <ServerSettings bind:dirty={serverDirty} bind:busy={serverBusy} />
          </div>
        {/if}
        {#if section === "server"}
          <!-- Server settings stay mounted to preserve drafts when switching sections. -->
        {:else if section === "users" && auth.hasPermission("manage_users")}
          {#key selectedUserId}
            <UserSettings
              user={selectedUser}
              onupdate={updateUser}
              onremove={removeUser}
            />
          {/key}
        {:else if selectedPlugin == null}
          <div
            class="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-neutral-400"
          >
            Select a plugin to configure.
          </div>
        {:else}
          <!-- Plugin header -->
          <div
            class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-neutral-800"
          >
            <div>
              <h3
                class="text-base font-semibold text-slate-900 dark:text-neutral-100"
              >
                {selectedPlugin.name}
              </h3>
              <p class="text-xs text-slate-500 dark:text-neutral-400">
                {selectedPlugin.id} · v{selectedPlugin.version}
              </p>
              {#if selectedPlugin.description}
                <p class="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                  {selectedPlugin.description}
                </p>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <div
                class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]"
                role="tablist"
                aria-label="Settings scope"
              >
                {#each [{ id: "server", label: "Server" }, { id: "user", label: "Mine" }] as opt (opt.id)}
                  {@const sActive = scope === opt.id}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sActive}
                    class="rounded px-3 py-1 font-medium transition-colors"
                    class:bg-[#E6CEE3]={sActive}
                    class:text-slate-900={sActive}
                    class:dark:bg-[#BB7FB5]={sActive}
                    class:dark:text-white={sActive}
                    class:text-slate-600={!sActive}
                    class:dark:text-neutral-400={!sActive}
                    class:hover:bg-[#E6CEE3]={!sActive}
                    class:hover:text-slate-900={!sActive}
                    class:dark:hover:bg-[#BB7FB5]={!sActive}
                    class:dark:hover:text-white={!sActive}
                    onclick={() => setScope(opt.id as PluginSettingsScope)}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
              <div
                class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]"
              >
                <button
                  type="button"
                  disabled={saving}
                  onclick={restart}
                  class="rounded px-3 py-1 font-medium text-slate-600 transition-colors hover:bg-[#E6CEE3] hover:text-slate-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-[#BB7FB5] dark:hover:text-white"
                >
                  Restart
                </button>
              </div>
            </div>
          </div>

          <!-- Settings body -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            {#if loadingByScope[scope] && entriesByScope[scope] == null}
              <p class="text-sm text-slate-500 dark:text-neutral-400">
                Loading settings…
              </p>
            {:else if errorByScope[scope]}
              <p class="text-sm text-red-600 dark:text-red-400">
                {errorByScope[scope]}
              </p>
            {:else if entry != null && entry.status === "initializing"}
              <p class="text-sm text-slate-500 dark:text-neutral-400">
                Plugin is still initializing — try again in a moment.
              </p>
            {:else if entry != null && entry.status === "invalid"}
              <p class="text-sm text-red-600 dark:text-red-400">
                Stored settings are invalid: {entry.message}
              </p>
            {:else if entry == null || entry.status === "not_declared" || groups.length === 0}
              <p class="text-sm text-slate-500 dark:text-neutral-400">
                This plugin exposes no
                {scope === "server" ? "server" : "user"} settings.
              </p>
            {:else}
              <form
                class="space-y-8"
                onsubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                {#each groups as group (group.id)}
                  <fieldset class="space-y-4">
                    <legend
                      class="pb-1 text-sm font-semibold text-slate-700 dark:text-neutral-200"
                    >
                      {group.label}
                    </legend>
                    {#each group.fields as field (field.key)}
                      {@render renderField(field)}
                    {/each}
                  </fieldset>
                {/each}
              </form>
            {/if}
          </div>

          <!-- Footer / actions -->
          {#if entry != null && (entry.status === "invalid" || (entry.status === "ready" && groups.length > 0))}
            <div
              class="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-3 dark:border-neutral-800"
            >
              <div class="min-h-[1.25rem] text-sm">
                {#if saveError}
                  <span class="text-red-600 dark:text-red-400">{saveError}</span
                  >
                {:else if actionMessage}
                  <span class="text-slate-600 dark:text-neutral-400"
                    >{actionMessage}</span
                  >
                {:else if dirty}
                  <span class="text-amber-600 dark:text-amber-400"
                    >Unsaved changes</span
                  >
                {/if}
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  disabled={saving || loadingByScope[scope]}
                  onclick={reset}
                  class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Reset
                </button>
                {#if entry.status === "ready"}
                  <button
                    type="button"
                    disabled={!dirty || saving}
                    onclick={save}
                    class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                {/if}
              </div>
            </div>
          {/if}
        {/if}
      </section>
    </div>
  </div>
</div>

{#snippet renderField(field: FieldResponse)}
  <div class="space-y-1">
    {#if field.type === "bool"}
      <label class="flex items-start gap-3">
        <input
          type="checkbox"
          checked={values[field.key] === true}
          onchange={(e) =>
            setField(field.key, (e.currentTarget as HTMLInputElement).checked)}
          class="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500 dark:border-neutral-600 dark:bg-[#1b1d1e]"
        />
        <span>
          <span
            class="block text-sm font-medium text-slate-800 dark:text-neutral-200"
            >{field.label}{field.required ? " *" : ""}</span
          >
          {#if field.description}
            <span class="block text-xs text-slate-500 dark:text-neutral-400"
              >{field.description}</span
            >
          {/if}
        </span>
      </label>
    {:else}
      <label
        for={fieldId(field.key)}
        class="block text-sm font-medium text-slate-800 dark:text-neutral-200"
      >
        {field.label}{field.required ? " *" : ""}
      </label>
      {#if field.type === "string"}
        <input
          id={fieldId(field.key)}
          type="text"
          required={field.required}
          value={(values[field.key] as string | null) ?? ""}
          oninput={(e) =>
            setField(
              field.key,
              (e.currentTarget as HTMLInputElement).value || null,
            )}
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-700 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-500"
        />
      {:else if field.type === "number"}
        <input
          id={fieldId(field.key)}
          type="number"
          required={field.required}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step="any"
          value={values[field.key] == null ? "" : String(values[field.key])}
          oninput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            if (raw === "") setField(field.key, null);
            else {
              const n = Number(raw);
              if (!Number.isNaN(n)) setField(field.key, n);
            }
          }}
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-700 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-500"
        />
      {:else if field.type === "choice"}
        <select
          id={fieldId(field.key)}
          required={field.required}
          value={(values[field.key] as string | null) ?? ""}
          onchange={(e) =>
            setField(
              field.key,
              (e.currentTarget as HTMLSelectElement).value || null,
            )}
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-700 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-500"
        >
          {#if !field.required}
            <option value="">—</option>
          {/if}
          {#each field.options as opt (opt.value)}
            <option value={opt.value}
              >{opt.label}{opt.description
                ? ` — ${opt.description}`
                : ""}</option
            >
          {/each}
        </select>
      {/if}
      {#if field.description}
        <p class="text-xs text-slate-500 dark:text-neutral-400">
          {field.description}
        </p>
      {/if}
    {/if}
  </div>
{/snippet}
