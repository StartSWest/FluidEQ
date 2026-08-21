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
 * The line between PowerShell and the transport bar.
 *
 * Everything else on this path is fixed — the script is a literal, the
 * arguments are a list, the channel carries one shape — so the question worth
 * asking is what the parser makes of a line. It is reading the output of a
 * child process that talks to Windows about other programs' players, which is
 * three things this app does not control, and a bar that shows a song title
 * of `undefined` because a browser published none is the failure this guards.
 */

import { parseSystemMediaLine } from '../../../main/systemMedia';

describe('what the machine is playing', () => {
  it('reads a session the way the watcher prints it', () => {
    const snapshot = parseSystemMediaLine(
      '{"app":"Chrome","title":"Killing Voice","artist":"dingo","isPlaying":true,"positionMs":1063736,"durationMs":1892841,"canNext":false,"canPrevious":false,"canSeek":true}',
    );

    expect(snapshot).toEqual({
      app: 'Chrome',
      title: 'Killing Voice',
      artist: 'dingo',
      isPlaying: true,
      positionMs: 1063736,
      durationMs: 1892841,
      // Measured on a real session: a YouTube video in Chrome takes a
      // playhead move and refuses next and previous. The bar draws the
      // buttons from these, so a session that says no gets none.
      canNext: false,
      canPrevious: false,
      canSeek: true,
    });
  });

  it('treats nothing playing as nothing playing', () => {
    // What the script prints for no session at all, and for a session that
    // threw while being read: there is no third state on the bar.
    expect(parseSystemMediaLine('null')).toBeUndefined();
    expect(parseSystemMediaLine('')).toBeUndefined();
    expect(parseSystemMediaLine('   ')).toBeUndefined();
  });

  it('drops a player that has registered but has nothing loaded', () => {
    // A media session with no title is Spotify sitting at its home screen.
    // Shown, the bar drew a card with a blank line where the song goes.
    expect(
      parseSystemMediaLine(
        '{"app":"Spotify.exe","title":"","artist":"","isPlaying":false,"positionMs":0,"durationMs":0}',
      ),
    ).toBeUndefined();
  });

  it('survives a line that is not the shape it should be', () => {
    // The child is a program reading three others. Half a line arriving on a
    // pipe boundary, or a player publishing a number where a string belongs,
    // must not take the window's transport with it.
    expect(parseSystemMediaLine('{"app":"Chrome","title"')).toBeUndefined();
    expect(parseSystemMediaLine('[1,2,3]')).toBeUndefined();
    expect(
      parseSystemMediaLine(
        '{"app":7,"title":"Song","artist":null,"isPlaying":"yes","positionMs":"12","durationMs":-4}',
      ),
    ).toEqual({
      app: '',
      title: 'Song',
      artist: '',
      // Anything that is not the literal `true` is not playing: a bar that
      // showed a pause button for a string would be lying about the one
      // thing its button acts on.
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
      // Same rule for the capabilities: anything that is not `true` is a no,
      // and a no draws no button.
      canNext: false,
      canPrevious: false,
      canSeek: false,
    });
  });

  it('offers a queue only where the player said it takes one', () => {
    const spotify = parseSystemMediaLine(
      '{"app":"Spotify.exe","title":"Song","artist":"Band","isPlaying":true,"positionMs":1000,"durationMs":200000,"canNext":true,"canPrevious":true,"canSeek":true}',
    );

    expect(spotify?.canNext).toBe(true);
    expect(spotify?.canPrevious).toBe(true);
    expect(spotify?.canSeek).toBe(true);
  });
});
