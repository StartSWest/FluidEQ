/* FluidEQ — GPL-3.0-or-later */

import { createHash } from 'crypto';
import { constants } from 'fs';
import { open } from 'fs/promises';
import { fileURLToPath } from 'url';

const MAX_BYTES = 3 * 1024 * 1024;

const imageType = (bytes: Buffer): string | undefined => {
  if (bytes.length < 64 || bytes.length > MAX_BYTES) {
    return undefined;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return 'image/png';
  }
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif';
  }
  return undefined;
};

const readPicture = async (
  uri: string,
  signal: AbortSignal,
): Promise<Buffer | undefined> => {
  const url = new URL(uri);
  if (url.protocol === 'file:') {
    const file = await open(
      fileURLToPath(url),
      // eslint-disable-next-line no-bitwise -- A media URI may name a FIFO; POSIX's nonblocking flag keeps opening it from hanging main.
      constants.O_RDONLY | constants.O_NONBLOCK,
    );
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size < 64 ||
        stat.size > MAX_BYTES ||
        signal.aborted
      ) {
        return undefined;
      }
      const bytes = Buffer.alloc(stat.size);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      return bytesRead === bytes.length ? bytes : undefined;
    } finally {
      await file.close();
    }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return undefined;
  }
  if (url.username || url.password) {
    return undefined;
  }
  const response = await fetch(url, { signal });
  const size = Number(response.headers.get('content-length'));
  if (!response.ok || size > MAX_BYTES) {
    await response.body?.cancel();
    return undefined;
  }
  // Covers arrive from other programs. Bound the streamed bytes too: a
  // missing or false Content-Length must not turn artwork into an unbounded
  // download in the app's main process.
  const reader = response.body?.getReader();
  if (!reader) {
    return undefined;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) {
        return Buffer.concat(chunks, length);
      }
      length += part.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
};

/**
 * MPRIS supplies a URI, while the shared bar consumes the helper's cover
 * bytes. Read it asynchronously and publish only for the current song. A
 * slow picture must neither block D-Bus commands nor hang on the next song.
 */
const createLinuxMediaArtwork = (emit: (line: string) => void) => {
  let current: Record<string, unknown> | undefined;
  let uri = '';
  let song = '';
  let cover: { id: string; type: string; data: string } | undefined;
  let request: AbortController | undefined;
  let disposed = false;
  const publish = () => {
    if (!current || disposed) {
      return;
    }
    emit(JSON.stringify({ ...current, coverId: cover?.id ?? '' }));
  };
  return {
    read: (line: string) => {
      if (disposed) {
        return undefined;
      }
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        emit(line);
        return undefined;
      }
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        request?.abort();
        current = undefined;
        uri = '';
        song = '';
        cover = undefined;
        emit(line);
        return undefined;
      }
      const record = value as Record<string, unknown>;
      if (typeof record.artUrl !== 'string') {
        emit(line);
        return undefined;
      }
      current = record;
      const nextUri = typeof record.artUrl === 'string' ? record.artUrl : '';
      const nextSong = JSON.stringify([
        record.app,
        record.title,
        record.artist,
      ]);
      if (nextUri === uri && nextSong === song) {
        publish();
        return undefined;
      }
      request?.abort();
      request = new AbortController();
      const owned = request;
      uri = nextUri;
      song = nextSong;
      cover = undefined;
      publish();
      if (!uri) {
        return undefined;
      }
      return readPicture(uri, owned.signal)
        .then((bytes) => {
          if (disposed || request !== owned || !bytes) {
            return undefined;
          }
          const type = imageType(bytes);
          if (!type) {
            return undefined;
          }
          cover = {
            id: createHash('md5').update(bytes).digest('hex').slice(0, 16),
            type,
            data: bytes.toString('base64'),
          };
          emit(JSON.stringify({ cover }));
          publish();
          return undefined;
        })
        .catch(() => undefined);
    },
    dispose: () => {
      disposed = true;
      request?.abort();
    },
  };
};

export default createLinuxMediaArtwork;
