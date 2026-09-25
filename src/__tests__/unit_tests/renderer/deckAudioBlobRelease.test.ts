/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The blob behind a deck, when the Library's player goes away.
 *
 * The provider is unmounted whenever nothing on screen uses it and nothing
 * plays (`useIdlePlayerMount`), and its teardown emptied the decks without
 * revoking the object URL the paused track was playing from: the whole file,
 * pinned for the rest of the session, once per visit.
 */

import { act, renderHook } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { useDeckAudio } from 'renderer/library/player/useDeckAudio';

/**
 * Every timer this replaced would still be pending here. A helper, so the
 * check can run after each test without being an `expect` in a hook.
 */
const expectNothingScheduled = () => expect(jest.getTimerCount()).toBe(0);

// The fade itself is the audio clock's, and none runs here: the crossfade
// below is about what the player does around it.
jest.mock('renderer/dsp/deckCrossfade', () => ({
  ...jest.requireActual('renderer/dsp/deckCrossfade'),
  scheduleDspDeckCrossfade: () => true,
  selectDspDeck: () => undefined,
}));

const URL_OF_BLOB = 'blob:fluideq/track';
const revokeObjectURL = jest.fn();

beforeEach(() => {
  revokeObjectURL.mockClear();
  // jsdom implements neither.
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: () => URL_OF_BLOB },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

/** A deck that is playing, so a finished swap would start it again. */
const playingDeck = () => {
  const deck = new Audio();
  Object.defineProperty(deck, 'paused', { configurable: true, value: false });
  const play = jest.fn(() => Promise.resolve());
  Object.defineProperty(deck, 'play', { configurable: true, value: play });
  return { deck, play };
};

const swapped = () => {
  const view = renderHook(() =>
    useDeckAudio({ trackIdRef: { current: 'track' } }),
  );
  const { deck, play } = playingDeck();
  act(() =>
    view.result.current.swapBufferToBlob(deck, 'track', new ArrayBuffer(4)),
  );
  expect(deck.getAttribute('src')).toBe(URL_OF_BLOB);
  return { view, deck, play };
};

it('finishes a swap while the player is there', () => {
  // The control for the case below: the swap's metadata listener is live.
  const { deck, play } = swapped();
  deck.dispatchEvent(new Event('loadedmetadata'));
  expect(play).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).not.toHaveBeenCalled();
});

it('revokes the blob and takes the waiting swap off the deck when the player goes', () => {
  const { view, deck, play } = swapped();
  view.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith(URL_OF_BLOB);
  deck.dispatchEvent(new Event('loadedmetadata'));
  expect(play).not.toHaveBeenCalled();
});

/**
 * The crossfade's clean-up: the outgoing deck let go once the incoming one's
 * playhead has played the fade's length — its own clock, the one the fade
 * runs on — and not on a timer. A report short of the end keeps both (the
 * null, with nothing scheduled — the timer this replaced fails it); the one
 * that reaches the end lets the outgoing deck go (the positive control).
 */
describe('a crossfade', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    expectNothingScheduled();
    jest.useRealTimers();
  });

  const crossfading = () => {
    const view = renderHook(() =>
      useDeckAudio({ trackIdRef: { current: 'track' } }),
    );
    const outgoing = new Audio();
    const pause = jest.fn();
    Object.defineProperty(outgoing, 'pause', { value: pause });
    const incoming = new Audio();
    let playhead = 10;
    Object.defineProperty(incoming, 'currentTime', {
      configurable: true,
      get: () => playhead,
    });
    const onFinished = jest.fn();
    act(() =>
      view.result.current.startCrossfade(
        outgoing,
        incoming,
        4000,
        'equalPower',
        DSP_DEFAULTS.crossfade.shape,
        onFinished,
      ),
    );
    const reach = (seconds: number) => {
      playhead = seconds;
      incoming.dispatchEvent(new Event('timeupdate'));
    };
    return { pause, onFinished, reach, incoming };
  };

  it('lets the outgoing deck go once the incoming one has played the fade', () => {
    const { pause, onFinished, reach } = crossfading();
    act(() => jest.advanceTimersByTime(60_000));
    reach(13.9);
    expect(pause).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();

    reach(14);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('lets it go when the incoming track ends before the fade does', () => {
    const { pause, onFinished, incoming } = crossfading();
    incoming.dispatchEvent(new Event('ended'));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
