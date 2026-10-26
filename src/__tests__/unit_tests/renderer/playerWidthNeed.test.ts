/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp's one width rises to what its rows need on one line (Ivan,
 * 2026-10-25: "make sure all controls never break line, they will just push
 * the app min width so they all fit on any res"): each row says its own, the
 * widest is what the window is told, and a row that goes withdraws its say.
 */

const needPlayerWidth = jest.fn();

jest.mock('renderer/player/windowModeStore', () => ({
  needPlayerWidth: (width: number) => needPlayerWidth(width),
  holdPlayerHeight: () => undefined,
  resizePlayerWindow: () => Promise.resolve(),
}));

// eslint-disable-next-line import/first
import { setPlayerWidthNeed } from 'renderer/player/playerLayout';

beforeEach(() => {
  setPlayerWidthNeed('soundHead', undefined);
  setPlayerWidthNeed('soundTabs', undefined);
  setPlayerWidthNeed('soundFoot', undefined);
  setPlayerWidthNeed('shelfTabs', undefined);
  needPlayerWidth.mockClear();
});

describe('what the amp’s width rises to', () => {
  it('is the widest of the rows that have a say', () => {
    setPlayerWidthNeed('soundHead', 452);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(452);
    setPlayerWidthNeed('shelfTabs', 488.4);
    // Whole pixels, rounded up: a window a fraction narrower than a row is
    // a row cut by a fraction.
    expect(needPlayerWidth).toHaveBeenLastCalledWith(489);
    setPlayerWidthNeed('soundFoot', 520);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(520);
    // A narrower row beside a wider one changes nothing.
    setPlayerWidthNeed('soundTabs', 300);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(520);
  });

  it('lets a row withdraw its say, and asks for nothing when none is left', () => {
    setPlayerWidthNeed('soundFoot', 520);
    setPlayerWidthNeed('shelfTabs', 489);
    setPlayerWidthNeed('soundFoot', undefined);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(489);
    setPlayerWidthNeed('shelfTabs', undefined);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(0);
  });

  it('treats nothing, zero and nonsense as no say', () => {
    setPlayerWidthNeed('soundTabs', 0);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(0);
    setPlayerWidthNeed('soundTabs', Number.NaN);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(0);
    setPlayerWidthNeed('soundTabs', -12);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(0);
    setPlayerWidthNeed('soundTabs', Number.POSITIVE_INFINITY);
    expect(needPlayerWidth).toHaveBeenLastCalledWith(0);
  });
});
