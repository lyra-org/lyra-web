import type { PlaybackUrlOptions } from "./api";

// Source `container/codec` pairs, named as the server names them, and the media
// type that asks the browser whether it decodes each one.
const COPY_PROFILE_TYPES: [string, string][] = [
  ["mp3/mp3", "audio/mpeg"],
  ["flac/flac", "audio/flac"],
  ["ogg/flac", 'audio/ogg; codecs="flac"'],
  ["ogg/opus", 'audio/ogg; codecs="opus"'],
  ["ogg/vorbis", 'audio/ogg; codecs="vorbis"'],
  ["m4a/aac", 'audio/mp4; codecs="mp4a.40.2"'],
  ["m4a/alac", 'audio/mp4; codecs="alac"'],
  ["m4a/flac", 'audio/mp4; codecs="flac"'],
  ["m4a/opus", 'audio/mp4; codecs="opus"'],
  ["aac/aac", "audio/aac"],
  ["wav/pcm_u8", 'audio/wav; codecs="1"'],
  ["wav/pcm_s16le", 'audio/wav; codecs="1"'],
  ["wav/pcm_s24le", 'audio/wav; codecs="1"'],
  ["aiff/pcm_s16be", "audio/aiff"],
  ["aiff/pcm_s24be", "audio/aiff"],
];

// Codecs to convert a source the browser can't play into, best first. The
// server encodes each into the container its type names.
const CONVERSION_CODEC_TYPES: [string, string][] = [
  ["opus", 'audio/ogg; codecs="opus"'],
  ["aac", 'audio/mp4; codecs="mp4a.40.2"'],
];

let options: PlaybackUrlOptions | undefined;

// What this browser plays, for minting a playback URL it can play: sources it
// decodes are sent as they are, and the rest are converted.
export function browserPlaybackOptions(): PlaybackUrlOptions {
  if (options) return options;
  const probe = document.createElement("audio");
  const plays = ([, type]: [string, string]) => probe.canPlayType(type) !== "";
  const conversions = CONVERSION_CODEC_TYPES.filter(plays).map(([c]) => c);
  options = {
    copyProfiles: COPY_PROFILE_TYPES.filter(plays).map(([profile]) => profile),
    // MP3 plays everywhere, so it is the conversion of last resort.
    codecs: ["copy", ...conversions, "mp3"],
    // A transcode sent as it encodes has no length or byte ranges, so it
    // can't be seeked; wait for it to finish instead.
    waitForTranscode: true,
  };
  return options;
}
