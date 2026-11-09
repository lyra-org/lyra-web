// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { PluginPreviewResponse } from "./types";

// A repository origin without the parts people don't need to read.
export function shortOrigin(origin: string): string {
  return origin
    .replace(/^https?:\/\//, "")
    .replace(/\?.*$/, "")
    .replace(/\.git$/, "");
}

// Where a plugin's code comes from: the repository offering it, unless that
// repository's index points elsewhere.
export function pluginOrigin(
  repositoryOrigin: string,
  plugin: PluginPreviewResponse,
): string {
  return plugin.source?.origin ?? repositoryOrigin;
}
