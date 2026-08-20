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

Jest reads pragmas only from the file's first block comment, so it lives here
rather than in a comment of its own further down.

@jest-environment node

This file tests a main-process protocol handler, not anything DOM-shaped;
jsdom, this suite's default test environment, has no reason to run it.
*/

const handlers = new Map<string, (request: Request) => Promise<Response>>();

jest.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: jest.fn(),
    handle: (
      scheme: string,
      fn: (request: Request) => Promise<Response>,
    ): void => {
      handlers.set(scheme, fn);
    },
  },
}));

// The handler serves byte ranges itself now — `net.fetch` on a `file://` URL
// answers every request with a plain 200 and no `Accept-Ranges` whatever
// headers it is given, which left every track unseekable. So the file system
// is what has to be stood in for here, not the network stack.
const FILE_SIZE = 5_000;
const statMock = jest.fn(() => Promise.resolve({ size: FILE_SIZE }));
/** Records the window each response was opened over, so a test can assert the
 * bytes actually read match the range that was promised in the headers. */
const readRanges: { start?: number; end?: number }[] = [];

jest.mock('fs/promises', () => ({
  stat: (...args: unknown[]) => statMock(...(args as [])),
}));

jest.mock('fs', () => ({
  createReadStream: (
    _path: string,
    options?: { start: number; end: number },
  ) => {
    readRanges.push({ start: options?.start, end: options?.end });
    const { Readable } = jest.requireActual('stream');
    const length =
      options === undefined ? FILE_SIZE : options.end - options.start + 1;
    return Readable.from([Buffer.alloc(Math.max(0, length))]);
  },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import { ILibraryIndex } from '../../../common/library/types';
// eslint-disable-next-line import/first
import {
  LIBRARY_MEDIA_SCHEME,
  libraryMediaUrl,
} from '../../../common/library/mediaUrl';
// eslint-disable-next-line import/first
import { handleLibraryMedia } from '../../../main/library/libraryProtocol';
// eslint-disable-next-line import/first
import { trackIdForPath } from '../../../main/library/libraryScanner';

const emptyIndex: ILibraryIndex = { version: 1, roots: [], tracks: [] };

beforeEach(() => {
  handlers.clear();
  statMock.mockClear();
  readRanges.length = 0;
});

describe('answering a fluideq-media request for an id the index no longer knows (blocker 4)', () => {
  it('logs the id and what it resolved to before answering 404', async () => {
    // Before this fix, a click on a track whose file the protocol could not
    // resolve loaded the bar, showed Play, and then did nothing forever --
    // with no message on screen and no line in the log to start a bug report
    // from. This is the positive control for that: proof the log line
    // actually carries the id, not just proof a 404 came back (a bare
    // `expect(response.status).toBe(404)` would pass identically whether or
    // not anything was ever logged).
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    handleLibraryMedia({
      userDataDir: 'C:\\unused',
      getIndex: () => emptyIndex,
    });
    const handler = handlers.get(LIBRARY_MEDIA_SCHEME);
    const id = trackIdForPath('C:\\Music\\gone.mp3');
    const request = new Request(libraryMediaUrl('track', id));

    const response = await handler?.(request);

    expect(response?.status).toBe(404);
    expect(statMock).not.toHaveBeenCalled();
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes(id)),
    ).toBe(true);
    consoleError.mockRestore();
  });

  it('serves a known track instead, right beside the refusal above', async () => {
    // The positive control the refusal test itself needs: proof the same
    // handler, given an id the index actually has, really does open the file
    // rather than refusing every id alike.
    const trackPath = 'C:\\Music\\known.mp3';
    const id = trackIdForPath(trackPath);
    const index: ILibraryIndex = {
      version: 1,
      roots: [],
      tracks: [
        {
          id,
          rootId: 'r1',
          path: trackPath,
          kind: 'audio',
          isPlayable: true,
          title: 'Known',
          sizeBytes: 1,
          mtimeMs: 1,
          addedAt: 1,
        },
      ],
    };
    handleLibraryMedia({ userDataDir: 'C:\\unused', getIndex: () => index });
    const handler = handlers.get(LIBRARY_MEDIA_SCHEME);
    const request = new Request(libraryMediaUrl('track', id));

    const response = await handler?.(request);

    expect(response?.status).toBe(200);
    expect(statMock).toHaveBeenCalledTimes(1);
    // `Accept-Ranges` on the plain response is what tells the element it may
    // ask for a range at all. Without it Chromium never sends one, never
    // marks the resource seekable, and `currentTime` assignments reset the
    // playhead to zero instead of moving it.
    expect(response?.headers.get('accept-ranges')).toBe('bytes');
    expect(response?.headers.get('content-length')).toBe(String(FILE_SIZE));
    expect(response?.headers.get('content-type')).toBe('audio/mpeg');
  });

  it('answers a Range request with 206 and the window it promised', async () => {
    // This is what makes a seek a seek. Measured in the running window before
    // it: mid-song, `buffered.end = 165.43` and `duration = 210.55` but
    // `seekable.end = 0` — assigning `currentTime` to a resource with an
    // empty seekable range does not move the playhead, it resets it, which is
    // the "it jumps back to the start" this was reported as. Delegating to
    // `net.fetch` could never fix it: on a `file://` URL it answers 200 with
    // no `Accept-Ranges` whatever headers it is handed.
    const trackPath = 'C:\\Music\\seekable.mp3';
    const id = trackIdForPath(trackPath);
    const index: ILibraryIndex = {
      version: 1,
      roots: [],
      tracks: [
        {
          id,
          rootId: 'r1',
          path: trackPath,
          kind: 'audio',
          isPlayable: true,
          title: 'Seekable',
          sizeBytes: 1,
          mtimeMs: 1,
          addedAt: 1,
        },
      ],
    };
    handleLibraryMedia({ userDataDir: 'C:\\unused', getIndex: () => index });
    const handler = handlers.get(LIBRARY_MEDIA_SCHEME);

    const ranged = await handler?.(
      new Request(libraryMediaUrl('track', id), {
        headers: { Range: 'bytes=4096-' },
      }),
    );

    expect(ranged?.status).toBe(206);
    expect(ranged?.headers.get('content-range')).toBe(
      `bytes 4096-${FILE_SIZE - 1}/${FILE_SIZE}`,
    );
    expect(ranged?.headers.get('content-length')).toBe(
      String(FILE_SIZE - 4096),
    );
    // The bytes actually opened match the window promised in the headers. A
    // handler that returned the right headers over the whole file would look
    // correct here and hand the element the wrong audio.
    expect(readRanges).toEqual([{ start: 4096, end: FILE_SIZE - 1 }]);

    // The other half of the discrimination: a request with no Range must get
    // the whole file and a 200. A handler that always answered 206 would
    // satisfy every assertion above and break the first load of every track.
    readRanges.length = 0;
    const plain = await handler?.(new Request(libraryMediaUrl('track', id)));

    expect(plain?.status).toBe(200);
    expect(plain?.headers.get('content-range')).toBeNull();
    expect(readRanges).toEqual([{ start: undefined, end: undefined }]);
  });
});

describe('the Range header grammar', () => {
  it('reads the forms a media element actually sends, and refuses the rest', async () => {
    const { parseByteRange } =
      await import('../../../main/library/libraryProtocol');

    // The common one: everything from here on.
    expect(parseByteRange('bytes=100-', 1000)).toEqual({
      start: 100,
      end: 999,
    });
    // A closed window, and one that runs past the end is clamped rather than
    // refused — Chromium asks for more than it can have all the time.
    expect(parseByteRange('bytes=10-20', 1000)).toEqual({ start: 10, end: 20 });
    expect(parseByteRange('bytes=900-5000', 1000)).toEqual({
      start: 900,
      end: 999,
    });
    // A suffix range: the last N bytes, which is how some demuxers find a
    // trailer.
    expect(parseByteRange('bytes=-200', 1000)).toEqual({
      start: 800,
      end: 999,
    });

    // Everything below has to fall through to "serve the whole file", because
    // answering 206 to a request whose bounds we did not understand hands the
    // element bytes it did not ask for.
    expect(parseByteRange(null, 1000)).toBeUndefined();
    expect(parseByteRange('bytes=1000-', 1000)).toBeUndefined();
    expect(parseByteRange('bytes=50-10', 1000)).toBeUndefined();
    expect(parseByteRange('bytes=0-10, 20-30', 1000)).toBeUndefined();
    expect(parseByteRange('items=0-10', 1000)).toBeUndefined();
    expect(parseByteRange('bytes=-', 1000)).toBeUndefined();
  });
});
