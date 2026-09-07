// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { TrackResponse } from "./types";
import type { PlaybackContext } from "./player.svelte.ts";
import { getPlayer } from "./player.svelte.ts";

function coverFromTracks(tracks: TrackResponse[]): {
  url: string | null;
  blurhash: string | null;
} {
  for (const track of tracks) {
    const cover = track.releases?.[0]?.cover;
    if (cover) {
      return { url: cover.url, blurhash: cover.blurhash ?? null };
    }
  }
  return { url: null, blurhash: null };
}

function trackArtistNamesFrom(tracks: TrackResponse[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const track of tracks) {
    if (!track.id) continue;
    const artists =
      track.artists?.filter((a) => a.credit?.type === "artist") ??
      track.artists ??
      [];
    if (artists.length > 0) {
      names[track.id] = artists.map((a) => a.name).join(", ");
    }
  }
  return names;
}

export function playbackContextFromMixTracks(
  tracks: TrackResponse[],
  title: string,
  cover?: { url: string | null; blurhash: string | null },
): PlaybackContext {
  const resolvedCover = cover ?? coverFromTracks(tracks);
  return {
    tracks,
    title,
    coverUrl: resolvedCover.url,
    coverBlurhash: resolvedCover.blurhash,
    trackArtistNames: trackArtistNamesFrom(tracks),
  };
}

export async function playMixFromTracks(
  tracks: TrackResponse[],
  title: string,
  startTrack?: TrackResponse,
  cover?: { url: string | null; blurhash: string | null },
): Promise<void> {
  if (tracks.length === 0) return;
  const player = getPlayer();
  const context = playbackContextFromMixTracks(tracks, title, cover);
  const track = startTrack ?? tracks[0];
  await player.playTrack(track, context);
}
