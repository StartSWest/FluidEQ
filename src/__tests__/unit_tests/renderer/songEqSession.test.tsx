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
 * The shell's own wiring, thin on purpose.
 *
 * Every rule about when a song is recorded, saved or restored is already
 * covered by `songEqRecorder.test.ts`'s seventeen cases against the pure
 * reducer. Nothing here re-proves those. What only this file can catch is
 * the wiring itself: that the host actually dispatches what the reducer
 * expects, and — the one behaviour that lives ENTIRELY in this module and
 * nowhere else — that the shell recognises the echo of its own write to
 * `FluidEqContext` and does not mistake it for somebody else's edit.
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import type { ISongEqEntry } from 'common/songEq';
import { buildSongIdentity } from 'common/songIdentity';
import { SONG_EQ_SETTLE_MS } from 'common/songEqRecorder';
import * as api from 'renderer/utils/equalizerApi';
import { useNowPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  getSongEqSaveOn,
  setSongEqSaveOn,
  undoSongEqLoan,
  useSongEqNotice,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';

jest.mock('renderer/utils/equalizerApi');
jest.mock('renderer/audio/nowPlayingIdentity');

const mockUseNowPlayingIdentity = useNowPlayingIdentity as jest.Mock;

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const entryOf = (title: string, settings: ISmartEqSettings): ISongEqEntry => ({
  settings,
  title,
  plays: 1,
  updatedAt: 0,
});

describe('songEqSession', () => {
  // Stands in for the live `smartEq` a real FluidEqProvider would hold in
  // state — mutated either by the shell's own `setSmartEq` call (the echo) or
  // directly by the test (a stand-in for some other panel's edit), then
  // carried into context fresh on the next `rerender()`.
  let contextSmartEq: ISmartEqSettings | undefined;
  let setSmartEqSpy: jest.Mock;

  const wrapper = ({ children }: { children: ReactNode }) => {
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      activeDeviceId: 'device-a',
      smartEq: contextSmartEq,
      setSmartEq: setSmartEqSpy,
    };
    return (
      <FluidEqProviderWrapper value={context}>
        {children}
      </FluidEqProviderWrapper>
    );
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setSongEqSaveOn(false);
    jest.clearAllMocks();
    contextSmartEq = undefined;
    setSmartEqSpy = jest.fn((next?: ISmartEqSettings) => {
      contextSmartEq = next;
    });
    mockUseNowPlayingIdentity.mockReturnValue(undefined);
    // Every background write this shell fires resolves by default; a test
    // that cares about a failure overrides its own mock.
    (api.setSmartEq as jest.Mock).mockResolvedValue(undefined);
    (api.checkpointSongEq as jest.Mock).mockResolvedValue(undefined);
    (api.commitSongEq as jest.Mock).mockResolvedValue(undefined);
    (api.forgetSongEq as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('remembers the save toggle without a component mounted', () => {
    setSongEqSaveOn(true);
    expect(getSongEqSaveOn()).toBe(true);
    setSongEqSaveOn(false);
    expect(getSongEqSaveOn()).toBe(false);
  });

  it('raises no notice for a song nothing is remembered about', async () => {
    const song = buildSongIdentity(
      'library',
      'unknown-song',
      'Song A',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    (api.lookupSongEq as jest.Mock).mockResolvedValue(undefined);
    mockUseNowPlayingIdentity.mockReturnValue(song);

    const { result } = renderHook(
      () => {
        useSongEqSessionHost();
        return useSongEqNotice();
      },
      { wrapper },
    );

    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_SETTLE_MS + 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.lookupSongEq).toHaveBeenCalledWith('device-a', song);
    expect(result.current).toBeUndefined();
  });

  /**
   * The one behaviour only this file can catch.
   *
   * `reduceSongEq`'s own `isSameLayer` guard would in fact also keep this
   * particular loan alive, because the value mirrored into context is the
   * exact object this module just wrote — so this test cannot prove the
   * shell's `expectedEcho` tracking is the thing standing between the loan
   * and being dropped; the reducer's field-wise comparison would do that on
   * its own here too. What it DOES prove, end to end, is that applying a
   * matched layer survives its own round trip through context and that Undo
   * still restores the pre-match layer afterwards — a regression either in
   * the shell's wiring or in the reducer's guard turns this red.
   */
  it('keeps the loan through the echo of its own write', async () => {
    const song = buildSongIdentity(
      'library',
      'echo-song',
      'Echo Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    const entry = entryOf('Echo Song', layerOf(3));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue(song);

    const { rerender } = renderHook(() => useSongEqSessionHost(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_SETTLE_MS + 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The match applied the stored layer through context, exactly as
    // ActiveLayers and SmartEqEngine do for every other Smart EQ write.
    expect(setSmartEqSpy).toHaveBeenCalledWith(entry.settings);

    // `contextSmartEq` now holds the applied layer; rerendering is what lets
    // the host observe it come back through `smartEq` — the echo.
    rerender();

    act(() => {
      undoSongEqLoan();
    });

    // Undo only ever produces a write when a loan is still on record. Seeing
    // one here, restoring the layer from before the match (nothing, in this
    // test), is what proves the echo did not get mistaken for someone else's
    // edit and drop it first.
    expect(api.setSmartEq).toHaveBeenLastCalledWith(undefined);
  });

  /** The positive control beside the test above: a layer change that is NOT
   * this module's own write must still drop the loan, so pressing Undo
   * afterwards does nothing. Without this beside it, "the loan survived"
   * above would be indistinguishable from "nothing this module does can ever
   * drop a loan". */
  it('drops the loan when the layer changes for a reason that is not its own write', async () => {
    const song = buildSongIdentity(
      'library',
      'foreign-song',
      'Foreign Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    const entry = entryOf('Foreign Song', layerOf(3));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue(song);

    const { rerender } = renderHook(() => useSongEqSessionHost(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_SETTLE_MS + 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender();

    const callsAfterMatch = (api.setSmartEq as jest.Mock).mock.calls.length;

    // Somebody else — a preset load, the "Clear" chip — changes the layer
    // out from under the loan. Set directly on the stand-in rather than
    // through `setSmartEqSpy`, since this is specifically NOT this module's
    // own write.
    contextSmartEq = layerOf(9);
    rerender();

    act(() => {
      undoSongEqLoan();
    });

    // The loan was already gone, so Undo has nothing to restore.
    expect((api.setSmartEq as jest.Mock).mock.calls.length).toBe(
      callsAfterMatch,
    );
  });
});
