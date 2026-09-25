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
import { useDeckAudio } from 'renderer/library/player/useDeckAudio';

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
