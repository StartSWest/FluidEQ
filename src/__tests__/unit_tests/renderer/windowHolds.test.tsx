/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The page's holds on its window (`useWindowHold.ts`, `WindowHolds.tsx`):
 * what main is told keeps a window in the tray loaded, and when.
 */
import { act, render } from '@testing-library/react';
import { WINDOW_HOLD_CHANNEL } from '../../../common/windowHold';
import type { ILibraryPlayerView } from '../../../common/library/playerWire';
import { NO_PLAYER_VIEW } from '../../../common/library/playerWire';
import {
  announceWindowHolds,
  holdWindow,
  resetWindowHolds,
  useWindowHold,
} from '../../../renderer/shell/useWindowHold';
import WindowHolds from '../../../renderer/shell/WindowHolds';
import useMakerJobControls from '../../../renderer/karaoke/useMakerJobControls';

let mockOwner: string | undefined;
let mockView: ILibraryPlayerView = NO_PLAYER_VIEW;

jest.mock('../../../renderer/audio/playbackOwner', () => ({
  usePlaybackOwner: () => mockOwner,
}));
jest.mock('../../../renderer/library/player/corePlayer', () => ({
  useCorePlayerView: () => mockView,
}));

const originalElectron = window.electron;
const sendMessage = jest.fn();

/** What the page told main, in order: the hold reports only. */
const told = () =>
  sendMessage.mock.calls
    .filter(([channel]) => channel === WINDOW_HOLD_CHANNEL)
    .map(([, [holds]]) => holds as string[]);

/** The microtask the holds are told in. */
const settle = () => act(() => Promise.resolve());

beforeEach(() => {
  resetWindowHolds();
  sendMessage.mockReset();
  mockOwner = undefined;
  mockView = NO_PLAYER_VIEW;
  window.electron = {
    ipcRenderer: { sendMessage },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  window.electron = originalElectron;
});

describe('the register', () => {
  it('says nothing before the page’s first word, then the whole set', async () => {
    holdWindow('maker');
    await settle();
    expect(told()).toEqual([]);

    announceWindowHolds();
    await settle();
    expect(told()).toEqual([['maker']]);
  });

  it('counts: two of a kind hold until both have ended', async () => {
    announceWindowHolds();
    const split = holdWindow('maker');
    const words = holdWindow('maker');
    await settle();
    split();
    split();
    await settle();
    expect(told()).toEqual([['maker']]);
    words();
    await settle();
    expect(told()).toEqual([['maker'], []]);
  });

  it('tells main after everything else the same turn sent', async () => {
    // A hold ends in a cleanup, before the same commit's new effects send
    // what the ending work leaves behind; told first, main could let the page
    // go with that still unsent.
    announceWindowHolds();
    const release = holdWindow('player');
    await settle();
    sendMessage.mockClear();

    release();
    sendMessage('session-saved', []);
    await settle();
    expect(sendMessage.mock.calls.map(([channel]) => channel)).toEqual([
      'session-saved',
      WINDOW_HOLD_CHANNEL,
    ]);
  });

  it('tells a changed set once, however many changes the turn made', async () => {
    announceWindowHolds();
    await settle();
    const one = holdWindow('player');
    one();
    holdWindow('maker');
    await settle();
    expect(told()).toEqual([[], ['maker']]);
  });
});

describe('the window’s own holds', () => {
  it('holds while a web player or Karaoke plays', async () => {
    const { rerender } = render(<WindowHolds />);
    await settle();
    expect(told()).toEqual([[]]);

    mockOwner = 'karaoke';
    rerender(<WindowHolds />);
    await settle();
    mockOwner = 'library';
    rerender(<WindowHolds />);
    await settle();
    expect(told()).toEqual([[], ['player'], []]);
  });

  it('holds while the Library plays in the page, and never for its host', async () => {
    const { rerender } = render(<WindowHolds />);
    mockView = { ...NO_PLAYER_VIEW, deck: 'window', isPlaying: true };
    rerender(<WindowHolds />);
    await settle();
    expect(told()).toEqual([['library-window']]);

    // On the host main plays it, and gives the engine its rack back when it
    // stops (`sourceAnalysis.ts`): nothing of the page's is needed.
    mockView = {
      ...NO_PLAYER_VIEW,
      deck: 'host',
      isPlaying: true,
      libraryGate: { libraryAudible: true, librarySourceReady: false },
    };
    rerender(<WindowHolds />);
    await settle();
    expect(told()).toEqual([['library-window'], []]);

    // Paused on the window's own element holds nothing either.
    mockView = { ...NO_PLAYER_VIEW, deck: 'window', isPlaying: true };
    rerender(<WindowHolds />);
    await settle();
    mockView = { ...NO_PLAYER_VIEW, deck: 'window', isPlaying: false };
    rerender(<WindowHolds />);
    await settle();
    expect(told()).toEqual([['library-window'], [], ['library-window'], []]);
  });

  it('holds while the Maker’s models work, which run in this page', async () => {
    const Maker = ({ isSeparating }: { isSeparating: boolean }) => {
      useMakerJobControls({
        cancelSeparation: () => undefined,
        cancelAnalysis: () => undefined,
        setAnalysisError: () => undefined,
        setAnalysisRetry: () => undefined,
        runBasicPitch: () => Promise.resolve(),
        runWhisper: () => Promise.resolve(),
        isSeparating,
        analysisProgress: undefined,
        onModelWorkChange: () => undefined,
      });
      return null;
    };
    announceWindowHolds();
    const { rerender } = render(<Maker isSeparating={false} />);
    await settle();
    rerender(<Maker isSeparating />);
    await settle();
    rerender(<Maker isSeparating={false} />);
    await settle();
    expect(told()).toEqual([[], ['maker'], []]);
  });

  it('lets a hook hold the window for as long as it is active', async () => {
    const Maker = ({ isWorking }: { isWorking: boolean }) => {
      useWindowHold('maker', isWorking);
      return null;
    };
    announceWindowHolds();
    const { rerender, unmount } = render(<Maker isWorking />);
    await settle();
    rerender(<Maker isWorking={false} />);
    await settle();
    rerender(<Maker isWorking />);
    await settle();
    unmount();
    await settle();
    expect(told()).toEqual([['maker'], [], ['maker'], []]);
  });
});
