/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a measuring view's key stands: along the bottom of the plot, where
 * the controls laid over the top of the player's visualizer cannot cover it,
 * and nowhere at all where the view plays behind the equaliser's curve.
 */

import type { IAnalysisFrame } from '../../../../renderer/graph/analysis/analysisFrame';
import { paintLegend } from '../../../../renderer/graph/analysis/channelInk';
import {
  isSameLegendPlace,
  noteLegendFrame,
  takeLegendFrame,
} from '../../../../renderer/graph/analysis/legendPlace';

/** A canvas that writes down every chip it is asked to round and every word. */
const recordingContext = () => {
  const chips: { y: number; height: number }[] = [];
  const words: string[] = [];
  const context = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    measureText: (label: string) => ({ width: label.length * 6 }),
    roundRect: (_x: number, y: number, _w: number, height: number) => {
      chips.push({ y, height });
    },
    fillText: (label: string) => {
      words.push(label);
    },
  };
  return { context, chips, words };
};

const frameOn = (context: unknown, keyed: boolean): IAnalysisFrame =>
  ({
    context,
    keyed,
    plot: { left: 0, top: 44, right: 600, bottom: 300 },
    band: { top: 44, bottom: 300, flipped: false, opacity: 1 },
  }) as unknown as IAnalysisFrame;

const ENTRIES = [
  { label: 'Live', ink: '#ff9900' },
  { label: 'Peak', ink: '#ffffff' },
];

describe("a measuring view's key", () => {
  it('stands along the bottom of the plot, clear of its floor lettering', () => {
    const { context, chips, words } = recordingContext();

    paintLegend(frameOn(context, true), ENTRIES);

    expect(words).toEqual(['Live', 'Peak']);
    // The first rounded shape is the chip behind the words.
    const [chip] = chips;
    // In the bottom half: the top of the plot is where the player's strip of
    // controls lives, and the key sat under the view picker's name there.
    expect(chip.y).toBeGreaterThan((44 + 300) / 2);
    // Ending twenty pixels above the floor, where the note spectrum's Cs and
    // the energy view's band names are printed.
    expect(chip.y + chip.height).toBe(300 - 20);
  });

  it('is left out where the view plays behind another drawing', () => {
    const { context, chips, words } = recordingContext();

    paintLegend(frameOn(context, false), ENTRIES);

    expect(words).toEqual([]);
    expect(chips).toEqual([]);
  });
});

/**
 * Where the key was painted is noted for the band labels, which keep off it
 * (`legendPlace.ts`): a bass band's label below its dot sat on the key and
 * hid half of it. A frame that clears the canvas starts afresh; one that
 * draws over the last keeps what was there.
 */
describe('the key’s place, for the band labels', () => {
  it('is the chip the key was painted in, on the frame that painted it', () => {
    const { context, chips } = recordingContext();
    const canvas = {};
    Object.assign(context, { canvas });
    noteLegendFrame(canvas);
    paintLegend(frameOn(context, true), ENTRIES);
    const [chip] = chips;
    const frame = takeLegendFrame(canvas);
    expect(frame?.place).toMatchObject({
      x: 10,
      y: chip.y,
      height: chip.height,
    });
    expect(frame?.place?.width).toBeGreaterThan(0);
  });

  it('is gone after a frame that cleared the canvas and painted no key', () => {
    const { context } = recordingContext();
    const canvas = {};
    Object.assign(context, { canvas });
    noteLegendFrame(canvas);
    paintLegend(frameOn(context, false), ENTRIES);
    expect(takeLegendFrame(canvas)).toEqual({});
  });

  it('says nothing for a frame that drew over the last one', () => {
    const canvas = {};
    expect(takeLegendFrame(canvas)).toBeUndefined();
  });

  it('counts a place moved by less than a pixel as the same place', () => {
    const place = { x: 10, y: 259, width: 140.2, height: 21 };
    expect(isSameLegendPlace(place, { ...place, width: 140.4 })).toBe(true);
    expect(isSameLegendPlace(place, { ...place, width: 160 })).toBe(false);
    expect(isSameLegendPlace(place, undefined)).toBe(false);
    expect(isSameLegendPlace(undefined, undefined)).toBe(true);
  });
});
