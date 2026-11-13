// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { PluginEffect, PluginHost } from "./types";

// Names one host entry as seen from `plugin`. A `setting` entry without its
// own `plugin` is `owner`'s setting.
function describeHost(host: PluginHost, plugin: string, owner: string): string {
  switch (host.kind) {
    case "host":
      return host.host;
    case "subdomains":
      return `subdomains of ${host.host}`;
    case "setting": {
      const whose = host.plugin ?? owner;
      return whose === plugin
        ? `the host in its ${host.setting} setting`
        : `the host in ${whose}'s ${host.setting} setting`;
    }
    case "any":
      return "any host";
  }
}

// Lists hosts for a sentence, or "any host" when one entry is every host.
export function describeHosts(
  hosts: { host: PluginHost; owner: string }[],
  plugin: string,
): string {
  if (hosts.some(({ host }) => host.kind === "any")) return "any host";
  const names = [
    ...new Set(
      hosts.map(({ host, owner }) => describeHost(host, plugin, owner)),
    ),
  ];
  return names.join(", ");
}

// Where an egress effect can send data, when every scope giving it limits the
// hosts. `null` when one doesn't or one reaches any host, as the effect's own
// description already says that.
export function egressHosts(
  effect: PluginEffect,
  plugin: string,
): string | null {
  if (effect.kind !== "egress") return null;
  if (effect.via.some((source) => source.hosts == null)) return null;
  const hosts = effect.via.flatMap((source) =>
    (source.hosts ?? []).map((host) => ({ host, owner: source.plugin })),
  );
  if (hosts.length === 0) return "Lists no hosts to send to.";
  const described = describeHosts(hosts, plugin);
  return described === "any host" ? null : `Only to ${described}.`;
}
