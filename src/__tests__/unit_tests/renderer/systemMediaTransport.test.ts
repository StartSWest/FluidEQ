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

import { act, renderHook } from '@testing-library/react';
import type { ISystemMediaSnapshot } from '../../../main/systemMedia';
import { resetPlaybackOwner } from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import { useSystemMediaSource } from '../../../renderer/audio/useSystemMediaSource';

describe('the transport for another Windows player', () => {
  const originalElectron = window.electron;
  let publishSnapshot:
    ((snapshot: ISystemMediaSnapshot | undefined) => void) | undefined;
  const sendSystemMediaCommand = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    resetPlaybackOwner();
    resetTransportSource();
    publishSnapshot = undefined;
    sendSystemMediaCommand.mockClear();
    window.electron = {
      ipcRenderer: {
        watchSystemMedia: () => Promise.resolve(),
        onSystemMedia: (
          listener: (snapshot: ISystemMediaSnapshot | undefined) => void,
        ) => {
          publishSnapshot = listener;
          return () => undefined;
        },
        sendSystemMediaCommand,
        sendMediaTransport: () => Promise.resolve(),
      },
    } as unknown as typeof window.electron;
  });

  afterEach(() => {
    window.electron = originalElectron;
    resetPlaybackOwner();
    resetTransportSource();
  });

  it('publishes Stop even when the session needs the rewind fallback', () => {
    const hook = renderHook(() => {
      useSystemMediaSource();
      return useTransportSources().system;
    });
    const snapshot: ISystemMediaSnapshot = {
      app: 'Spotify.exe',
      title: 'Song',
      artist: 'Band',
      isPlaying: true,
      positionMs: 12_000,
      durationMs: 180_000,
      canNext: true,
      canPrevious: true,
      canSeek: true,
    };

    act(() => publishSnapshot?.(snapshot));
    expect(hook.result.current?.stop).toEqual(expect.any(Function));

    act(() => hook.result.current?.stop?.());
    expect(sendSystemMediaCommand).toHaveBeenCalledWith('stop');

    hook.unmount();
  });
});
