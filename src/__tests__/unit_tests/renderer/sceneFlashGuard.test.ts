/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FLASH_LIMIT_PER_SECOND,
  flashAllowance,
  flashBlend,
  flashLod,
} from '../../../renderer/graph/sceneFlashGuard';

/**
 * WCAG 2.3.1: a general flash is a pair of opposing changes of at least 10 %
 * of full relative luminance, and no more than three flashes may happen in any
 * one second. Three pairs are six swings — 0.6 of full scale in one second.
 */
const WCAG_SWING = 0.1;
const WCAG_FLASHES_PER_SECOND = 3;

describe('the brightness limiter', () => {
  it('stays below what three flashes a second need', () => {
    const needed = WCAG_SWING * 2 * WCAG_FLASHES_PER_SECOND;
    expect(FLASH_LIMIT_PER_SECOND).toBeLessThan(needed);
  });

  it('allows the same change per second at any frame rate', () => {
    const perSecond = (fps: number) => flashAllowance(1000 / fps) * fps;
    expect(perSecond(30)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
    expect(perSecond(60)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
    expect(perSecond(144)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
  });

  it('gives a stalled frame no more than a tenth of a second of change', () => {
    expect(flashAllowance(5000)).toBeCloseTo(flashAllowance(100), 9);
    expect(flashAllowance(-3)).toBe(0);
  });

  it('shows all of a gentle change and only part of a sudden one', () => {
    const allowance = flashAllowance(1000 / 60);
    // The control: a change inside the allowance passes untouched.
    expect(flashBlend(allowance / 2, allowance)).toBe(1);
    // A full white flash is spread over about two seconds.
    expect(flashBlend(1, allowance)).toBeCloseTo(allowance, 9);
    expect(flashBlend(-1, allowance)).toBeCloseTo(allowance, 9);
  });

  it('reads luminance from a level about a quarter of the frame across', () => {
    expect(2 ** flashLod(3840, 2160)).toBeCloseTo(3840 / 4, 6);
    expect(2 ** flashLod(400, 1200)).toBeCloseTo(1200 / 4, 6);
    expect(flashLod(2, 2)).toBe(0);
  });
});
