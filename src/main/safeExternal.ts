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

import { shell } from 'electron';

/**
 * Hand a URL to the user's browser, or refuse it.
 *
 * `shell.openExternal` does not open a web page — it asks Windows to do
 * whatever it has been configured to do with that string. `file:` opens
 * Explorer, and every protocol some other installed application has registered
 * is reachable the same way, which makes an unchecked call a way of starting
 * arbitrary local software with an argument.
 *
 * So the scheme is the whole gate, and it is checked here rather than at each
 * caller. There were two callers doing this differently: the Remote Media
 * player parsed and refused anything that was not http(s), and the main
 * window's `setWindowOpenHandler` passed `edata.url` straight through. The
 * second is reached by anything that can open a window or a `target="_blank"`
 * link — rendered lyrics, a profile name, changelog markdown, a row from a
 * synced measurement database — so the careful half was the half not covering
 * the general case.
 *
 * Returns whether it was allowed, so a caller that wants to tell the user why
 * nothing happened can.
 */
const openExternalIfSafe = (url: string): boolean => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    // Not a URL at all. Nothing to open and nothing worth reporting.
    return false;
  }

  if (protocol !== 'https:' && protocol !== 'http:') {
    return false;
  }

  shell.openExternal(url).catch(() => {
    // The OS refused to open it; there is nothing useful to say about that.
  });
  return true;
};

export default openExternalIfSafe;
