// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

const GENRE_GRADIENTS = [
  "from-[#E6CEE3]/60 to-slate-200 dark:from-[#BB7FB5]/25 dark:to-neutral-700",
  "from-slate-200 to-[#E6CEE3]/50 dark:from-neutral-700 dark:to-[#BB7FB5]/20",
  "from-[#d4b5cf]/40 to-slate-100 dark:from-[#cfa2c9]/20 dark:to-neutral-800",
  "from-slate-100 to-[#E6CEE3]/40 dark:from-neutral-800 dark:to-[#BB7FB5]/15",
  "from-[#E6CEE3]/30 to-[#d4b5cf]/30 dark:from-[#BB7FB5]/20 dark:to-neutral-700",
  "from-neutral-200 to-[#E6CEE3]/45 dark:from-neutral-700 dark:to-[#cfa2c9]/15",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function genreGradient(seed: string): string {
  return GENRE_GRADIENTS[hashString(seed) % GENRE_GRADIENTS.length];
}

const COVER_OBJECT_POSITIONS = [
  "object-center",
  "object-top",
  "object-bottom",
  "object-left",
  "object-right",
  "[object-position:30%_20%]",
  "[object-position:70%_20%]",
  "[object-position:30%_80%]",
  "[object-position:70%_80%]",
] as const;

export function pickGenreHeroAlbum<
  T extends {
    cover?: { url?: string | null; blurhash?: string | null } | null;
  },
>(albums: T[], seed: string): T | null {
  const withCover = albums.filter((album) => album.cover?.blurhash);
  if (withCover.length === 0) return null;
  return withCover[hashString(seed) % withCover.length];
}

export function genreCoverObjectPosition(seed: string): string {
  return COVER_OBJECT_POSITIONS[
    hashString(`${seed}:cover`) % COVER_OBJECT_POSITIONS.length
  ];
}
