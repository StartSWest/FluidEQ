/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { buildSongIdentity } from 'common/songIdentity';
import type { ISongSoundNow } from 'renderer/audio/songSoundSession';
import AutoEqSaveHalf, { saveHalfOf } from 'renderer/eq/autoEq/AutoEqSaveHalf';

// Ivan, 2026-11-26: "saved only for 5 s show then it back to normal until
// user modifies something on song sound", in the face of the half beside it.

const identity = buildSongIdentity('library', 'a', 'Song A', 'Artist');
if (!identity) {
  throw new Error('the fixture names no song');
}
const playingSaved: ISongSoundNow = {
  identity,
  owner: 'song',
  isPlaying: true,
  canSave: false,
  isChanged: false,
};

/** An animation's end, named, as the element's own. */
const animationEnd = (element: Element, animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  act(() => {
    element.dispatchEvent(event);
  });
};

describe('Auto EQ button: the Save half', () => {
  it('says Saved only for the moment after a save, then nothing until a change', () => {
    expect(saveHalfOf(playingSaved, true, false, true)).toBe('saved');
    // Its moment over, the main half's Song says it all.
    expect(saveHalfOf(playingSaved, true, false, false)).toBeUndefined();
    // A change brings Save back.
    expect(
      saveHalfOf({ ...playingSaved, isChanged: true }, true, false, false),
    ).toBe('saveChanges');
  });

  it('ends Saved at the end of its own hold, and not at a child’s animation', () => {
    const onSavedShown = jest.fn();
    render(
      <AutoEqSaveHalf
        save="saved"
        title="Song A"
        moment={1}
        onSavedShown={onSavedShown}
      />,
    );
    const saved = screen.getByRole('status');
    // The words fading in when Saved swaps in end first: not the hold.
    animationEnd(saved, 'fade-in');
    expect(onSavedShown).not.toHaveBeenCalled();
    animationEnd(saved, 'eq-auto-saved-hold');
    expect(onSavedShown).toHaveBeenCalledTimes(1);
  });
});
