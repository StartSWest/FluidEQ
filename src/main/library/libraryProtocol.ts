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

import { net, protocol } from 'electron';
import { pathToFileURL } from 'url';
import {
  LIBRARY_MEDIA_SCHEME,
  parseLibraryMediaUrl,
} from '../../common/library/mediaUrl';
import { ILibraryIndex } from '../../common/library/types';
import { artworkPath } from './libraryArtwork';
import { trackPathById } from './libraryIndex';

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
 */
export const registerLibraryMediaScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LIBRARY_MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
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
 * anywhere but `artworkPath`. `net.fetch` rather than a manual read is what
 * lets Electron's networking stack answer Range requests for seeking.
 * Anything that fails to parse or fails to resolve gets a 404 — nothing here
 * guesses at what a malformed request meant.
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
    // The incoming headers are forwarded, and the Range header is the whole
    // reason. Dropping them made every seek restart the track: Chromium asks
    // for `bytes=N-`, a bare `net.fetch` asks the file loader for the file,
    // and a 200 with the whole body where a 206 was expected tells the media
    // element it is holding a different resource — so it starts over at zero.
    // `stream: true` on the scheme is only half of Range support; this is the
    // other half.
    return net.fetch(pathToFileURL(resolved).toString(), {
      method: request.method,
      headers: request.headers,
    });
  });
};
