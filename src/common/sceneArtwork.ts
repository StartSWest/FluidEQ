/** Signed, embedded artwork only. No URLs, paths, external fetches or scripts. */
export interface ISceneArtwork {
  mime: 'image/webp';
  width: number;
  height: number;
  data: string;
}

// Separate water detail avoids enlarging a small landscape strip at fullscreen.
// Bound decoded area as well as edges: a 4096 x 2048 RGBA atlas uses 32 MiB
// before mipmaps; a 4096-square compressed image must not bypass that budget.
export const MAX_SCENE_ARTWORK_BYTES = 6 * 1024 * 1024;
export const MAX_SCENE_ARTWORK_EDGE = 4096;
export const MAX_SCENE_ARTWORK_PIXELS = 4096 * 2048;

const isBase64 = (text: string): boolean => {
  if (text.length % 4 !== 0) {
    return false;
  }
  let end = text.length;
  if (text.endsWith('==')) {
    end -= 2;
  } else if (text.endsWith('=')) {
    end -= 1;
  }
  // A repeated four-character regex group exhausted V8's stack on valid
  // multi-megabyte artwork. Scan once with bounded stack and identical
  // alphabet/padding rules before allocating decoded image bytes.
  for (let index = 0; index < end; index += 1) {
    const code = text.charCodeAt(index);
    const allowed =
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 43 ||
      code === 47;
    if (!allowed) {
      return false;
    }
  }
  return true;
};

/**
 * Read dimensions from the WebP container before an image decoder allocates
 * memory. Authored dimensions alone would not bound a compressed image.
 */
export const normalizeSceneArtwork = (raw: unknown): ISceneArtwork | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (
    value.mime !== 'image/webp' ||
    typeof value.data !== 'string' ||
    value.data.length > Math.ceil(MAX_SCENE_ARTWORK_BYTES / 3) * 4 ||
    !isBase64(value.data)
  ) {
    return null;
  }
  let bytes: string;
  try {
    bytes = atob(value.data);
  } catch {
    return null;
  }
  if (bytes.length < 30 || bytes.length > MAX_SCENE_ARTWORK_BYTES) {
    return null;
  }
  const byte = (at: number) => bytes.charCodeAt(at);
  const uint24 = (at: number) =>
    byte(at) + byte(at + 1) * 256 + byte(at + 2) * 65536;
  const uint32 = (at: number) => uint24(at) + byte(at + 3) * 16777216;
  if (
    bytes.slice(0, 4) !== 'RIFF' ||
    bytes.slice(8, 12) !== 'WEBP' ||
    uint32(4) + 8 !== bytes.length
  ) {
    return null;
  }
  const kind = bytes.slice(12, 16);
  let width: number;
  let height: number;
  if (kind === 'VP8X') {
    // Animated containers are unnecessary for GPU artwork and add a second
    // independent clock. Only the scene's audio clock animates these pixels.
    if (uint32(16) !== 10 || Math.floor(byte(20) / 2) % 2 !== 0) {
      return null;
    }
    width = uint24(24) + 1;
    height = uint24(27) + 1;
  } else if (kind === 'VP8 ') {
    if (byte(23) !== 0x9d || byte(24) !== 0x01 || byte(25) !== 0x2a) {
      return null;
    }
    width = (byte(26) + byte(27) * 256) % 16384;
    height = (byte(28) + byte(29) * 256) % 16384;
  } else if (kind === 'VP8L' && byte(20) === 0x2f) {
    const bits = uint32(21);
    width = (bits % 16384) + 1;
    height = (Math.floor(bits / 16384) % 16384) + 1;
  } else {
    return null;
  }
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_SCENE_ARTWORK_EDGE ||
    height > MAX_SCENE_ARTWORK_EDGE ||
    width * height > MAX_SCENE_ARTWORK_PIXELS ||
    value.width !== width ||
    value.height !== height
  ) {
    return null;
  }
  return { mime: 'image/webp', width, height, data: value.data };
};
