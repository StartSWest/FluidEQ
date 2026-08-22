/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { protocol } from 'electron';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname } from 'path';
import { Readable } from 'stream';
import {
  LIBRARY_MEDIA_SCHEME,
  parseLibraryMediaUrl,
} from '../../common/library/mediaUrl';
import { ILibraryIndex } from '../../common/library/types';
import { artworkPath } from './libraryArtwork';
import { trackPathById } from './libraryIndex';

/**
 * What a media element needs to be told before it will let anyone seek.
 *
 * `net.fetch` on a `file://` URL answers every request with a plain `200` and
 * no `Accept-Ranges`, whatever headers are handed to it — so Chromium
 * classified every track as an unseekable stream. Measured in the running
 * window, mid-song: `buffered.end = 165.43`, `duration = 210.55`, and
 * `seekable.end = 0`. Assigning `currentTime` to a resource with an empty
 * seekable range does not seek; it resets the element to zero, which is
 * exactly the "it jumps back to the start" this was reported as, and no
 * amount of work on the slider or the player state could have fixed it.
 *
 * So the ranges are served here rather than delegated. `stream: true` on the
 * scheme (see `registerLibraryMediaScheme`) is what allows a streamed body;
 * this is the other half it was waiting for.
 */
const MEDIA_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const mediaTypeFor = (filePath: string): string =>
  MEDIA_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';

/**
 * The byte range a `Range` header asks for, clamped to what the file has.
 *
 * Only the single-range `bytes=` form, which is the only one a media element
 * ever sends. Anything else — a multipart range, a unit that is not bytes, a
 * start past the end — returns nothing, and the caller answers with the whole
 * file rather than guessing at what was meant.
 */
export const parseByteRange = (
  header: string | null,
  size: number,
): { start: number; end: number } | undefined => {
  if (!header) {
    return undefined;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) {
    return undefined;
  }
  if (match[1] === '') {
    // `bytes=-500`: the last 500 bytes.
    const length = Number(match[2]);
    if (length <= 0) {
      return undefined;
    }
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(match[1]);
  if (start >= size) {
    return undefined;
  }
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (end < start) {
    return undefined;
  }
  return { start, end };
};

/** A Node read stream as the web stream `Response` wants. Cast through
 * `unknown` because Node's own `ReadableStream` type and the DOM's are
 * structurally identical here but nominally distinct. */
const webStream = (
  path: string,
  start?: number,
  end?: number,
): ReadableStream =>
  Readable.toWeb(
    createReadStream(path, start === undefined ? undefined : { start, end }),
  ) as unknown as ReadableStream;

/**
 * Declares the scheme's privileges before the app is ready.
 *
 * `registerSchemesAsPrivileged` only has an effect when called at module
 * scope, before `app.whenReady()` — a scheme registered afterwards looks like
 * it worked and then silently behaves like an ordinary untrusted one.
 * `stream: true` is what lets `protocol.handle` answer Range requests; without
 * it, seeking inside a large video re-downloads the file from the start every
 * time. `bypassCSP` is left `false` on purpose: this scheme is admitted by
 * name in `img-src` and `media-src`, not exempted from the policy.
 *
 * `corsEnabled` is what lets the DSP hear this audio at all, and its absence
 * failed in the least obvious way available. This scheme is a different origin
 * from the renderer's `http://localhost:1212`, so a track served over it was
 * cross-origin media with no CORS — and Chromium's rule is that a
 * `MediaElementAudioSourceNode` built on tainted media outputs **silence**
 * while the element itself goes on decoding perfectly. The transport ran, the
 * seek bar moved, and nothing came out. Playing a different track appeared to
 * fix it only because that path had served the file over the same-origin
 * localhost URL instead.
 */
/**
 * What makes the audio audible to Web Audio rather than merely playable.
 *
 * The renderer requests these with `crossOrigin="anonymous"`, so the response
 * has to say the origin is allowed or the media is tainted and every
 * `MediaElementAudioSourceNode` built on it emits zeros.
 *
 * `Range` is a CORS-safelisted request header for media, so no preflight is
 * involved; the exposed list is what the media stack has to read back off a
 * 206 to know where in the file it landed.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers':
    'Content-Length, Content-Range, Accept-Ranges',
};

export const registerLibraryMediaScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LIBRARY_MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
        bypassCSP: false,
      },
    },
  ]);
};

/**
 * Answers every `fluideq-media://` request the renderer makes.
 *
 * The id is resolved against the index (tracks) or the artwork cache (covers)
 * — both lookups this module does not perform itself, so a track path never
 * comes from anywhere but `trackPathById` and a cover path never comes from
 * anywhere but `artworkPath`. Byte ranges are served here rather than
 * delegated — see `parseByteRange` above for why that turned out to be the
 * whole of seeking. Anything that fails to parse or fails to resolve gets a
 * 404; nothing here guesses at what a malformed request meant.
 */
export const handleLibraryMedia = (deps: {
  userDataDir: string;
  getIndex: () => ILibraryIndex;
}): void => {
  protocol.handle(LIBRARY_MEDIA_SCHEME, async (request) => {
    const parsed = parseLibraryMediaUrl(request.url);
    if (!parsed) {
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(`Could not parse library media request ${request.url}`);
      return new Response(undefined, { status: 404 });
    }
    const resolved =
      parsed.kind === 'track'
        ? trackPathById(deps.getIndex(), parsed.id)
        : artworkPath(deps.userDataDir, parsed.id);
    if (!resolved) {
      // A click that loads the bar and then does nothing, ever, used to
      // leave no trace anywhere -- this is the one line that turns it into
      // a bug report: which id was asked for, and what it resolved to
      // (nothing, here) -- a track whose root was removed, an artwork id the
      // cache never wrote, or an id this build never minted at all.
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(
        `Library media not found: ${parsed.kind} ${parsed.id} resolved to ${resolved}`,
      );
      return new Response(undefined, { status: 404 });
    }
    let size = 0;
    try {
      size = (await stat(resolved)).size;
    } catch (error) {
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(`Library media could not be opened: ${resolved}`, error);
      return new Response(undefined, { status: 404 });
    }

    const type = mediaTypeFor(resolved);
    const range = parseByteRange(request.headers.get('range'), size);
    if (!range) {
      // `Accept-Ranges` on the plain response too — it is how the element
      // learns it may ask for a range at all, and without it Chromium never
      // sends one and never marks the resource seekable.
      return new Response(webStream(resolved), {
        status: 200,
        headers: {
          'Content-Type': type,
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
          ...CORS_HEADERS,
        },
      });
    }
    return new Response(webStream(resolved, range.start, range.end), {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Accept-Ranges': 'bytes',
        ...CORS_HEADERS,
      },
    });
  });
};
