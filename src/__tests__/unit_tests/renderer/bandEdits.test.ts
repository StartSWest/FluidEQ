/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which bands a band's own gain fader moves, and what reaches the engine.
 *
 * A fader used to move "the selection" whatever band it belonged to, so a
 * fader turned without a press on its band first — the wheel over it, the
 * arrow keys after Tab, a screen reader setting its value — moved the band
 * that happened to be selected, or nothing at all. And its write was worked
 * out against a store its own preview had already moved, so the last of two
 * quick steps looked like no change and never reached the engine. The
 * first-steps video's restore hit both: two bands set back to 0 dB stayed
 * boosted, and then one stayed at +0.3.
 */
import {
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  MAX_GAIN,
} from 'common/constants';
import {
  bandGainEdits,
  bandGainWrite,
  groupEdits,
  groupWrite,
} from 'renderer/eq/bandEdits';

const band = (
  id: string,
  frequency: number,
  gain: number,
  type = FilterTypeEnum.PK,
): IFilter => ({ id, frequency, gain, type, quality: 1.41 });

const rack = (...bands: IFilter[]): IFiltersMap =>
  Object.fromEntries(bands.map((b) => [b.id, b]));

const low = band('low', 100, 2);
const mid = band('mid', 1500, 0);
const high = band('high', 3900, -3);
const cut = band('cut', 30, 0, FilterTypeEnum.HPQ);
const filters = rack(low, mid, high, cut);

describe("a band's own gain fader", () => {
  it('moves its band when nothing is selected', () => {
    expect(bandGainEdits(filters, undefined, [], 'high', 0)).toEqual([
      { id: 'high', gain: 0 },
    ]);
  });

  it('previews nothing where the band already is', () => {
    expect(bandGainEdits(filters, undefined, [], 'mid', 0)).toEqual([]);
  });

  it('still tells the engine a value the preview already shows', () => {
    // The store has drawn `mid` at 0 while the write for that step waited.
    expect(bandGainWrite(filters, undefined, [], 'mid', 0)).toEqual([
      { id: 'mid', gain: 0 },
    ]);
    expect(bandGainWrite(filters, high, ['low', 'high'], 'high', -3)).toEqual([
      { id: 'low', gain: 2 },
      { id: 'high', gain: -3 },
    ]);
  });

  it('writes its own band, not the one that is selected', () => {
    expect(bandGainWrite(filters, low, ['low'], 'high', 1.5)).toEqual([
      { id: 'high', gain: 1.5 },
    ]);
  });

  it('moves its own band, not the one that is selected', () => {
    expect(bandGainEdits(filters, low, ['low'], 'high', 1.5)).toEqual([
      { id: 'high', gain: 1.5 },
    ]);
  });

  it('moves the whole selection by its step when its band is part of it', () => {
    // `high` goes from -3 to 0: every selected band moves the same 3 dB.
    expect(
      bandGainEdits(filters, low, ['low', 'mid', 'high'], 'high', 0),
    ).toEqual([
      { id: 'low', gain: 5 },
      { id: 'mid', gain: 3 },
      { id: 'high', gain: 0 },
    ]);
  });

  it('stops a lone band at the end of the range', () => {
    expect(bandGainEdits(filters, undefined, [], 'low', 40)).toEqual([
      { id: 'low', gain: MAX_GAIN },
    ]);
  });

  it('leaves a band with no gain alone, and a band that is not there', () => {
    expect(bandGainEdits(filters, undefined, [], 'cut', 6)).toEqual([]);
    expect(bandGainEdits(filters, undefined, [], 'gone', 6)).toEqual([]);
  });
});

describe('a group edit', () => {
  it('moves only the primary band when the primary is not in the selection', () => {
    expect(groupEdits(filters, mid, ['low'], 'frequency', 2000)).toEqual([
      { id: 'mid', frequency: 2000 },
    ]);
  });

  it('has nothing to move without a primary band', () => {
    expect(groupEdits(filters, undefined, ['low'], 'gain', 4)).toEqual([]);
    expect(groupWrite(filters, undefined, ['low'], 'gain', 4)).toEqual([]);
  });

  it('keeps a band stopped at the end of the range in its write', () => {
    // `top` is at the ceiling: the step moves `low` alone in the store, and
    // the write still names `top`, or it would replace the waiting write
    // that carried `top` up there.
    const top = band('top', 8000, MAX_GAIN);
    const withTop = rack(low, top);
    expect(groupEdits(withTop, low, ['low', 'top'], 'gain', 3)).toEqual([
      { id: 'low', gain: 3 },
    ]);
    expect(groupWrite(withTop, low, ['low', 'top'], 'gain', 3)).toEqual([
      { id: 'low', gain: 3 },
      { id: 'top', gain: MAX_GAIN },
    ]);
  });
});
