<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type {
    CatalogRepository,
    PluginManifestResponse,
    PluginPreviewResponse,
    RepositoryPreview,
  } from "./types";
  import {
    addPluginRepository,
    installRepositoryPlugins,
    removePluginRepository,
    resolvePluginRepository,
    updatePlugins,
  } from "./api";
  import { getSetup } from "./setup.svelte.ts";
  import {
    describeHold,
    isAwaitingApproval,
    offeredRelease,
    updateOutcome,
  } from "./pluginUpdates.svelte.ts";
  import PluginHoldNotice from "./PluginHoldNotice.svelte";
  import PluginAccess from "./PluginAccess.svelte";
  import PluginInstallConfirm from "./PluginInstallConfirm.svelte";
  import PluginSource from "./PluginSource.svelte";
  import { pluginOrigin } from "./pluginSource";
  import PluginAccessLabels from "./PluginAccessLabels.svelte";

  interface Props {
    plugins: PluginManifestResponse[];
    busy?: boolean;
    // Called after the installed set changed; the parent reloads its list.
    onchange: () => Promise<void> | void;
    // Called after a check for updates; the parent reloads only its list.
    onrefresh: () => Promise<void> | void;
  }

  let {
    plugins,
    busy = $bindable(false),
    onchange,
    onrefresh,
  }: Props = $props();

  const setup = getSetup();

  // Identifies the running action, e.g. `update:musicbrainz`.
  let pending = $state<string | null>(null);
  let error = $state("");
  let message = $state("");

  let repositoryUrl = $state("");
  let repositoryRef = $state("");
  let repositoryPreview = $state<RepositoryPreview | null>(null);

  $effect(() => {
    busy = pending != null;
  });

  let disabled = $derived(pending != null || setup.catalogLoading);

  interface CatalogEntry {
    repo: CatalogRepository;
    plugin: PluginPreviewResponse;
  }

  let available = $derived(
    (setup.catalog ?? [])
      .map((repo) => ({
        repo,
        plugins: repo.plugins.filter((plugin) => plugin.status === "available"),
      }))
      .filter((group) => group.plugins.length > 0),
  );

  let outdated = $derived(
    plugins.filter(
      (plugin) => offeredRelease(plugin) != null && !isAwaitingApproval(plugin),
    ),
  );

  let held = $derived(plugins.filter(isAwaitingApproval));

  // A plugin from outside the official repository, awaiting confirmation.
  let confirming = $state<CatalogEntry | null>(null);

  onMount(() => {
    if (setup.catalog == null && !setup.catalogLoading) {
      void setup.loadCatalog();
    }
  });

  async function run(key: string, action: () => Promise<string>) {
    if (disabled) return;
    pending = key;
    error = "";
    message = "";
    try {
      message = await action();
    } catch (err) {
      error = err instanceof Error ? err.message : "Something went wrong.";
    } finally {
      pending = null;
    }
  }

  // Refreshing the catalog stores the release each repository offers, which
  // is what the plugin statuses are derived from. A check changes no
  // settings, so only the plugin list is reloaded.
  async function checkForUpdates() {
    error = "";
    message = "";
    const failed = await setup.refreshCatalog();
    error = failed
      .map((failure) => `Couldn’t check ${failure.name}: ${failure.error}`)
      .join(" ");
    await onrefresh();
  }

  // Without a list the server updates every plugin whose update is not held,
  // so this never approves scopes. The server stores the listing it updated
  // from, and an updated plugin stays installed, so the catalog is not
  // refreshed.
  function updateAll() {
    return run("update-all", async () => {
      const result = await updatePlugins();
      await onchange();
      return updateOutcome(result);
    });
  }

  // Naming the held release in the request grants the scopes it adds.
  function approve(plugin: PluginManifestResponse) {
    const release = offeredRelease(plugin);
    if (release == null) return;
    return run(`approve:${plugin.id}`, async () => {
      const result = await updatePlugins([release]);
      await onchange();
      return updateOutcome(result);
    });
  }

  function install(entry: CatalogEntry) {
    return run(`install:${entry.plugin.id}`, async () => {
      const result = await installRepositoryPlugins(entry.repo.id, [
        { id: entry.plugin.id, commit: entry.plugin.commit! },
      ]);
      await onchange();
      // `up_to_date` is what this repository now reports. Other repositories
      // listing the plugin compare against their own offer, but the catalog
      // only needs to know the plugin is no longer available.
      for (const installed of result.installed) {
        setup.setCatalogStatus(installed.id, { status: "up_to_date" });
      }
      const failure = result.failed[0];
      if (failure) throw new Error(`${failure.id}: ${failure.error}`);
      const hold = result.held[0];
      if (hold) {
        throw new Error(
          `${hold.id}: ${describeHold(hold.hold, hold.release.version)}`,
        );
      }
      return `Installed ${entry.plugin.name}.`;
    });
  }

  function requestInstall(entry: CatalogEntry) {
    if (entry.plugin.official) {
      void install(entry);
    } else {
      confirming = entry;
    }
  }

  function confirmInstall() {
    const entry = confirming;
    confirming = null;
    if (entry) void install(entry);
  }

  function previewRepository(event: SubmitEvent) {
    event.preventDefault();
    return run("resolve", async () => {
      repositoryPreview = await resolvePluginRepository({
        url: repositoryUrl.trim(),
        ref: repositoryRef.trim() || null,
      });
      return "";
    });
  }

  function addRepository() {
    return run("add-repository", async () => {
      const added = await addPluginRepository({
        url: repositoryUrl.trim(),
        ref: repositoryRef.trim() || null,
      });
      repositoryUrl = "";
      repositoryRef = "";
      repositoryPreview = null;
      await setup.loadCatalog();
      return `Added ${added.name}.`;
    });
  }

  function removeRepository(repo: CatalogRepository) {
    if (
      !confirm(`Remove ${repo.name}? Plugins installed from it stay installed.`)
    ) {
      return;
    }
    return run(`remove-repository:${repo.id}`, async () => {
      await removePluginRepository(repo.id);
      await setup.loadCatalog();
      return `Removed ${repo.name}.`;
    });
  }

  const primaryClass =
    "rounded-md bg-[#E6CEE3] px-3 py-1.5 text-sm font-medium text-slate-900 disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white";
  const secondaryClass =
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800";
  const dangerClass =
    "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400";
  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#BB7FB5] focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100";
  const headingClass =
    "text-sm font-semibold text-slate-900 dark:text-neutral-100";
  const mutedClass = "text-sm text-slate-500 dark:text-neutral-400";
