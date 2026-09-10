// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  RepositoryWithPreviewResponse,
  ServerInfoResponse,
} from "./types";
import {
  fetchMe,
  fetchPluginRepositories,
  fetchServerInfo,
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

let catalog = $state<RepositoryWithPreviewResponse[] | null>(null);
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
    const { repositories } = await fetchPluginRepositories();
    catalog = await Promise.all(
      repositories.map((repo) => refreshPluginRepository(repo.id)),
    );
  } catch (e) {
    catalogError =
      e instanceof Error ? e.message : "Failed to load plugin catalog";
  } finally {
    catalogLoading = false;
  }
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
    clearSession: clearServerScopedState,
    reset,
  };
}
