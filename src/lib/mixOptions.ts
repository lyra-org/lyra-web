// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  MixerResponse,
  MixRequest,
  OptionValue,
  TrackResponse,
} from "./types";
import { fetchMix, fetchMixers } from "./api";
import { getAuth } from "./auth.svelte.ts";
import { optionTakes } from "./OptionField.svelte";

// Option values keyed `<mixer_id>.<name>`, as a mix request takes them.
export type MixOptionValues = Record<string, OptionValue>;

const STORAGE_PREFIX = "lyra-mix-options";

let mixers: MixerResponse[] | null = null;

export function mixOptionKey(mixerId: string, name: string): string {
  return `${mixerId}.${name}`;
}

function storageKey(): string {
  return `${STORAGE_PREFIX}:${getAuth().me?.id ?? ""}`;
}

/** The mix options saved for the current user in this browser. */
export function readMixOptions(): MixOptionValues {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey()) ?? "null",
    );
    if (stored == null || typeof stored !== "object") return {};
    return Object.fromEntries(
      Object.entries(stored).filter(([, value]) =>
        ["boolean", "number", "string"].includes(typeof value),
      ),
    );
  } catch {
    // Unreadable or unavailable storage leaves every option at its default.
    return {};
  }
}

export function writeMixOptions(values: MixOptionValues) {
  try {
    if (Object.keys(values).length === 0) {
      localStorage.removeItem(storageKey());
    } else {
      localStorage.setItem(storageKey(), JSON.stringify(values));
    }
  } catch {
    // The choice still applies for this visit when storage is unavailable.
  }
}

/** Lists the mixers and keeps the listing that mixes check saved options against. */
export async function loadMixers(): Promise<MixerResponse[]> {
  mixers = (await fetchMixers()).mixers;
  return mixers;
}

// A value the server rejects fails the whole mix, even one for a mixer that
// wouldn't serve it, so only values an enabled mixer currently takes are sent.
async function mixRequestOptions(): Promise<MixOptionValues> {
  if (mixers == null) {
    try {
      await loadMixers();
    } catch {
      return {};
    }
  }
  const saved = readMixOptions();
  const options: MixOptionValues = {};
  for (const mixer of mixers ?? []) {
    if (!mixer.enabled) continue;
    for (const option of mixer.options) {
      const key = mixOptionKey(mixer.mixer_id, option.name);
      const value = saved[key];
      if (option.available && optionTakes(option, value)) {
        options[key] = value;
      }
    }
  }
  return options;
}

// The mixes beyond a plain blend that an enabled mixer serves. The server
// rejects a request no mixer takes, so these gate their UI.
export interface MixSupport {
  path: boolean;
  query: boolean;
}

export async function mixSupport(): Promise<MixSupport> {
  const enabled = (mixers ?? (await loadMixers())).filter((m) => m.enabled);
  return {
    path: enabled.some((m) => m.path?.seeds.includes("track")),
    query: enabled.some((m) => m.blend?.query),
  };
}

/** Requests a mix with the user's saved mixer options. */
export async function mix(request: MixRequest): Promise<TrackResponse[]> {
  return fetchMix({ ...request, options: await mixRequestOptions() });
}