</script>

<div class="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    Plugins
  </h3>
  <div class="flex flex-wrap gap-2">
    {#if outdated.length > 0}
      <button type="button" class={primaryClass} {disabled} onclick={updateAll}>
        {pending === "update-all"
          ? "Updating…"
          : `Update all (${outdated.length})`}
      </button>
    {/if}
    <button
      type="button"
      class={secondaryClass}
      {disabled}
      onclick={checkForUpdates}
    >
      {setup.catalogLoading ? "Checking…" : "Check for updates"}
    </button>
  </div>
</div>

<div class="flex-1 space-y-8 overflow-y-auto p-6">
  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
  {#if message}
    <p role="status" class="text-sm text-green-700 dark:text-green-400">
      {message}
    </p>
  {/if}
  {#if setup.catalogError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">
      Couldn’t reach the plugin repositories: {setup.catalogError}
    </p>
  {/if}

  {#if held.length > 0}
    <section class="space-y-2">
      <h4 class={headingClass}>Waiting for approval</h4>
      <p class={mutedClass}>These updates were not installed automatically.</p>
      <ul class="divide-y divide-slate-200 dark:divide-neutral-800">
        {#each held as plugin (plugin.id)}
          {#if plugin.source.kind === "repository" && plugin.source.hold && plugin.source.offered}
            <li class="flex flex-wrap items-start justify-between gap-3 py-4">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="text-sm font-medium">{plugin.name}</span>
                  <span class="text-xs text-slate-400 dark:text-neutral-500"
                    >{plugin.version ? `v${plugin.version} → ` : ""}v{plugin
                      .source.offered.version}</span
                  >
                  <PluginSource
                    official={plugin.source.official}
                    origin={plugin.source.origin}
                  />
                </div>
                <PluginHoldNotice
                  hold={plugin.source.hold}
                  version={plugin.source.offered.version}
                />
              </div>
              {#if plugin.source.hold.reason === "adds_reach"}
                <button
                  type="button"
                  class={primaryClass}
                  {disabled}
                  onclick={() => approve(plugin)}
                >
                  {pending === `approve:${plugin.id}`
                    ? "Updating…"
                    : "Approve and update"}
                </button>
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  <section class="space-y-2">
    <h4 class={headingClass}>Available</h4>
    {#if setup.catalog == null}
      <p role="status" class={mutedClass}>
        {setup.catalogLoading ? "Fetching the plugin catalog…" : ""}
      </p>
    {:else if available.length === 0}
      <p class={mutedClass}>
        Every plugin from your repositories is installed.
      </p>
    {:else}
      {#each available as group (group.repo.id)}
        {#if (setup.catalog ?? []).length > 1}
          <p
            class="pt-2 text-xs font-medium text-slate-500 dark:text-neutral-400"
          >
            {group.repo.name}
          </p>
        {/if}
        <ul class="divide-y divide-slate-200 dark:divide-neutral-800">
          {#each group.plugins as plugin (plugin.id)}
            <li class="flex flex-wrap items-start justify-between gap-3 py-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="text-sm font-medium"
                    >{plugin.name || plugin.id}</span
                  >
                  {#if plugin.version}
                    <span class="text-xs text-slate-400 dark:text-neutral-500"
                      >v{plugin.version}</span
                    >
                  {/if}
                  <PluginSource
                    official={plugin.official}
                    origin={pluginOrigin(group.repo.origin, plugin)}
                  />
                </div>
                {#if plugin.description}
                  <p class="mt-1 text-sm text-slate-600 dark:text-neutral-400">
                    {plugin.description}
                  </p>
                {/if}
                {#if plugin.error}
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {plugin.error}
                  </p>
                {/if}
                <PluginAccess {plugin} />
              </div>
              {#if plugin.commit && !plugin.error}
                <button
                  type="button"
                  class={primaryClass}
                  {disabled}
                  onclick={() => requestInstall({ repo: group.repo, plugin })}
                >
                  {pending === `install:${plugin.id}`
                    ? "Installing…"
                    : "Install"}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  </section>

  <section class="space-y-2">
    <h4 class={headingClass}>Repositories</h4>
    {#if setup.catalog != null}
      {#if setup.catalog.length === 0}
        <p class={mutedClass}>No repositories are subscribed.</p>
      {:else}
        <ul class="divide-y divide-slate-200 dark:divide-neutral-800">
          {#each setup.catalog as repo (repo.id)}
            <li class="flex flex-wrap items-center justify-between gap-3 py-4">
              <div class="min-w-0 space-y-1">
                <p class="text-sm font-medium">{repo.name}</p>
                <p
                  class="text-xs break-all text-slate-500 dark:text-neutral-400"
                >
                  {repo.origin}
                </p>
                <p class="text-xs text-slate-500 dark:text-neutral-400">
                  {#if repo.resolved_ref}
                    <span class="font-mono">{repo.resolved_ref}</span> ·
                  {/if}
                  {#if repo.commit}
                    <span class="font-mono">{repo.commit.slice(0, 7)}</span> ·
                  {/if}
                  {repo.plugins.length} plugin{repo.plugins.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>
              <button
                type="button"
                class={dangerClass}
                {disabled}
                aria-label={`Remove ${repo.name}`}
                onclick={() => removeRepository(repo)}>Remove</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <form onsubmit={previewRepository} class="max-w-md space-y-3 pt-2">
      <label for="plugin-repository-url" class="block text-sm font-medium"
        >Add a repository</label
      >
      <input
        id="plugin-repository-url"
        bind:value={repositoryUrl}
        oninput={() => (repositoryPreview = null)}
        required
        {disabled}
        placeholder="https://github.com/owner/repository"
        autocomplete="off"
        spellcheck={false}
        class={inputClass}
      />
      <input
        aria-label="Branch, tag, or commit (optional)"
        bind:value={repositoryRef}
        oninput={() => (repositoryPreview = null)}
        {disabled}
        placeholder="Branch, tag, or commit (optional)"
        autocomplete="off"
        spellcheck={false}
        class={inputClass}
      />
      {#if repositoryPreview == null}
        <button
          type="submit"
          class={secondaryClass}
          disabled={disabled || !repositoryUrl.trim()}
        >
          {pending === "resolve" ? "Checking…" : "Preview"}
        </button>
      {:else}
        <div
          class="space-y-2 rounded-md border border-slate-300 p-4 dark:border-neutral-700"
        >
          <p class="text-sm font-medium">
            {repositoryPreview.name}
            <span class="font-mono text-xs font-normal text-slate-500"
              >{repositoryPreview.resolved_ref}</span
            >
          </p>
          {#if repositoryPreview.plugins.length === 0}
            <p class={mutedClass}>This repository provides no plugins.</p>
          {:else}
            <ul class="space-y-1">
              {#each repositoryPreview.plugins as plugin (plugin.id)}
                <li class="text-sm text-slate-600 dark:text-neutral-300">
                  {plugin.name}
                  <span class="text-xs text-slate-400 dark:text-neutral-500"
                    >v{plugin.version}</span
                  >
                  <PluginSource
                    official={plugin.official}
                    origin={pluginOrigin(repositoryPreview.origin, plugin)}
                  />
                  {#if plugin.access && plugin.access.effects.length > 0}
                    <div class="mt-1">
                      <PluginAccessLabels effects={plugin.access.effects} />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
          <button
            type="button"
            class={primaryClass}
            {disabled}
            onclick={addRepository}
          >
            {pending === "add-repository" ? "Adding…" : "Add repository"}
          </button>
        </div>
      {/if}
    </form>
  </section>
</div>

{#if confirming}
  <PluginInstallConfirm
    entries={[
      {
        plugin: confirming.plugin,
        origin: pluginOrigin(confirming.repo.origin, confirming.plugin),
      },
    ]}
    onclose={() => (confirming = null)}
    onconfirm={confirmInstall}
  />
{/if}
