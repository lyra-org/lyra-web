<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import type {
    FailedInstallResponse,
    InstalledPluginResponse,
    RepositoryWithPreviewResponse,
  } from "./types";
  import { installPlugins, updateServerSetup } from "./api";
  import { getSetup } from "./setup.svelte.ts";
  import logo from "../assets/logo.svg";

  interface Props {
    // Called after installing or skipping; the parent refreshes server info.
    ondone: () => Promise<void> | void;
  }

  let { ondone }: Props = $props();

  const setup = getSetup();

  let selected = $state<Record<string, boolean>>({});
  let installing = $state(false);
  let skipping = $state(false);
  let finishing = $state(false);
  let actionError = $state<string | null>(null);
  let installed = $state<InstalledPluginResponse[]>([]);
  let failed = $state<FailedInstallResponse[]>([]);
  let hasResult = $state(false);

  function key(repo: RepositoryWithPreviewResponse, pluginId: string): string {
    return `${repo.repository.id}/${pluginId}`;
  }

  let selectedCount = $derived(Object.values(selected).filter(Boolean).length);

  let busy = $derived(
    installing || skipping || finishing || setup.catalogLoading,
  );

  let totalPlugins = $derived(
    (setup.catalog ?? []).reduce(
      (n, repo) => n + repo.preview.plugins.length,
      0,
    ),
  );

  onMount(() => {
    if (setup.catalog == null && !setup.catalogLoading) {
      setup.loadCatalog();
    }
  });

  function toggle(k: string, checked: boolean) {
    selected = { ...selected, [k]: checked };
  }

  function selectionsByRepository(): {
    repo: RepositoryWithPreviewResponse;
    plugins: string[];
  }[] {
    return (setup.catalog ?? [])
      .map((repo) => ({
        repo,
        plugins: repo.preview.plugins
          .filter((p) => selected[key(repo, p.id)])
          .map((p) => p.id),
      }))
      .filter((s) => s.plugins.length > 0);
  }

  async function install() {
    const groups = selectionsByRepository();
    if (groups.length === 0 || busy) return;
    installing = true;
    actionError = null;
    const nextInstalled: InstalledPluginResponse[] = [];
    const nextFailed: FailedInstallResponse[] = [];
    try {
      for (const { repo, plugins } of groups) {
        const result = await installPlugins({
          url: repo.preview.origin,
          ref: repo.preview.ref,
          plugins,
        });
        nextInstalled.push(...result.installed);
        nextFailed.push(...result.failed);
      }
      installed = nextInstalled;
      failed = nextFailed;
      hasResult = true;
      if (nextFailed.length === 0) {
        await finish();
        return;
      }
      // Keep only the failed plugins selected so "Retry" targets them.
      const failedIds = new Set(nextFailed.map((f) => f.id));
      const next: Record<string, boolean> = {};
      for (const repo of setup.catalog ?? []) {
        for (const p of repo.preview.plugins) {
          if (failedIds.has(p.id)) next[key(repo, p.id)] = true;
        }
      }
      selected = next;
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Installation failed";
    } finally {
      installing = false;
    }
  }

  async function skip() {
    if (busy) return;
    skipping = true;
    actionError = null;
    try {
      await updateServerSetup({ plugin_selection_skipped: true });
      await ondone();
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to skip";
    } finally {
      skipping = false;
    }
  }

  // Leave onboarding regardless of the outcome. If the server still reports
  // plugin selection as required (nothing was installed), record a skip so the
  // user is never trapped here.
  async function finish() {
    finishing = true;
    actionError = null;
    try {
      const info = await setup.refresh();
      if (info?.setup.plugin_selection_required) {
        await updateServerSetup({ plugin_selection_skipped: true });
      }
      await ondone();
    } catch (e) {
      actionError = e instanceof Error ? e.message : "Failed to continue";
    } finally {
      finishing = false;
    }
  }

  const primaryClass =
    "rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]";
  const secondaryClass =
    "rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800";
</script>

