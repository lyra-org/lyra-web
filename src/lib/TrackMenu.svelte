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
  import ExternalIdsModal from "./ExternalIdsModal.svelte";
  import TrackMenuItems from "./TrackMenuItems.svelte";

  // One instance serves a whole list; the target says which track and where.
  interface Props {
    target: TrackMenuTarget | null;
    onclose: () => void;
  }

  let { target, onclose }: Props = $props();

  // Outlives the menu, which closes when the modal opens.
  let idsTrack = $state<TrackResponse | null>(null);
</script>

{#if target}
  {@const { track, anchor, context } = target}
  {#key target}
    <ContextMenu {anchor} {onclose} minWidth="wide">
      <TrackMenuItems
        {track}
        context={context ?? soloContext(track)}
        {onclose}
        onexternalids={() => {
          idsTrack = track;
          onclose();
        }}
      />
    </ContextMenu>
  {/key}
{/if}

{#if idsTrack}
  <ExternalIdsModal
    entityId={idsTrack.id}
    noun="track"
    onclose={() => (idsTrack = null)}
  />
{/if}
