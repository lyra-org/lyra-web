// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  CatalogRepository,
  CatalogStatus,
  PluginPreviewResponse,
  ServerInfoResponse,
} from "./types";
import {
  fetchMe,
  fetchPluginRepositories,
  fetchServerInfo,
  refreshPluginRepositories,
  refreshPluginRepository,
} from "./api";
import { getAuth } from "./auth.svelte.ts";

// Server discovery and first-run setup state. Everything here is keyed to the
// server identity reported by `/api/server/public`; when a different server
// answers, the previous server's setup and catalog state is discarded.

let info = $state<ServerInfoResponse | null>(null);
let infoLoading = $state(false);
let infoError = $state<string | null>(null);

let meLoading = $state(false);
let meError = $state<string | null>(null);
let meLoadedFor = $state<string | null>(null);
let meRequestedFor = $state<string | null>(null);
let meRequest = 0;

let catalog = $state<CatalogRepository[] | null>(null);
let catalogLoading = $state(false);
let catalogError = $state<string | null>(null);

function clearServerScopedState() {
  meRequest += 1;
  meLoading = false;
  meRequestedFor = null;
  catalog = null;
  catalogError = null;
  meLoadedFor = null;
  meError = null;
  getAuth().setMe(null);
}

async function refresh(): Promise<ServerInfoResponse | null> {
  infoLoading = true;
  infoError = null;
  try {
    const next = await fetchServerInfo();
    if (info != null && info.server_id !== next.server_id) {
      clearServerScopedState();
    }
    info = next;
    return next;
  } catch (e) {
    infoError = e instanceof Error ? e.message : "Failed to reach server";
    return null;
  } finally {
    infoLoading = false;
  }
}

async function loadMe(): Promise<void> {
  const auth = getAuth();
  const token = auth.token;
  if (token == null) return;
  const request = ++meRequest;
  meRequestedFor = token;
  meLoading = true;
  meError = null;
  try {
    const me = await fetchMe();
    if (request !== meRequest || auth.token !== token) return;
    auth.setMe(me);
    meLoadedFor = token;
  } catch (e) {
    if (request !== meRequest || auth.token !== token) return;
    meError = e instanceof Error ? e.message : "Failed to load account";
  } finally {
    if (request === meRequest) meLoading = false;
  }
}

async function loadCatalog(): Promise<void> {
  catalogLoading = true;
  catalogError = null;
  try {
    const repositories = await fetchPluginRepositories({ inc: ["plugins"] });
    // A subscription never refreshed, such as the official catalog on
    // first-run setup, has stored no plugins yet. One stored before the
    // server kept the listing lacks `resolved_ref` and the plugin names until
    // it is refreshed again.
    catalog = await Promise.all(
      repositories.map((repo) =>
        repo.refreshed_at == null || repo.resolved_ref == null
          ? refreshPluginRepository(repo.id)
          : { ...repo, plugins: repo.plugins ?? [] },
      ),
    );
  } catch (e) {
    catalogError =
      e instanceof Error ? e.message : "Failed to load plugin catalog";
  } finally {
    catalogLoading = false;
  }
}

// Refreshes every subscription in one request and returns the ones that
// failed, which keep the plugins they offered before.
async function refreshCatalog(): Promise<{ name: string; error: string }[]> {
  catalogLoading = true;
  catalogError = null;
  try {
    const result = await refreshPluginRepositories();
    catalog = result.repositories;
    return result.failed.map(({ id, error }) => ({
      name: result.repositories.find((repo) => repo.id === id)?.name ?? id,
      error,
    }));
  } catch (e) {
    catalogError =
      e instanceof Error ? e.message : "Failed to refresh plugin catalog";
    return [];
  } finally {
    catalogLoading = false;
  }
}

// Catalog statuses reflect what is installed, so callers that install outside
// the plugin management page drop the catalog for its next visit to reload.
function invalidateCatalog() {
  catalog = null;
  catalogError = null;
}

// The server derives a catalog status from whether a plugin with that id is
// installed, so an install or uninstall changes it in every repository that
// lists the plugin. Callers apply the change here instead of refreshing every
// repository.
function setCatalogStatus(pluginId: string, status: CatalogStatus) {
  if (catalog == null) return;
  catalog = catalog.map((repo) => ({
    ...repo,
    plugins: repo.plugins.map((plugin) =>
      plugin.id === pluginId ? withStatus(plugin, status) : plugin,
    ),
  }));
}

function withStatus(
  plugin: PluginPreviewResponse,
  status: CatalogStatus,
): PluginPreviewResponse {
  // Drop the fields of the previous status, such as `requires` or `reason`.
  const {
    status: _status,
    requires: _requires,
    reason: _reason,
    ...preview
  } = plugin as PluginPreviewResponse & { requires?: string; reason?: string };
  return { ...preview, ...status };
}

function reset() {
  info = null;
  infoError = null;
  clearServerScopedState();
}

export function getSetup() {
  return {
    get info() {
      return info;
    },
    get infoLoading() {
      return infoLoading;
    },
    get infoError() {
      return infoError;
    },
    get accountRequired() {
      return info?.setup.account_required ?? false;
    },
    get pluginSelectionRequired() {
      return info?.setup.plugin_selection_required ?? false;
    },
    get meLoading() {
      return meLoading;
    },
    get meError() {
      return meError;
    },
    get meLoadedFor() {
      return meLoadedFor;
    },
    get meRequestedFor() {
      return meRequestedFor;
    },
    get catalog() {
      return catalog;
    },
    get catalogLoading() {
      return catalogLoading;
    },
    get catalogError() {
      return catalogError;
    },
    refresh,
    loadMe,
    loadCatalog,
    refreshCatalog,
    invalidateCatalog,
    setCatalogStatus,
    clearSession: clearServerScopedState,
    reset,
  };
}
