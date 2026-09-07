// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { TrackResponse } from "./types";
import type { PlaybackContext } from "./player.svelte.ts";
import {
  fetchArtistMix,
  fetchGenreMix,
  fetchMeMix,
  fetchPlaylistMix,
  fetchReleaseMix,
  fetchTrackMix,
} from "./api";

export type AppRoute =
  | { page: "login" }
  | { page: "libraries" }
  | { page: "library"; id: string }
  | { page: "library_artists"; id: string }
  | { page: "library_tracks"; id: string }
  | { page: "library_genres"; id: string }
  | { page: "track"; id: string }
  | { page: "album"; id: string }
  | { page: "artist"; id: string }
  | { page: "genre"; id: string }
  | { page: "playlists" }
  | { page: "playlist"; id: string }
  | { page: "now_playing" };

export type HeaderMixConfig = {
  label: string;
  title: string;
  load: () => Promise<TrackResponse[]>;
  startTrack?: TrackResponse;
  cover?: { url: string | null; blurhash: string | null };
};

export function headerMixForRoute(
  route: AppRoute,
  currentTrack: TrackResponse | null,
  playbackContext: PlaybackContext | null,
): HeaderMixConfig | null {
  switch (route.page) {
    case "login":
    case "library_artists":
    case "library_genres":
    case "playlists":
      return null;
    case "libraries":
    case "library":
    case "library_tracks":
      return {
        label: "Mix from recent",
        title: "Mix from recent listens",
        load: () => fetchMeMix(),
      };
    case "album":
      return {
        label: "Mix album",
        title: "Album mix",
        load: () => fetchReleaseMix(route.id),
      };
    case "artist":
      return {
        label: "Mix artist",
        title: "Artist mix",
        load: () => fetchArtistMix(route.id),
      };
    case "genre":
      return {
        label: "Mix genre",
        title: "Genre mix",
        load: () => fetchGenreMix(route.id),
      };
    case "playlist":
      return {
        label: "Mix playlist",
        title: "Playlist mix",
        load: () => fetchPlaylistMix(route.id),
      };
    case "track":
      return {
        label: "Mix from track",
        title: "Similar tracks",
        load: () => fetchTrackMix(route.id, { instant: true }),
      };
    case "now_playing":
      if (!currentTrack?.id) return null;
      return {
        label: "Mix from track",
        title: playbackContext?.title
          ? `Similar to ${playbackContext.title}`
          : "Similar tracks",
        load: () => fetchTrackMix(currentTrack.id!, { instant: true }),
        startTrack: currentTrack,
        cover: {
          url: playbackContext?.coverUrl ?? null,
          blurhash: playbackContext?.coverBlurhash ?? null,
        },
      };
    default:
      return null;
  }
}
