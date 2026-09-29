/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_FRAMING_NARROWEST,
  framedPanel,
  framedPoint,
  MAX_FRAMING_ASPECT,
  MIN_FRAMING_ASPECT,
  readSceneFraming,
  type ISceneFraming,
  type TFramingRect,
} from 'common/sceneFraming';
import type { ISceneFrame } from 'renderer/graph/sceneGl';
import { framedFrame } from 'renderer/graph/sceneFramingView';

/**
 * A scene keeps its important part in view on any shape of panel (Ivan,
 * 2026-09-28: "it needs to automatically move the scene so that important
 * part is on the view"): drawn at the same scale and slid, never squeezed,
 * and exactly as its author made it wherever the panel's shape needs nothing.
 */

const WHOLE: TFramingRect = [0, 0, 1, 1];
const AURORA: ISceneFraming = { focus: [0.8, 0.45], narrowest: 1.7778 };

describe("a scene's framing", () => {
  it('reads a focus and the shapes, held in range', () => {
    expect(
      readSceneFraming({ focus: [0.8, 0.45], narrowest: 1.7778, widest: 3 }),
    ).toEqual({ focus: [0.8, 0.45], narrowest: 1.7778, widest: 3 });
    expect(
      readSceneFraming({ focus: [-1, 7], narrowest: 0.01, widest: 99 }),
    ).toEqual({
      focus: [0, 1],
      narrowest: MIN_FRAMING_ASPECT,
      widest: MAX_FRAMING_ASPECT,
    });
    // No shape given: composed for 16:9; a widest not past it means nothing.
    expect(readSceneFraming({ focus: [0.5, 0.5], widest: 1.2 })).toEqual({
      focus: [0.5, 0.5],
      narrowest: DEFAULT_FRAMING_NARROWEST,
    });
  });

  it('is no framing at all without a usable focus', () => {
    expect(readSceneFraming(undefined)).toBeUndefined();
    expect(readSceneFraming({ focus: [0.5] })).toBeUndefined();
    expect(readSceneFraming({ focus: [0.5, 'top'] })).toBeUndefined();
    expect(readSceneFraming({ narrowest: 1 })).toBeUndefined();
  });

  it('leaves a panel of the shape it was composed for exactly as it is', () => {
    // 1280 by 720 is 1.77777..., the pack says 1.7778: the same shape.
    expect(framedPanel(WHOLE, 1280, 720, AURORA)).toBe(WHOLE);
    expect(framedPanel(WHOLE, 2560, 1080, AURORA)).toBe(WHOLE);
  });

  it('slides the picture across a tall panel so the focus is in view', () => {
    // The compact player: 480 by 1080. The picture keeps its height and is
    // 1920 wide; the panel sees a quarter of it, centred on x = 0.8.
    const picture = framedPanel(WHOLE, 480, 1080, AURORA);
    const [left, bottom, across, up] = picture;
    expect(across).toBeCloseTo((1.7778 * 1080) / 480, 6);
    expect(up).toBe(1);
    expect(bottom).toBe(0);
    const seen = 1 / across;
    expect(-left / across).toBeCloseTo(0.8 - seen / 2, 6);
    // The middle of the panel is the focus, in the picture's own uv.
    expect(framedPoint(WHOLE, picture, 0.5, 0.5)[0]).toBeCloseTo(0.8, 6);
  });

  it('stops at the picture’s edge rather than showing past it', () => {
    const edge = framedPanel(WHOLE, 480, 1080, {
      focus: [1, 0.5],
      narrowest: 16 / 9,
    });
    // The panel's right edge is the picture's right edge.
    expect(framedPoint(WHOLE, edge, 1, 0.5)[0]).toBeCloseTo(1, 6);
  });

  it('frames up and down only past a widest shape it was given', () => {
    const strip: ISceneFraming = { focus: [0.5, 0.2], narrowest: 1, widest: 2 };
    const picture = framedPanel(WHOLE, 3000, 500, strip);
    expect(picture[2]).toBe(1);
    expect(picture[3]).toBeCloseTo(3000 / 2 / 500, 6);
    expect(framedPoint(WHOLE, picture, 0.5, 0.5)[1]).toBeCloseTo(0.2, 6);
    // No widest, no framing up and down.
    expect(framedPanel(WHOLE, 3000, 500, AURORA)).toBe(WHOLE);
  });
});

describe('a frame as its framing draws it', () => {
  const frame = {
    framing: AURORA,
    pointer: [0.5, 0.5, 0, 1],
    tap: [0.5, 0.5, 0.2, 3],
    spectrumRect: [0, 1, 0, 1],
  } as unknown as ISceneFrame;

  it('gives the pointer, the tap and the wave’s band in the picture’s uv', () => {
    const framed = framedFrame(frame, 480, 1080);
    expect(framed.view).not.toBeUndefined();
    expect(framed.pointer?.[0]).toBeCloseTo(0.8, 6);
    expect(framed.tap?.[0]).toBeCloseTo(0.8, 6);
    // Presence and the tap's age are not places, and pass through.
    expect(framed.pointer?.[3]).toBe(1);
    expect(framed.tap?.slice(2)).toEqual([0.2, 3]);
    const [bandLeft, bandRight] = framed.spectrumRect ?? [];
    expect((bandRight ?? 0) - (bandLeft ?? 0)).toBeCloseTo(
      480 / (1.7778 * 1080),
      6,
    );
  });

  it('answers the same frame at the same size with the same object', () => {
    // A world's still lays down one prepared frame band by band, compared by
    // identity: a new object per band rendered the world again for each.
    const first = framedFrame(frame, 480, 1080);
    expect(framedFrame(frame, 480, 1080)).toBe(first);
    expect(framedFrame(frame, 400, 1080)).not.toBe(first);
  });

  it('is the frame itself where nothing needs framing', () => {
    expect(framedFrame(frame, 1920, 1080)).toBe(frame);
    const plain = { pointer: [0.5, 0.5, 0, 1] } as unknown as ISceneFrame;
    expect(framedFrame(plain, 480, 1080)).toBe(plain);
  });
});
