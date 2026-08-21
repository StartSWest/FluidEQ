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
import {
  clearTransportSource,
  resetTransportSource,
  setTransportSource,
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
});