<div class="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
  <img src={logo} alt="Lyra" class="mx-auto mb-6 h-20 w-20 scale-175" />
  <h1
    class="mb-2 text-center text-2xl font-semibold text-slate-900 dark:text-neutral-100"
  >
    Choose plugins
  </h1>
  <p class="mb-8 text-center text-sm text-slate-500 dark:text-neutral-400">
    Plugins add metadata providers, playback sources, and more. You can change
    this later in Settings.
  </p>

  {#if setup.catalogLoading}
    <div class="flex flex-col items-center gap-3 py-16">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
      ></div>
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        Fetching the plugin catalog...
      </p>
    </div>
  {:else if setup.catalogError}
    <div
      class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30"
    >
      <p class="text-sm font-medium text-red-700 dark:text-red-300">
        Couldn't load the plugin catalog
      </p>
      <p class="mt-1 text-sm text-red-600 dark:text-red-400">
        {setup.catalogError}
      </p>
      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class={primaryClass}
          disabled={busy}
          onclick={() => setup.loadCatalog()}
        >
          Retry
        </button>
        <button
          type="button"
          class={secondaryClass}
          disabled={busy}
          onclick={skip}
        >
          {skipping ? "Skipping..." : "Skip for now"}
        </button>
      </div>
    </div>
  {:else if totalPlugins === 0}
    <div class="py-10 text-center">
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        No plugins are available from the configured repositories.
      </p>
      <button
        type="button"
        class="{primaryClass} mt-4"
        disabled={busy}
        onclick={skip}
      >
        {skipping ? "Continuing..." : "Continue"}
      </button>
    </div>
  {:else}
    <div class="space-y-6">
      {#each setup.catalog ?? [] as repo (repo.repository.id)}
        <section>
          {#if (setup.catalog ?? []).length > 1}
            <h2
              class="mb-2 text-sm font-semibold text-slate-700 dark:text-neutral-300"
            >
              {repo.preview.name ?? repo.repository.name}
            </h2>
          {/if}
          <ul class="space-y-2">
            {#each repo.preview.plugins as plugin (plugin.id)}
              {@const k = key(repo, plugin.id)}
              <li>
                <label
                  class="flex cursor-pointer gap-3 rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-[#1b1d1e] dark:shadow-black/30"
                  class:opacity-60={plugin.installed}
                >
                  <input
                    type="checkbox"
                    class="mt-1 h-4 w-4 shrink-0 accent-[#BB7FB5]"
                    checked={plugin.installed || !!selected[k]}
                    disabled={plugin.installed || busy}
                    onchange={(e) => toggle(k, e.currentTarget.checked)}
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-baseline gap-x-2">
                      <span
                        class="font-medium text-slate-900 dark:text-neutral-100"
                        >{plugin.name}</span
                      >
                      <span class="text-xs text-slate-400 dark:text-neutral-500"
                        >v{plugin.version}</span
                      >
                      {#if plugin.installed}
                        <span
                          class="text-xs text-slate-500 dark:text-neutral-400"
                          >Installed</span
                        >
                      {/if}
                    </div>
                    {#if plugin.description}
                      <p
                        class="mt-1 text-sm text-slate-600 dark:text-neutral-400"
                      >
                        {plugin.description}
                      </p>
                    {/if}
                    {#if plugin.scopes.length > 0}
                      <div class="mt-2 flex flex-wrap gap-1">
                        <span
                          class="text-xs text-slate-400 dark:text-neutral-500"
                          >Requests:</span
                        >
                        {#each plugin.scopes as scope (scope)}
                          <span
                            class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
                            >{scope}</span
                          >
                        {/each}
                      </div>
                    {/if}
                  </div>
                </label>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    {#if hasResult && (failed.length > 0 || installed.length > 0)}
      <div
        class="mt-6 rounded-lg border border-slate-200 p-4 dark:border-neutral-700"
      >
        {#if installed.length > 0}
          <p class="text-sm text-slate-700 dark:text-neutral-300">
            Installed: {installed.map((p) => p.id).join(", ")}
          </p>
        {/if}
        {#if failed.length > 0}
          <p
            class="text-sm font-medium text-red-700 dark:text-red-300"
            class:mt-2={installed.length > 0}
          >
            Some plugins failed to install
          </p>
          <ul class="mt-1 space-y-1">
            {#each failed as f (f.id)}
              <li class="text-sm text-red-600 dark:text-red-400">
                <span class="font-medium">{f.id}</span>: {f.error}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <div class="mt-8 flex flex-wrap items-center justify-end gap-2">
      {#if hasResult && failed.length > 0}
        <button
          type="button"
          class={secondaryClass}
          disabled={busy}
          onclick={finish}
        >
          {finishing ? "Continuing..." : "Continue anyway"}
        </button>
        <button
          type="button"
          class={primaryClass}
          disabled={busy || selectedCount === 0}
          onclick={install}
        >
          {installing ? "Installing..." : "Retry failed"}
        </button>
      {:else}
        <button
          type="button"
          class={secondaryClass}
          disabled={busy}
          onclick={skip}
        >
          {skipping ? "Skipping..." : "Skip for now"}
        </button>
        <button
          type="button"
          class={primaryClass}
          disabled={busy || selectedCount === 0}
          onclick={install}
        >
          {installing
            ? "Installing..."
            : selectedCount === 0
              ? "Install selected"
              : `Install ${selectedCount} selected`}
        </button>
      {/if}
    </div>
  {/if}
  {#if actionError}
    <p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">
      {actionError}
    </p>
  {/if}
</div>
