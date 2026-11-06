// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type {
  ArtistRelationType,
  ArtistType,
  CreditType,
  MetadataCreditValue,
  MetadataEntityType,
  MetadataFieldName,
  MetadataLabelValue,
  MetadataRelationValue,
  ReleaseType,
} from "./types";

export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "release_type"
  | "artist_type"
  | "genres"
  | "labels"
  | "credits"
  | "relations";

export const KINDS: Record<MetadataFieldName, FieldKind> = {
  release_title: "text",
  track_title: "text",
  artist_name: "text",
  sort_title: "text",
  sort_name: "text",
  description: "textarea",
  release_type: "release_type",
  artist_type: "artist_type",
  release_date: "date",
  year: "number",
  disc: "number",
  disc_total: "number",
  track: "number",
  track_total: "number",
  genres: "genres",
  labels: "labels",
  credits: "credits",
  relations: "relations",
};

export const NAMES: Record<MetadataFieldName, string> = {
  release_title: "Title",
  track_title: "Title",
  artist_name: "Name",
  sort_title: "Sort title",
  sort_name: "Sort name",
  description: "Description",
  release_type: "Type",
  artist_type: "Type",
  release_date: "Release date",
  year: "Year",
  disc: "Disc",
  disc_total: "Disc total",
  track: "Track",
  track_total: "Track total",
  genres: "Genres",
  labels: "Labels",
  credits: "Credits",
  relations: "Related artists",
};

// Fields that must keep a value.
export const REQUIRED: MetadataFieldName[] = [
  "release_title",
  "track_title",
  "artist_name",
];

export const ORDER: Record<MetadataEntityType, MetadataFieldName[]> = {
  release: [
    "release_title",
    "sort_title",
    "release_type",
    "release_date",
    "description",
    "genres",
    "labels",
    "credits",
  ],
  track: [
    "track_title",
    "sort_title",
    "year",
    "disc",
    "disc_total",
    "track",
    "track_total",
    "credits",
  ],
  artist: [
    "artist_name",
    "sort_name",
    "artist_type",
    "description",
    "relations",
  ],
};

export const RELEASE_TYPES: [ReleaseType, string][] = [
  ["album", "Album"],
  ["single", "Single"],
  ["ep", "EP"],
  ["compilation", "Compilation"],
  ["soundtrack", "Soundtrack"],
  ["live", "Live"],
  ["remix", "Remix"],
  ["broadcast", "Broadcast"],
  ["other", "Other"],
  ["unknown", "Unknown"],
];

export const ARTIST_TYPES: [ArtistType, string][] = [
  ["person", "Person"],
  ["group", "Group"],
  ["character", "Character"],
  ["orchestra", "Orchestra"],
  ["choir", "Choir"],
];

export const CREDIT_TYPES: [CreditType, string][] = [
  ["artist", "Artist"],
  ["vocalist", "Vocalist"],
  ["instrumentalist", "Instrumentalist"],
  ["composer", "Composer"],
  ["lyricist", "Lyricist"],
  ["arranger", "Arranger"],
  ["writer", "Writer"],
  ["producer", "Producer"],
  ["conductor", "Conductor"],
  ["engineer", "Engineer"],
  ["mixer", "Mixer"],
  ["remixer", "Remixer"],
];

// Relations point into the edited artist, so each names the related artist's
// role toward it.
export const RELATION_TYPES: [ArtistRelationType, string][] = [
  ["member_of", "Member"],
  ["voice_actor", "Voice actor"],
];

export function optionLabel<T extends string>(
  options: [T, string][],
  value: unknown,
): string {
  return options.find(([v]) => v === value)?.[1] ?? String(value);
}

type ArtistName = (id: string) => string;

// A readable form of a field value, one line per entry.
export function describeField(
  field: MetadataFieldName,
  value: unknown,
  artistName: ArtistName,
): string[] {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return [];
  }
  switch (KINDS[field]) {
    case "release_type":
      return [optionLabel(RELEASE_TYPES, value)];
    case "artist_type":
      return [optionLabel(ARTIST_TYPES, value)];
    case "genres":
      return [(value as string[]).join(", ")];
    case "labels":
      return (value as MetadataLabelValue[]).map((l) =>
        l.catalog_number ? `${l.name} · ${l.catalog_number}` : l.name,
      );
    case "credits":
      return (value as MetadataCreditValue[]).map(
        (c) =>
          `${artistName(c.artist_id)} · ${optionLabel(CREDIT_TYPES, c.type)}${c.detail ? ` (${c.detail})` : ""}`,
      );
    case "relations":
      return (value as MetadataRelationValue[]).map(
        (r) =>
          `${artistName(r.artist_id)} · ${optionLabel(RELATION_TYPES, r.type)}${r.attributes ? ` (${r.attributes})` : ""}`,
      );
    default:
      return [String(value)];
  }
}
