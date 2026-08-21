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
 * The register of players, and which of them counts as "the last thing".
 *
 * The bar on a tab that is not a player is whatever was last used, and the
 * one player this app does not own must never be it: a browser tab paused an
 * hour ago is not what somebody is about to resume.
 */

import { act, renderHook } from '@testing-library/react';
import { buildSongIdentity } from 'common/songIdentity';
import {
  clearTransportSource,
  resetTransportSource,
  setTransportSource,
  useLastPlayingOwner,
  useLastTransportOwner,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import type { ITransportSource } from '../../../renderer/audio/transportSource';
import type { TPlaybackOwner } from '../../../renderer/audio/playbackOwner';

const source = (
  owner: TPlaybackOwner,
  isPlaying = false,
): ITransportSource => ({
  owner,
  title: `${owner} title`,
  isPlaying,
  positionMs: 0,
  durationMs: 1000,
  toggle: () => {},
});

const librarySongA = buildSongIdentity('library', 'a', 'Song A');
const librarySongB = buildSongIdentity('library', 'b', 'Song B');
const spotifySong = buildSongIdentity('system', 'Spotify.exe', 'Song B');
if (!librarySongA || !librarySongB || !spotifySong) {
  throw new Error('test fixtures produced no identity');
}

/** `source` above, with a song attached — what `lastPlayingOwner` actually
 * reads to decide whether a pause is still on the same track. */
const playing = (
  owner: TPlaybackOwner,
  isPlaying: boolean,
  identity: NonNullable<ITransportSource['identity']>,
): ITransportSource => ({ ...source(owner, isPlaying), identity });

describe('the register of players', () => {
  beforeEach(() => {
    resetTransportSource();
  });

  afterEach(() => {
    resetTransportSource();
  });

  it('remembers the last of this app’s own players', () => {
    const { result } = renderHook(() => useLastTransportOwner());

    act(() => setTransportSource(source('library')));
    act(() => setTransportSource(source('karaoke')));

    expect(result.current).toBe('karaoke');
  });

  it('never lets the machine’s own player become the last thing', () => {
    const { result } = renderHook(() => ({
      last: useLastTransportOwner(),
      sources: useTransportSources(),
    }));

    act(() => setTransportSource(source('library')));
    // A browser tab starts, takes the bar by playing, and then stops. What is
    // left on a tab with no player of its own has to be the library song.
    act(() => setTransportSource(source('system', true)));
    act(() => setTransportSource(source('system', false)));

    expect(result.current.sources.system).toBeDefined();
    expect(result.current.last).toBe('library');
  });

  it('forgets a player that has gone', () => {
    const { result } = renderHook(() => useTransportSources());

    act(() => setTransportSource(source('library')));
    act(() => clearTransportSource('library'));

    expect(result.current.library).toBeUndefined();
  });

  it('remembers who last actually played, across their own pause', () => {
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));

    expect(result.current).toBe('library');
  });

  it('does not let a player who has since been superseded stay "last playing" forever', () => {
    // The bug this guards: an ownership-release tracker only updates when
    // its OWN owner releases, so a library track paused once resolved every
    // later Spotify pause to the same stale library song forever, because
    // `system` never participates in that ownership scheme at all. Tracking
    // "who last reported isPlaying: true" instead means anyone starting to
    // play — `system` included — overwrites the previous answer on its own.
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    expect(result.current).toBe('library');

    act(() => setTransportSource(playing('system', true, spotifySong)));
    act(() => setTransportSource(playing('system', false, spotifySong)));

    expect(result.current).toBe('system');
  });

  it('drops a player once it cues something else without playing it', () => {
    // The same-track guard: describing a newly cued track while paused is
    // not "still paused on the song that was playing", and reporting it as
    // such would leak a stale identity into whatever reads this.
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    expect(result.current).toBe('library');

    act(() => setTransportSource(playing('library', false, librarySongB)));

    expect(result.current).toBeUndefined();
  });

  it('forgets who last played once that player is gone entirely', () => {
    const { result } = renderHook(() => useLastPlayingOwner());

    act(() => setTransportSource(playing('library', true, librarySongA)));
    act(() => setTransportSource(playing('library', false, librarySongA)));
    act(() => clearTransportSource('library'));

    expect(result.current).toBeUndefined();
  });
});
