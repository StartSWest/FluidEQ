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

/**
 * The one place a name from a window turns into a keystroke on the desktop.
 *
 * Everything on this path is fixed except the argument: the script is a file
 * that ships with the app, the arguments are a literal list, and the code is
 * looked up rather than passed through. So the only question worth asking of it
 * is what the lookup answers — and specifically what it answers for a name
 * nobody wrote here, because that is the case that decides whether a
 * compromised renderer gets three buttons or a keyboard.
 */

import {
  getMediaVirtualKey,
  MEDIA_TRANSPORT_ACTIONS,
} from '../../../main/mediaKeys';

describe('the media transport mapping', () => {
  it('maps each action to its Windows virtual key', () => {
    // The numbers themselves, not a round trip through the same table: these
    // are what a keyboard's media row sends, and getting one wrong means the
    // button works and does the wrong thing.
    expect(getMediaVirtualKey('previous')).toBe(0xb1);
    expect(getMediaVirtualKey('playPause')).toBe(0xb3);
    expect(getMediaVirtualKey('next')).toBe(0xb0);
  });

  it('has a key for every action it advertises', () => {
    MEDIA_TRANSPORT_ACTIONS.forEach((action) => {
      expect(`${action}: ${getMediaVirtualKey(action)}`).not.toContain(
        'undefined',
      );
    });
  });

  it('maps an unknown action to nothing', () => {
    expect(getMediaVirtualKey('stop')).toBeUndefined();
    expect(getMediaVirtualKey('')).toBeUndefined();
    expect(getMediaVirtualKey('PREVIOUS')).toBeUndefined();
    expect(getMediaVirtualKey('previous ')).toBeUndefined();
  });

  it('does not answer with anything it inherited', () => {
    // The reason the table is a Map. Indexing a plain object with a string that
    // came off the wire finds `constructor`, `toString` and the rest of the
    // prototype, and the caller would then be sending something that is not a
    // key code — or worse, would treat a truthy function as one.
    expect(getMediaVirtualKey('constructor')).toBeUndefined();
    expect(getMediaVirtualKey('toString')).toBeUndefined();
    expect(getMediaVirtualKey('__proto__')).toBeUndefined();
    expect(getMediaVirtualKey('hasOwnProperty')).toBeUndefined();
  });

  it('refuses anything that is not a string at all', () => {
    // IPC carries structured clones, so a window can send a number, an object
    // or nothing whatsoever — none of which a lookup should be handed.
    expect(getMediaVirtualKey(0xb3)).toBeUndefined();
    expect(getMediaVirtualKey(undefined)).toBeUndefined();
    expect(getMediaVirtualKey(null)).toBeUndefined();
    expect(getMediaVirtualKey({ action: 'next' })).toBeUndefined();
    expect(getMediaVirtualKey(['next'])).toBeUndefined();
  });
});
