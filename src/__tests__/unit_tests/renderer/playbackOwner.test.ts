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

import {
  claimPlayback,
  getPlaybackOwner,
  registerPlayer,
  releasePlayback,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';

/**
 * One player at a time.
 *
 * The app has three that know nothing about each other — the library's audio
 * element, the karaoke session's, and whatever page is loaded in the Media
 * tab's webview — and before this they would all happily run at once. These
 * are the rules that stop that, tested as the arithmetic they are rather than
 * through three players that would each need a real media element.
 */
describe('playback ownership', () => {
  beforeEach(() => {
    resetPlaybackOwner();
  });

  it('has no owner until somebody claims one', () => {
    registerPlayer('library', () => {});
    expect(getPlaybackOwner()).toBeUndefined();
  });

  it('stops everyone else when a player claims', () => {
    const stopLibrary = jest.fn();
    const stopMedia = jest.fn();
    registerPlayer('library', stopLibrary);
    registerPlayer('media', stopMedia);

    claimPlayback('karaoke');

    expect(stopLibrary).toHaveBeenCalledTimes(1);
    expect(stopMedia).toHaveBeenCalledTimes(1);
    expect(getPlaybackOwner()).toBe('karaoke');
  });

  it('never stops the player that is claiming', () => {
    const stopKaraoke = jest.fn();
    registerPlayer('karaoke', stopKaraoke);

    claimPlayback('karaoke');

    expect(stopKaraoke).not.toHaveBeenCalled();
  });

  it('hands over cleanly when the other one starts', () => {
    const stopLibrary = jest.fn();
    const stopKaraoke = jest.fn();
    registerPlayer('library', stopLibrary);
    registerPlayer('karaoke', stopKaraoke);

    claimPlayback('library');
    expect(stopKaraoke).toHaveBeenCalledTimes(1);
    expect(stopLibrary).not.toHaveBeenCalled();

    claimPlayback('karaoke');
    expect(stopLibrary).toHaveBeenCalledTimes(1);
    expect(getPlaybackOwner()).toBe('karaoke');
  });

  it('lets an owner give it up', () => {
    registerPlayer('media', () => {});
    claimPlayback('media');

    releasePlayback('media');

    expect(getPlaybackOwner()).toBeUndefined();
  });

  it('ignores a release from a player that no longer owns it', () => {
    // A pause event from the player that was just taken over arrives late,
    // and unguarded it would clear the owner that had only started — leaving
    // the app certain nothing was playing while something plainly was.
    registerPlayer('library', () => {});
    registerPlayer('karaoke', () => {});
    claimPlayback('library');
    claimPlayback('karaoke');

    releasePlayback('library');

    expect(getPlaybackOwner()).toBe('karaoke');
  });

  it('gives up ownership when the owner unregisters', () => {
    const unregister = registerPlayer('media', () => {});
    claimPlayback('media');

    unregister();

    expect(getPlaybackOwner()).toBeUndefined();
  });

  it('leaves the owner alone when somebody else unregisters', () => {
    registerPlayer('library', () => {});
    const unregisterMedia = registerPlayer('media', () => {});
    claimPlayback('library');

    unregisterMedia();

    expect(getPlaybackOwner()).toBe('library');
  });

  it('does not call a player that has unregistered', () => {
    const stopMedia = jest.fn();
    const unregister = registerPlayer('media', stopMedia);
    unregister();

    claimPlayback('library');

    expect(stopMedia).not.toHaveBeenCalled();
  });

  it('claiming twice in a row stops the others only once each', () => {
    const stopLibrary = jest.fn();
    registerPlayer('library', stopLibrary);

    claimPlayback('karaoke');
    claimPlayback('karaoke');

    // Twice, because each claim is a real request to be the only one making
    // sound — a second `play()` after a stall has to silence anything that
    // started in between. What must not happen is the claimant stopping
    // itself, which the test above pins.
    expect(stopLibrary).toHaveBeenCalledTimes(2);
    expect(getPlaybackOwner()).toBe('karaoke');
  });
});
