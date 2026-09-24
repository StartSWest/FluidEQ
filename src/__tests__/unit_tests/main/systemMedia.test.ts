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
  getSystemMediaCover,
  isSystemMediaCoverLine,
  parseSystemMediaCover,
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
      // Nothing said about who else is playing is nobody else playing.
      playing: [],
      // Nor any picture: a watcher that sent none has none to fetch.
      coverId: '',
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
      playing: [],
      coverId: '',
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

  /**
   * A window reload stops the watcher and starts it again at once, and the
   * old PowerShell's exit is delivered only once it has actually died — after
   * the new one is already running. That late exit is the OLD child's news.
   * Taken as the current child's, it wiped the new child out of the module
   * while it kept polling, told the fresh window nothing was playing in the
   * middle of a song, and made the next subscribe start a third PowerShell,
   * with the second one left running until the app quit: stop only ever
   * kills the one it knows about.
   */
  it('ignores the exit of a watcher it has already replaced', () => {
    const first = fakeChild();
    watchSystemMedia(jest.fn());
    stopWatchingSystemMedia();
    expect(first.child.kill).toHaveBeenCalled();

    const second = fakeChild();
    const reloaded = jest.fn();
    watchSystemMedia(reloaded);
    second.stdout.emit('data', Buffer.from(`${PLAYING_LINE}\n`, 'utf8'));
    reloaded.mockClear();

    // The first child's death, delivered late.
    first.child.emit('exit');

    expect(reloaded).not.toHaveBeenCalled();
    // Still the second child: a further subscribe is handed its reading and
    // starts nothing new.
    fakeChild();
    watchSystemMedia(reloaded);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(reloaded).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kura Kura', isPlaying: true }),
    );
    // And stopping reaches the child that is actually running.
    stopWatchingSystemMedia();
    expect(second.child.kill).toHaveBeenCalled();
  });
});

describe('who else is playing', () => {
  it('reads the list the watcher prints', () => {
    expect(
      parseSystemMediaLine(
        '{"app":"Chrome","title":"Song","isPlaying":true,"positionMs":0,"durationMs":0,"playing":["Chrome","Spotify.exe"]}',
      )?.playing,
    ).toEqual(['Chrome', 'Spotify.exe']);
  });

  it('reads one of them, which PowerShell writes as a bare string', () => {
    // Its own JSON collapses a list of one, and a reader that only took the
    // list would go blind in every ordinary moment before a second program
    // starts — which is exactly the reading the next one is compared against.
    expect(
      parseSystemMediaLine(
        '{"app":"Chrome","title":"Song","isPlaying":true,"positionMs":0,"durationMs":0,"playing":"Chrome"}',
      )?.playing,
    ).toEqual(['Chrome']);
  });

  it('takes nothing believable as nobody', () => {
    expect(
      parseSystemMediaLine(
        '{"app":"Chrome","title":"Song","isPlaying":true,"positionMs":0,"durationMs":0,"playing":[1,"",null,"Chrome"]}',
      )?.playing,
    ).toEqual(['Chrome']);
  });
});

/**
 * The cover a player publishes for its song, which the stage shows behind the
 * graph in the expanded and fullscreen views. The watcher sends it once per
 * song on a line of its own, and every reading after carries only its id.
 */
describe("the player's cover", () => {
  const COVER_ID = '0123456789abcdef';
  // The eight bytes every PNG starts with, which is all a parser can check.
  const PNG_BYTES = 'iVBORw0KGgo=';
  const coverLine = (cover: Record<string, unknown>) =>
    JSON.stringify({ cover });

  beforeEach(() => {
    jest.clearAllMocks();
    stopWatchingSystemMedia();
  });

  afterEach(() => stopWatchingSystemMedia());

  it('reads a cover the way the watcher prints it', () => {
    expect(
      parseSystemMediaCover(
        coverLine({ id: COVER_ID, type: 'image/png', data: PNG_BYTES }),
      ),
    ).toEqual({ id: COVER_ID, url: `data:image/png;base64,${PNG_BYTES}` });
  });

  it('refuses a cover with any part it does not recognise', () => {
    const good = { id: COVER_ID, type: 'image/png', data: PNG_BYTES };
    [
      // Not an id the window could ask for.
      { ...good, id: 'ABCDEF0123456789' },
      { ...good, id: '0123' },
      // A type the watcher never sniffs, which an image would be asked to
      // guess at.
      { ...good, type: 'image/svg+xml' },
      { ...good, type: 'text/html' },
      // Anything but base64, which would end the data URL early.
      { ...good, data: 'abc"onerror' },
      { ...good, data: '' },
      { ...good, data: 42 },
    ].forEach((cover) => {
      expect(parseSystemMediaCover(coverLine(cover))).toBeUndefined();
    });
    expect(parseSystemMediaCover('{"cover":null}')).toBeUndefined();
    expect(parseSystemMediaCover('{"cover":')).toBeUndefined();
    // A reading is not a cover, however it is shaped.
    expect(parseSystemMediaCover(PLAYING_LINE)).toBeUndefined();
  });

  it('tells a cover line from a reading', () => {
    expect(isSystemMediaCoverLine(coverLine({ id: COVER_ID }))).toBe(true);
    expect(isSystemMediaCoverLine(PLAYING_LINE)).toBe(false);
    expect(isSystemMediaCoverLine('null')).toBe(false);
  });

  it('takes the id a reading names, and nothing that is not one', () => {
    const withCover = (coverId: unknown) =>
      parseSystemMediaLine(
        JSON.stringify({ ...JSON.parse(PLAYING_LINE), coverId }),
      )?.coverId;

    expect(withCover(COVER_ID)).toBe(COVER_ID);
    expect(withCover('../../etc')).toBe('');
    expect(withCover(7)).toBe('');
  });

  it('keeps the cover for the window without passing it on as a reading', () => {
    const { stdout } = fakeChild();
    const listener = jest.fn();
    watchSystemMedia(listener);
    listener.mockClear();

    stdout.emit(
      'data',
      Buffer.from(
        `${coverLine({ id: COVER_ID, type: 'image/png', data: PNG_BYTES })}\n`,
        'utf8',
      ),
    );

    // Read as a reading it would be "nothing playing", and the bar would go
    // blank in the middle of a song.
    expect(listener).not.toHaveBeenCalled();
    expect(getSystemMediaCover(COVER_ID)).toBe(
      `data:image/png;base64,${PNG_BYTES}`,
    );
    // Only the current cover is answered: an id from the song before is the
    // window's cue not to draw it.
    expect(getSystemMediaCover('fedcba9876543210')).toBeUndefined();
  });

  it('keeps the last good cover when a bad one arrives, and none past a stop', () => {
    const { stdout } = fakeChild();
    watchSystemMedia(jest.fn());
    stdout.emit(
      'data',
      Buffer.from(
        `${coverLine({ id: COVER_ID, type: 'image/png', data: PNG_BYTES })}\n${coverLine({ id: 'nope' })}\n`,
        'utf8',
      ),
    );

    expect(getSystemMediaCover(COVER_ID)).toBe(
      `data:image/png;base64,${PNG_BYTES}`,
    );

    stopWatchingSystemMedia();

    // A cover kept past the watcher would be handed to the next window as
    // though it were the song playing now.
    expect(getSystemMediaCover(COVER_ID)).toBeUndefined();
  });
});
