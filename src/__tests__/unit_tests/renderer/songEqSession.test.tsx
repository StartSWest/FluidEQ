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
 * covered by `songEqRecorder.test.ts`'s reducer cases. Nothing here re-proves
 * those. What only this file can catch is the wiring itself: that the host
 * actually dispatches what the reducer expects — including the automatic
 * mode going on and off, which nothing else reports — and that a matched
 * layer mirrored into `FluidEqContext` survives its own round trip rather
 * than being mistaken for somebody else's edit.
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import type { ISongEqEntry } from 'common/songEq';
import { buildSongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
} from 'common/songEqRecorder';
import * as api from 'renderer/utils/equalizerApi';
import { useNowPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  forgetCurrentSongEq,
  getSongEqSaveOn,
  noteSmartEqWrite,
  resetSongEqSession,
  setSongEqSaveOn,
  undoSongEqLoan,
  useSongEqNotice,
  useSongEqRecording,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';
import { setSmartEqMode } from 'renderer/utils/smartEqMode';

jest.mock('renderer/utils/equalizerApi');
jest.mock('renderer/audio/nowPlayingIdentity');

const mockUseNowPlayingIdentity = useNowPlayingIdentity as jest.Mock;

/**
 * Switch an automatic mode on, the way the toolbar's own menu does — picking
 * one starts it, see `setSmartEqMode`.
 *
 * Every test that expects saving to be possible needs this: saving files the
 * layer an automatic mode refines, so the reducer refuses to turn it on
 * without one. `'smart'` is the one-shot, which is how these tests say "no
 * automatic mode running".
 */
const startAutoEq = () => setSmartEqMode('detail');

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
  // state — mutated either by the shell's own `setSmartEq` call (mirroring a
  // matched layer) or directly by the test (a stand-in for some other
  // panel's edit), then carried into context fresh on the next `rerender()`.
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
    // The mode is module state too, and it is remembered — a test that left
    // an automatic mode running would hand the next one a save switch the
    // reducer accepts, which is precisely the condition under test.
    setSmartEqMode('smart');
    // Module state outlives a render — see `resetSongEqSession`'s own
    // comment — so every test starts from a session-free, notice-free,
    // save-off module rather than whatever the previous test left behind.
    resetSongEqSession();
    jest.clearAllMocks();
    contextSmartEq = undefined;
    setSmartEqSpy = jest.fn((next?: ISmartEqSettings) => {
      contextSmartEq = next;
    });
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: undefined,
      isPlaying: false,
    });
    // Every background write this shell fires resolves by default; a test
    // that cares about a failure overrides its own mock.
    (api.setSmartEq as jest.Mock).mockResolvedValue(undefined);
    (api.checkpointSongEq as jest.Mock).mockResolvedValue(undefined);
    (api.commitSongEq as jest.Mock).mockResolvedValue(undefined);
    (api.forgetSongEq as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => setSmartEqMode('smart'));
  });

  /**
   * The null half and its positive control in one test, because apart they
   * are indistinguishable: a refusal proves nothing unless the same call
   * succeeds once the missing condition is supplied.
   *
   * What it guards is the reported bug. `setSongEqSaveOn` used to START a
   * continuous mode when ticked on — which was silently a no-op whenever a
   * continuous mode was already the one CHOSEN but switched off, exactly the
   * state a real window was found in (`smartEqMode` = `balance`,
   * `continuousEq` = `false`). Saving went on, no loop ran, and nothing was
   * ever committed.
   */
  it('turns saving on only while an automatic mode is running', () => {
    setSongEqSaveOn(true);
    expect(getSongEqSaveOn()).toBe(false);

    startAutoEq();
    renderHook(() => useSongEqSessionHost(), { wrapper });
    act(() => {
      setSongEqSaveOn(true);
    });
    expect(getSongEqSaveOn()).toBe(true);

    act(() => {
      setSongEqSaveOn(false);
    });
    expect(getSongEqSaveOn()).toBe(false);
  });

  /**
   * Fails if the shell stops reporting `autoEqChanged`, or reports it only in
   * one direction: saving would then survive an automatic mode being switched
   * on again and promise a save for the first song of a run that has measured
   * nothing yet.
   */
  it('starts saving from off each time an automatic mode is switched on', () => {
    startAutoEq();
    renderHook(() => useSongEqSessionHost(), { wrapper });
    act(() => {
      setSongEqSaveOn(true);
    });
    // The positive control: without this the assertion below would pass
    // against a store where saving simply never turns on at all.
    expect(getSongEqSaveOn()).toBe(true);

    act(() => {
      setSmartEqMode('smart');
    });
    expect(getSongEqSaveOn()).toBe(false);

    act(() => {
      startAutoEq();
    });
    expect(getSongEqSaveOn()).toBe(false);
  });

  /**
   * The end-to-end the whole report was about: with an automatic mode running
   * and the switch on, a song past the two-minute floor is checkpointed while
   * it plays and committed when it ends.
   *
   * Fails on any break in the chain — the switch being refused, the layer
   * never reaching `liveLayer`, or the commit at close being skipped.
   */
  it('checkpoints and commits a song once saving is on behind a running mode', async () => {
    const song = buildSongIdentity('library', 'saved-song', 'Saved', 'Artist');
    const nextSong = buildSongIdentity(
      'library',
      'saved-song-next',
      'Next Song',
      'Artist',
    );
    if (!song || !nextSong) {
      throw new Error('test fixture produced no identity');
    }
    // A live layer to record — without one, `willSongEqSave` never reaches
    // true regardless of the save switch.
    contextSmartEq = layerOf(2);
    (api.lookupSongEq as jest.Mock).mockResolvedValue(undefined);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    startAutoEq();
    const { rerender } = renderHook(() => useSongEqSessionHost(), { wrapper });
    act(() => {
      setSongEqSaveOn(true);
    });

    await act(async () => {
      jest.advanceTimersByTime(
        SONG_EQ_MIN_LISTENED_MS + SONG_EQ_SETTLE_MS + 2000,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.checkpointSongEq).toHaveBeenCalled();

    // A different song closes the first, which is when the commit that
    // counts the play fires.
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: nextSong,
      isPlaying: true,
    });
    act(() => {
      rerender();
    });
    expect(api.commitSongEq).toHaveBeenCalled();
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
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

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

  /** The positive control beside the test above: a lookup that DOES find
   * something must raise a notice naming that song. Without this, the null
   * result above would pass equally well against a `useSongEqNotice` wired
   * to return `undefined` unconditionally. */
  it('raises a notice naming the song when a lookup finds one', async () => {
    const song = buildSongIdentity(
      'library',
      'remembered-song',
      'Remembered Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    const entry = entryOf('Remembered Song', layerOf(4));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

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

    expect(result.current).toEqual({ identity: song, entry });
  });

  it('keeps the loan through its own write landing back in context', async () => {
    const song = buildSongIdentity(
      'library',
      'echo-song',
      'Echo Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    // Distinguishable from "cleared": Undo restoring `layerOf(1)` proves it
    // restored what was actually there before the match, not merely that it
    // called `setSmartEq` with something.
    contextSmartEq = layerOf(1);
    const entry = entryOf('Echo Song', layerOf(3));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

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
    // the host observe it come back through `smartEq`.
    rerender();

    act(() => {
      undoSongEqLoan();
    });

    // Undo only ever produces a write when a loan is still on record, and it
    // restores the exact pre-match layer — proof the reducer's `isSameLayer`
    // recognised the mirrored write as this session's own rather than
    // dropping the loan on it.
    expect(api.setSmartEq).toHaveBeenLastCalledWith(layerOf(1));
  });

  /** The positive control beside the test above: a layer change that is NOT
   * this session's own write must still drop the loan, so pressing Undo
   * afterwards does nothing. Without this beside it, "the loan survived"
   * above would be indistinguishable from "nothing here can ever drop a
   * loan". */
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
    contextSmartEq = layerOf(1);
    const entry = entryOf('Foreign Song', layerOf(3));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

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
    // through `setSmartEqSpy`, since this is specifically NOT this session's
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

  /**
   * The loan has to survive the continuous engine refining the curve it
   * loaned, or the end-of-song restore never runs and the borrowed curve
   * equalises the next song.
   *
   * Fails if `noteSmartEqWrite` stops dispatching `ownWrite` (make it a
   * no-op, or delete the call in `SmartEqEngine.tsx`): the refined layer
   * arriving through context is then indistinguishable from a preset load,
   * the loan is dropped, and the close produces no restoring write — the
   * last `setSmartEq` stays the refinement rather than the pre-match layer.
   */
  it('hands the loan back at the end of a song the engine kept refining', async () => {
    const song = buildSongIdentity(
      'library',
      'refined-song',
      'Refined Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    // Distinguishable from every other layer in this test, so the final
    // assertion can only pass by restoring the actual pre-match value.
    contextSmartEq = layerOf(1);
    const entry = entryOf('Refined Song', layerOf(3));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    const { rerender } = renderHook(() => useSongEqSessionHost(), { wrapper });

    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_SETTLE_MS + 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender();

    // The continuous engine writes a refinement, exactly as `SmartEqEngine`
    // does: announce it, mirror it into context, then let the host see it.
    const refined = layerOf(6);
    act(() => {
      noteSmartEqWrite(refined);
    });
    contextSmartEq = refined;
    rerender();

    // The song ends.
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: undefined,
      isPlaying: false,
    });
    act(() => {
      rerender();
    });

    expect(api.setSmartEq).toHaveBeenLastCalledWith(layerOf(1));
  });

  it('forgets the notice-named song over IPC and clears the notice', async () => {
    const song = buildSongIdentity(
      'library',
      'forget-song',
      'Forget Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    const entry = entryOf('Forget Song', layerOf(5));
    (api.lookupSongEq as jest.Mock).mockResolvedValue(entry);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

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
    expect(result.current).toEqual({ identity: song, entry });

    act(() => {
      forgetCurrentSongEq();
    });

    // The whole identity, so main can resolve it through the alias index the
    // way a lookup does — a bare key deletes nothing when the curve was
    // learned from another source.
    expect(api.forgetSongEq).toHaveBeenCalledWith('device-a', song);
    expect(result.current).toBeUndefined();
  });

  /**
   * `willSongEqSave` folds `forgotten` in, rather than leaving it as a
   * separate check `close` and `advance` each restated — the exact drift
   * finding 3 (`willSave` reimplementing the rule) warned about, recreated
   * by finding 6 (`forget`) the moment the two lived apart again.
   */
  it('stops promising a save once the current song has been forgotten', async () => {
    const song = buildSongIdentity(
      'library',
      'forgotten-badge-song',
      'Forgotten Badge Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    // A live layer past the floor, saving on — `willSave` has every reason
    // to answer true, until forgetting is asked to override it.
    contextSmartEq = layerOf(2);
    (api.lookupSongEq as jest.Mock).mockResolvedValue(undefined);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    startAutoEq();
    const { result } = renderHook(
      () => {
        useSongEqSessionHost();
        return useSongEqRecording();
      },
      { wrapper },
    );
    // After the host is mounted, not before: the reducer only accepts saving
    // once the host has reported the mode running.
    act(() => {
      setSongEqSaveOn(true);
    });

    await act(async () => {
      jest.advanceTimersByTime(
        SONG_EQ_MIN_LISTENED_MS + SONG_EQ_SETTLE_MS + 2000,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    // Positive control: this is what the bug would have kept showing.
    expect(result.current.willSave).toBe(true);

    act(() => {
      forgetCurrentSongEq();
    });

    expect(result.current.willSave).toBe(false);
  });
});
