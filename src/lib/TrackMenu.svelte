<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  import type { TrackResponse } from "./types";
  import type { PlaybackContext } from "./player.svelte.ts";
  import type { MenuAnchor } from "./ContextMenu.svelte";

  export interface TrackMenuTarget {
    track: TrackResponse;
    anchor: MenuAnchor;
    // What "Add to queue" plays the track as part of. Defaults to the track
    // alone.
    context?: PlaybackContext;
  }

  function soloContext(track: TrackResponse): PlaybackContext {
    const release = track.releases?.[0];
    const artists =
      track.artists?.filter((a) => !a.credit || a.credit.type === "artist") ??
      [];
    return {
      tracks: [track],
      title: track.title,
      coverUrl: release?.cover?.url ?? null,
      coverBlurhash: release?.cover?.blurhash ?? null,
      trackArtistNames:
        artists.length > 0
          ? { [track.id]: artists.map((a) => a.name).join(", ") }
          : {},
    };
  }
</script>

<script lang="ts">
  import ContextMenu from "./ContextMenu.svelte";
  import LyricsModal from "./LyricsModal.svelte";
  import MetadataEditModal from "./MetadataEditModal.svelte";
  import PathMixModal from "./PathMixModal.svelte";
  import PurgeMissingModal from "./PurgeMissingModal.svelte";
  import RefreshOptionsModal from "./RefreshOptionsModal.svelte";
  import RemapTrackModal from "./RemapTrackModal.svelte";
  import TrackFilesModal from "./TrackFilesModal.svelte";
  import { refreshEntity, waitForSyncRun } from "./api";
  import TrackMenuItems from "./TrackMenuItems.svelte";

  // One instance serves a whole list; the target says which track and where.
  interface Props {
    target: TrackMenuTarget | null;
    // The library the list shows; a track can be purged only from within one.
    libraryId?: string;
    onclose: () => void;
    // A remap or purge changed the list.
    onchanged?: () => void;
    // A refresh or edit changed what the track shows.
    onedited?: () => void;
    onlyricschanged?: () => void;
  }

  let {
    target,
    libraryId,
    onclose,
    onchanged,
    onedited,
    onlyricschanged,
  }: Props = $props();

  // Outlives the menu, which closes when the modal opens.
  let editTrack = $state<TrackResponse | null>(null);
  let lyricsTrack = $state<TrackResponse | null>(null);
  let optionsTrack = $state<TrackResponse | null>(null);
  let pathTrack = $state<TrackResponse | null>(null);
  let remappingTrack = $state<TrackResponse | null>(null);
  let filesTrack = $state<TrackResponse | null>(null);
  let purgingTrack = $state<TrackResponse | null>(null);
  let refreshingIds = $state<string[]>([]);

  export function isRefreshing(id: string): boolean {
    return refreshingIds.includes(id);
  }

  async function refresh(id: string) {
    refreshingIds.push(id);
    try {
      await refreshEntity(id);
      onedited?.();
    } catch {
      // A failed refresh leaves the track as it was; nothing to update.
    } finally {
      refreshingIds = refreshingIds.filter((other) => other !== id);
    }
  }
</script>

{#if target}
  {@const { track, anchor, context } = target}
  {#key target}
    <ContextMenu {anchor} {onclose} minWidth="wide">
      <TrackMenuItems
        {track}
        context={context ?? soloContext(track)}
        {onclose}
        onedit={() => {
          editTrack = track;
          onclose();
        }}
        onlyrics={() => {
          lyricsTrack = track;
          onclose();
        }}
        onrefresh={() => {
          refresh(track.id);
          onclose();
        }}
        onrefreshoptions={() => {
          optionsTrack = track;
          onclose();
        }}
        onpath={() => {
          pathTrack = track;
          onclose();
        }}
        onfiles={() => {
          filesTrack = track;
          onclose();
        }}
        onremap={() => {
          remappingTrack = track;
          onclose();
        }}
        onpurge={libraryId != null
          ? () => {
              purgingTrack = track;
              onclose();
            }
          : undefined}
      />
    </ContextMenu>
  {/key}
{/if}

{#if editTrack}
  <MetadataEditModal
    entityId={editTrack.id}
    onchanged={onedited}
    onclose={() => (editTrack = null)}
  />
{/if}

{#if lyricsTrack}
  <LyricsModal
    trackId={lyricsTrack.id}
    title={lyricsTrack.title}
    onchanged={onlyricschanged}
    onclose={() => (lyricsTrack = null)}
  />
{/if}

{#if pathTrack}
  <PathMixModal from={pathTrack} onclose={() => (pathTrack = null)} />
{/if}

{#if filesTrack}
  <TrackFilesModal track={filesTrack} onclose={() => (filesTrack = null)} />
{/if}

{#if remappingTrack}
  <RemapTrackModal
    track={remappingTrack}
    onremapped={() => onchanged?.()}
    onclose={() => (remappingTrack = null)}
  />
{/if}

{#if purgingTrack && libraryId != null}
  <PurgeMissingModal
    {libraryId}
    track={purgingTrack}
    onstarted={async ({ run }) => {
      if (run.run.id != null) await waitForSyncRun(run.run.id);
      onchanged?.();
    }}
    onclose={() => (purgingTrack = null)}
  />
{/if}

{#if optionsTrack}
  <RefreshOptionsModal
    entityId={optionsTrack.id}
    onrefreshed={onedited}
    onclose={() => (optionsTrack = null)}
  />
{/if}
