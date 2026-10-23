/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The cached layers the DSP EQ graph and the phase meter draw from
 * (`canvasLayer.ts`), and the easing that keeps their animations at one speed
 * on a screen of any rate (`frameStep.ts`). A test DOM gives no canvas a
 * context, so the canvases here are recordings of what was asked of them.
 */
import { getEaseFactor } from '../../../common/smoothing';
import {
  ICanvasLayer,
  layCanvasLayer,
  prepareCanvasLayer,
} from '../../../renderer/dsp/canvasLayer';
import halfLifeOfFrameStep from '../../../renderer/utils/frameStep';

const recordedCanvas = (width: number, height: number) => {
  const calls: string[] = [];
  const canvas = { width, height };
  const context = {
    canvas,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    setTransform: (...args: number[]) =>
      calls.push(`setTransform ${args.join(',')}`),
    clearRect: (...args: number[]) => calls.push(`clearRect ${args.join(',')}`),
    drawImage: () => calls.push('drawImage'),
  } as unknown as CanvasRenderingContext2D;
  return { calls, canvas, context };
};

const recordedLayer = (): ICanvasLayer & { calls: string[] } => {
  const { calls, canvas, context } = recordedCanvas(1, 1);
  return {
    calls,
    canvas: canvas as unknown as HTMLCanvasElement,
    context,
    key: '',
  };
};

describe('a cached layer', () => {
  it('is drawn once and laid down on every frame', () => {
    const target = recordedCanvas(300, 150);
    const layer = recordedLayer();
    const draw = jest.fn();
    [1, 2, 3].forEach(() =>
      layCanvasLayer(target.context, layer, 'theme|300x150', 2, draw),
    );
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith(layer.context);
    expect(target.calls.filter((call) => call === 'drawImage')).toHaveLength(3);
  });

  it('is drawn again when what it shows changes', () => {
    const target = recordedCanvas(300, 150);
    const layer = recordedLayer();
    const draw = jest.fn();
    layCanvasLayer(target.context, layer, 'figure 0.50', 2, draw);
    layCanvasLayer(target.context, layer, 'figure 0.51', 2, draw);
    layCanvasLayer(target.context, layer, 'figure 0.51', 2, draw);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('is sized to its target in device pixels and drawn in CSS pixels', () => {
    const target = recordedCanvas(600, 300);
    const layer = recordedLayer();
    layCanvasLayer(target.context, layer, 'a', 2, () => undefined);
    expect([layer.canvas.width, layer.canvas.height]).toEqual([600, 300]);
    expect(layer.calls).toEqual([
      'setTransform 1,0,0,1,0,0',
      'clearRect 0,0,600,300',
      'setTransform 2,0,0,2,0,0',
    ]);
    // Laid down at the device-pixel origin, the target's transform kept.
    expect(target.calls).toEqual([
      'save',
      'setTransform 1,0,0,1,0,0',
      'drawImage',
      'restore',
    ]);
  });

  it('is resized only when the size changes', () => {
    // Setting either dimension reallocates a canvas and resets its state.
    let resized = 0;
    let width = 1;
    let height = 1;
    const layer = recordedLayer();
    Object.defineProperty(layer, 'canvas', {
      value: {
        get width() {
          return width;
        },
        set width(next: number) {
          resized += 1;
          width = next;
        },
        get height() {
          return height;
        },
        set height(next: number) {
          resized += 1;
          height = next;
        },
      },
    });
    prepareCanvasLayer(layer, 40, 20, 1);
    expect(resized).toBe(2);
    prepareCanvasLayer(layer, 40, 20, 1);
    prepareCanvasLayer(layer, 40, 20, 2);
    expect(resized).toBe(2);
    prepareCanvasLayer(layer, 80, 20, 1);
    expect(resized).toBe(4);
  });

  it('without a layer, draws on the target itself', () => {
    const target = recordedCanvas(300, 150);
    const draw = jest.fn();
    layCanvasLayer(target.context, undefined, 'a', 1, draw);
    layCanvasLayer(target.context, undefined, 'a', 1, draw);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenCalledWith(target.context);
    expect(target.calls).not.toContain('drawImage');
  });
});

describe('an easing tuned a frame at a time', () => {
  it('moves its tuned step in one frame of a 60 Hz screen', () => {
    [0.02, 0.05, 0.09, 0.12].forEach((step) => {
      expect(getEaseFactor(1000 / 60, halfLifeOfFrameStep(step))).toBeCloseTo(
        step,
        9,
      );
    });
  });

  it('moves as far in a sixtieth of a second on a 240 Hz screen', () => {
    const halfLife = halfLifeOfFrameStep(0.05);
    const each = getEaseFactor(1000 / 240, halfLife);
    expect(1 - (1 - each) ** 4).toBeCloseTo(0.05, 9);
    // Control: counted in frames, as it was, four 240 Hz frames go too far.
    expect(1 - (1 - 0.05) ** 4).toBeGreaterThan(0.18);
  });
});
