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

// Typed to take (...unknown[]) rather than a zero-arg form: TS infers a
// jest.fn's call signature from its implementation's own parameter list, and
// a zero-arg implementation makes the mock's signature a strict empty tuple
// -- which the electron mock below cannot spread `args` into (TS2556). Same
// shape as `showOpenDialog` in libraryIpc.test.ts, for the same reason.
const netFetch = jest.fn((..._args: unknown[]) =>
  Promise.resolve(new Response('ok')),
);
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
  net: { fetch: (...args: unknown[]) => netFetch(...args) },
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
  netFetch.mockClear();
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
    expect(netFetch).not.toHaveBeenCalled();
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes(id)),
    ).toBe(true);
    consoleError.mockRestore();
  });

  it('resolves a known track to net.fetch instead, right beside the refusal above', async () => {
    // The positive control the refusal test itself needs: proof the same
    // handler, given an id the index actually has, really does reach
    // net.fetch rather than refusing every id alike.
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
    expect(netFetch).toHaveBeenCalledTimes(1);
  });

  it('carries the Range header through to net.fetch, which is what makes a seek a seek', async () => {
    // Without this, every seek restarted the track: Chromium asks for
    // `bytes=N-`, a bare `net.fetch` fetches the whole file, and a 200 where
    // a 206 was expected tells the media element it is holding a different
    // resource, so it starts over at zero. Asserted on the header the handler
    // actually passes on, not on `net.fetch` merely having been called — that
    // much was already true for the whole time seeking was broken.
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

    await handler?.(
      new Request(libraryMediaUrl('track', id), {
        headers: { Range: 'bytes=4096-' },
      }),
    );

    const ranged = netFetch.mock.calls[0][1] as { headers: Headers };
    expect(ranged.headers.get('range')).toBe('bytes=4096-');

    // The other half of the discrimination: a request with no Range must not
    // acquire one. A handler that hardcoded a range would satisfy the
    // assertion above and break every first load.
    netFetch.mockClear();
    await handler?.(new Request(libraryMediaUrl('track', id)));

    const plain = netFetch.mock.calls[0][1] as { headers: Headers };
    expect(plain.headers.get('range')).toBeNull();
  });
});
