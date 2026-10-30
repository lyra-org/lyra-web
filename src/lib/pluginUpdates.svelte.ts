// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  PluginEffect,
  PluginHold,
  PluginManifestResponse,
  PluginSourceResponse,
  PreviewedPlugin,
  ScopeGainResponse,
  UpdatePluginsResponse,
} from "./types";
import { fetchPlugins } from "./api";
import { getAuth } from "./auth.svelte.ts";

// The server checks subscriptions daily and installs updates on its own, but
// holds those that need an admin. This counts the held updates for the badge
// on the settings button.

let awaitingApproval = $state(0);
let request = 0;

export function isAwaitingApproval(plugin: PluginManifestResponse): boolean {
  return (
    plugin.source.kind === "repository" &&
    plugin.source.status === "update_available" &&
    plugin.source.hold != null
  );
}

// The release an update request names for `plugin`, when one is on offer.
export function offeredRelease(plugin: {
  id: string;
  source?: PluginSourceResponse;
}): PreviewedPlugin | null {
  if (plugin.source?.kind !== "repository") return null;
  if (plugin.source.status !== "update_available") return null;
  const offered = plugin.source.offered;
  return offered ? { id: plugin.id, commit: offered.commit } : null;
}

function track(plugins: PluginManifestResponse[]) {
  request += 1;
  awaitingApproval = plugins.filter(isAwaitingApproval).length;
}

async function load() {
  if (!getAuth().hasPermission("manage_plugins")) return;
  const current = ++request;
  try {
    const plugins = await fetchPlugins();
    if (current === request) track(plugins);
  } catch {
    // The badge is a hint; the plugin page reports load errors.
  }
}

function clear() {
  request += 1;
  awaitingApproval = 0;
}

export function getPluginUpdates() {
  return {
    get awaitingApproval() {
      return awaitingApproval;
    },
    load,
    track,
    clear,
  };
}

const effectText: Record<PluginEffect["kind"], (data: string) => string> = {
  egress: () => "send data off the server",
  exposes: () => "add endpoints to the server",
  authority: () => "handle credentials and sign-ins",
  reads_personal: (data) => `read users’ ${data}`,
  writes_personal: (data) => `change users’ ${data}`,
  writes_library: (data) => `change the library’s ${data}`,
};

export function describeEffect(effect: PluginEffect): string {
  return effectText[effect.kind](effect.data ?? "data");
}

export function describeGain(gain: ScopeGainResponse): string {
  const reached = [...gain.scopes, ...gain.unresolved_dependencies];
  const risk = gain.risk === "standard" ? "" : ` (${gain.risk} risk)`;
  return `${gain.plugin} would newly reach ${reached.join(", ")}${risk}`;
}

// Why the update to `version` waits. Only `adds_scopes` can be approved.
export function describeHold(hold: PluginHold, version: string): string {
  switch (hold.reason) {
    case "adds_scopes":
      return `v${version} needs approval because it widens what plugins can do.`;
    case "breaks_dependents":
      return `v${version} is held: ${hold.dependents
        .map((d) => `${d.id} requires ${d.requires}`)
        .join(", ")}.`;
    case "unmet_dependencies":
      return `v${version} is held: it requires ${hold.dependencies
        .map((d) => `${d.id} ${d.requires}`)
        .join(", ")}, which would be missing or at another version.`;
    case "dependency_cycle":
      return `v${version} is held: it would leave ${hold.plugins.join(", ")} depending on each other.`;
  }
}

// Summarises an update request, throwing when any plugin failed or cannot run
// on this server.
export function updateOutcome(result: UpdatePluginsResponse): string {
  const count = result.updated.length;
  let summary = `Updated ${count} plugin${count === 1 ? "" : "s"}.`;
  for (const held of result.held) {
    summary += ` ${held.id}: ${describeHold(held.hold, held.release.version)}`;
  }
  const problems = [
    ...result.failed.map((f) => `${f.id}: ${f.error}`),
    ...result.incompatible.map((i) => `${i.id} requires Lyra ${i.requires}.`),
  ];
  if (problems.length > 0) throw new Error(`${summary} ${problems.join(" ")}`);
  return summary;
}
