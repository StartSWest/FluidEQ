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

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import {
  parseSystemMediaLine,
  stopWatchingSystemMedia,
  watchSystemMedia,
} from '../../../main/systemMedia';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

/** A watcher child: stdout to push lines into, and an exit to fire. */
const fakeChild = () => {
  const stdout = new EventEmitter();
  const child = Object.assign(new EventEmitter(), {
    kill: jest.fn(),
    stdout,
  });
  (spawn as jest.Mock).mockReturnValue(child);
  return { child, stdout };
};

const PLAYING_LINE =
  '{"app":"Chrome","title":"Kura Kura","artist":"TWICE","isPlaying":true,"positionMs":1000,"durationMs":200000,"canNext":false,"canPrevious":false,"canSeek":true}';

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

/**
 * THE WATCHER OUTLIVES THE WINDOW THAT STARTED IT.
 *
 * Reported as "it says nothing is playing while I am playing a video in
 * Chrome": the window had been reloaded — crash recovery, a dev restart — and
 * every reading was still being posted to the sender that had gone with the
 * old document, because a second subscribe was dropped on the floor whenever a
 * child was already running. Nothing but quitting the app brought the bar
 * back.
 */
describe('watching across a reload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopWatchingSystemMedia();
  });

  afterEach(() => stopWatchingSystemMedia());

  it('starts one child however many times it is asked', () => {
    fakeChild();
    watchSystemMedia(jest.fn());
    watchSystemMedia(jest.fn());

    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('sends readings to the window that subscribed last', () => {
    const { stdout } = fakeChild();
    const gone = jest.fn();
    watchSystemMedia(gone);
    const reloaded = jest.fn();
    watchSystemMedia(reloaded);
    gone.mockClear();
    reloaded.mockClear();

    stdout.emit('data', Buffer.from(`${PLAYING_LINE}\n`, 'utf8'));

    expect(reloaded).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kura Kura', isPlaying: true }),
    );
    expect(gone).not.toHaveBeenCalled();
  });

  /**
   * The child prints only when what the bar would draw has changed, so a
   * window arriving mid-song must be told where things stand. For a player
   * that publishes no timeline the next change is not a second away — it is
   * the end of the track.
   */
  it('hands a fresh window what is playing without waiting for a change', () => {
    const { stdout } = fakeChild();
    watchSystemMedia(jest.fn());
    stdout.emit('data', Buffer.from(`${PLAYING_LINE}\n`, 'utf8'));

    const reloaded = jest.fn();
    watchSystemMedia(reloaded);

    expect(reloaded).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kura Kura' }),
    );
  });

  it('does not hand on a reading from a watcher that has been stopped', () => {
    const { stdout } = fakeChild();
    watchSystemMedia(jest.fn());
    stdout.emit('data', Buffer.from(`${PLAYING_LINE}\n`, 'utf8'));
    stopWatchingSystemMedia();

    fakeChild();
    const later = jest.fn();
    watchSystemMedia(later);

    // A new child, so nothing is replayed: the old reading would have named
    // whatever was playing when the watcher was last switched off.
    expect(later).not.toHaveBeenCalled();
  });

  it('says nothing is playing when the watcher dies', () => {
    const { child } = fakeChild();
    const listener = jest.fn();
    watchSystemMedia(listener);
    listener.mockClear();

    child.emit('exit');

    expect(listener).toHaveBeenCalledWith(undefined);
  });
});
