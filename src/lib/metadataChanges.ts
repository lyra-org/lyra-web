// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { ApiError, previewMetadataChanges } from "./api";
import type { MetadataChange, MetadataChangePreview } from "./types";

function expectedOf(preview: MetadataChangePreview): unknown {
  switch (preview.action) {
    case "edit_metadata":
      return preview.diff;
    case "set_external_id":
    case "inherit_external_id":
      return preview.current;
    case "merge":
      return preview.manual_fills;
    case "remove_external_id_alias":
      return undefined;
  }
}

// The set as applying takes it: each change with what its preview reported.
export function withExpected(
  changes: MetadataChange[],
  previews: MetadataChangePreview[],
): MetadataChange[] {
  return changes.map((change, i) => {
    const expected = expectedOf(previews[i]);
    return (
      expected === undefined ? change : { ...change, expected }
    ) as MetadataChange;
  });
}

function withCurrent(
  preview: MetadataChangePreview,
  current: unknown,
): MetadataChangePreview {
  switch (preview.action) {
    case "edit_metadata":
      return { ...preview, diff: current as typeof preview.diff };
    case "set_external_id":
      return { ...preview, current: current as typeof preview.current };
    case "inherit_external_id":
      return { ...preview, current: current as typeof preview.current };
    case "merge":
      return {
        ...preview,
        manual_fills: current as typeof preview.manual_fills,
      };
    case "remove_external_id_alias":
      return preview;
  }
}

// The previews to review again after an apply failed on a stale `expected`, or
// null for any other failure. A preview reads each change against the data as
// it stands, so it can't report what an earlier change of the set left behind,
// such as an edit taking a key a merge would have filled. Only the failure's
// `current` knows that.
export async function staleReview(
  changes: MetadataChange[],
  err: unknown,
): Promise<MetadataChangePreview[] | null> {
  if (!(err instanceof ApiError)) return null;
  const failure = err.body as
    | { code?: string; index?: number; current?: unknown }
    | undefined;
  if (failure?.code !== "metadata_change_stale" || failure.index == null) {
    return null;
  }
  const previews = await previewMetadataChanges(changes);
  previews[failure.index] = withCurrent(
    previews[failure.index],
    failure.current,
  );
  return previews;
}
