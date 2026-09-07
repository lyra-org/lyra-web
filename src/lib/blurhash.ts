// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { decodeBlurHash } from "fast-blurhash";

const cache = new Map<string, ImageData>();

export function decodeBlurhash(
  hash: string,
  width = 32,
  height = 32,
): ImageData {
  const key = `${hash}:${width}x${height}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const pixels = decodeBlurHash(hash, width, height);
  const imageData = new ImageData(width, height);
  imageData.data.set(pixels);
  cache.set(key, imageData);
  return imageData;
}
