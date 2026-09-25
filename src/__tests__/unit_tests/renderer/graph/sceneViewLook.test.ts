/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The drawn scenes obey the style editor (Ivan, 2026-09-24: "those new viz
 * are not following the ... edit style setting and colors"). What each scene
 * does with a setting is a picture and is checked on screen; what reaches
 * every scene — which colours, laid which way, how many pieces, how wide,
 * held how long — is one reading of the look, held here.
 */

import {
  DEFAULT_LEVEL_COLOURS,
  DEFAULT_SIGNAL_COLOUR,
  getDefaultTuning,
  type ILookTuning,
} from 'common/customLooks';
import { SCENE_OWN_COLOURS } from 'common/graphSceneViews';
import { BAND_SPECTRUM_HEX } from '../../../../renderer/utils/bandColors';
import {
  sceneColours,
  sceneLook,
} from '../../../../renderer/graph/sceneViews/drawSceneView';
import {
  HEAT_STEPS,
  heatStep,
  inkGroups,
  inkPosition,
  type ISceneFrame,
  type ISceneLook,
} from '../../../../renderer/graph/sceneViews/sceneFrame';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
} from '../../../../renderer/graph/sceneViews/scenePieces';

const tuned = (changes: Partial<ILookTuning>): ILookTuning => ({
  ...getDefaultTuning('ledbars'),
  ...changes,
});

describe("a scene's colours", () => {
  it("are the look's own whenever it has any, on every palette", () => {
    const mine = ['#123456', '#abcdef'];
    expect(sceneColours('ledbars', 'auto', 'level', mine)).toBe(mine);
    expect(sceneColours('tide', 'rainbow', 'rainbow', mine)).toBe(mine);
  });

  it("are the scene's own on Auto, as the real thing is coloured", () => {
    expect(sceneColours('ledwall', 'auto', 'level', [])).toBe(
      SCENE_OWN_COLOURS.ledwall,
    );
    expect(sceneColours('silkwaves', 'auto', 'level', [])).toBe(
      SCENE_OWN_COLOURS.silkwaves,
    );
  });

  it("are the palette's own when a palette is chosen by name", () => {
    // The positive control for the Auto case above: the same scene, asked
    // for a palette by name, stops painting itself in its own colours.
    expect(sceneColours('ledwall', 'rainbow', 'rainbow', [])).toBe(
      BAND_SPECTRUM_HEX,
    );
    expect(sceneColours('ledwall', 'signal', 'signal', [])).toEqual([
      DEFAULT_SIGNAL_COLOUR,
    ]);
    expect(sceneColours('ledwall', 'heat', 'heat', [])).toBe(
      DEFAULT_LEVEL_COLOURS,
    );
    // The halo has no colours of its own: on Auto it is its palette's.
    expect(sceneColours('halo', 'auto', 'rainbow', [])).toBe(BAND_SPECTRUM_HEX);
  });
});

describe('the style editor, as a scene reads it', () => {
  it('lays the colours the way the palette says', () => {
    const inkOf = (palette: 'signal' | 'rainbow' | 'level' | 'heat') =>
      sceneLook(getDefaultTuning('ledbars'), palette).ink;
    expect(inkOf('signal')).toBe('flat');
    expect(inkOf('rainbow')).toBe('frequency');
    expect(inkOf('level')).toBe('level');
    expect(inkOf('heat')).toBe('heat');
  });

  it('carries pieces, gap, fill, opacity, line width and lit peaks', () => {
    const look = sceneLook(
      tuned({
        columns: 24,
        gap: 0.5,
        filled: false,
        fillOpacity: 0.4,
        strokeWidth: 3,
        accents: false,
      }),
      'level',
    );
    expect(look).toMatchObject({
      pieces: 24,
      gap: 0.5,
      filled: false,
      opacity: 0.4,
      lineWidth: 3,
      accents: false,
    });
  });

  it('prints a texture only in a filled body', () => {
    expect(sceneLook(tuned({ texture: 'hatch' }), 'level').textured).toBe(true);
    expect(
      sceneLook(tuned({ texture: 'hatch', filled: false }), 'level').textured,
    ).toBe(false);
    expect(sceneLook(tuned({ texture: 'none' }), 'level').textured).toBe(false);
  });

  it('opens the scenes solid, so their own light and shade is untouched', () => {
    (
      ['ledwall', 'towers', 'ledbars', 'neonbars', 'spectrumwave'] as const
    ).forEach((style) => expect(getDefaultTuning(style).fillOpacity).toBe(1));
  });

  it('colours a point by where it is, how high it is, or not at all', () => {
    expect(inkPosition('frequency', 0.2, 0.9)).toBe(0.2);
    expect(inkPosition('level', 0.2, 0.9)).toBe(0.9);
    expect(inkPosition('heat', 0.2, 0.9)).toBe(0.9);
    expect(inkPosition('flat', 0.2, 0.9)).toBe(0.5);
    expect(inkGroups('level', 17)).toBe(17);
    expect(inkGroups('heat', 17)).toBe(HEAT_STEPS);
    expect(inkGroups('frequency', 17)).toBe(1);
    expect(heatStep(0)).toBe(0);
    expect(heatStep(1)).toBe(HEAT_STEPS - 1);
  });
});

/** A frame 600 px wide whose reading rises steadily to the right. */
const frameWith = (look: Partial<ISceneLook>): ISceneFrame => {
  const count = 61;
  const xs = new Float64Array(count);
  const levels = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    xs[index] = index * 10;
    levels[index] = index / (count - 1);
  }
  return {
    plot: { left: 0, top: 0, right: 600, bottom: 200 },
    xs,
    levels,
    look: {
      ink: 'level',
      pieces: 30,
      gap: 0.25,
      filled: true,
      opacity: 1,
      lineWidth: 2,
      accents: true,
      textured: false,
      ...look,
    },
  } as unknown as ISceneFrame;
};

describe('a row of pieces', () => {
  it('has the pieces the look asks for, and the gap it asks for', () => {
    const row = layPieces(
      frameWith({ pieces: 24, gap: 0.5 }),
      createPieceRow(),
      4,
    );
    expect(row.count).toBe(24);
    expect(row.pitch).toBeCloseTo(25);
    expect(row.body).toBeCloseTo(12.5);
    // Centred in its pitch.
    expect(row.lefts[0]).toBeCloseTo(6.25);
  });

  it('takes fewer pieces rather than pieces too small to read', () => {
    const row = layPieces(frameWith({ pieces: 160 }), createPieceRow(), 10);
    expect(row.count).toBe(60);
  });

  it('reads the loudest thing under each piece', () => {
    const row = layPieces(frameWith({ pieces: 10 }), createPieceRow(), 4);
    // The reading rises to the right, so each piece reads its right edge.
    expect(row.levels[0]).toBeCloseTo(0.1);
    expect(row.levels[9]).toBeCloseTo(1);
    expect(row.levels[4]).toBeGreaterThan(row.levels[3]);
  });
});

describe('a held peak', () => {
  it('rises at once, holds, then falls at a steady rate', () => {
    const hold = createPeakHold();
    const loud = new Float64Array([0.8]);
    const quiet = new Float64Array([0.1]);
    holdPeaks(hold, loud, 1, 16);
    expect(hold.held[0]).toBeCloseTo(0.8);
    // Held while it waits…
    expect(holdPeaks(hold, quiet, 1, 400)).toBe(false);
    expect(hold.held[0]).toBeCloseTo(0.8);
    // …then falling, and saying so, so the drawing keeps going until it lands.
    expect(holdPeaks(hold, quiet, 1, 100)).toBe(true);
    expect(hold.held[0]).toBeLessThan(0.8);
    expect(hold.held[0]).toBeGreaterThan(0.1);
  });
});
