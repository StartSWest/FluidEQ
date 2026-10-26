/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The share card in the window's colours (Ivan, 2026-10-25: "no rainbow
 * colors make more modern like the app is now", "change it to score or
 * something"). jsdom has no canvas, so the card is drawn into a context
 * that records what it is told.
 */

import { artworkFilter, drawShareCard } from 'renderer/components/shareCardArt';
import { LAGOON, setRainbowStops } from 'renderer/utils/rainbowPalette';

/** The five colours the card used to be drawn in, whatever the window. */
const OLD_SPECTRUM = ['#00e5ff', '#54ff8a', '#ffe66d', '#ff3cac', '#8b5cff'];

interface IRecording {
  texts: string[];
  colours: string[];
  filters: string[];
}

/** A 2D context that keeps every text, colour and filter it is handed. */
const recordingCanvas = (): {
  canvas: HTMLCanvasElement;
  recording: IRecording;
} => {
  const recording: IRecording = { texts: [], colours: [], filters: [] };
  const gradient = () => ({
    addColorStop: (_offset: number, colour: string) => {
      recording.colours.push(colour);
    },
  });
  const state: Record<string | symbol, unknown> = {};
  const context = new Proxy(state, {
    get: (target, key) => {
      switch (key) {
        case 'fillText':
          return (text: string) => recording.texts.push(text);
        case 'measureText':
          return (text: string) => ({ width: text.length * 10 });
        case 'createLinearGradient':
        case 'createRadialGradient':
          return gradient;
        default:
          return key in target ? target[key] : () => undefined;
      }
    },
    set: (target, key, value) => {
      if (
        (key === 'fillStyle' ||
          key === 'strokeStyle' ||
          key === 'shadowColor') &&
        typeof value === 'string'
      ) {
        recording.colours.push(value);
      }
      if (key === 'filter') {
        recording.filters.push(String(value));
      }
      Reflect.set(target, key, value);
      return true;
    },
  });
  const canvas = document.createElement('canvas');
  jest
    .spyOn(canvas, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return { canvas, recording };
};

const setAccent = (accent: string, light: string) => {
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-light', light);
};

describe('the share card', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    setRainbowStops(undefined);
    jest.restoreAllMocks();
  });

  it('is about the score, and names no rainbow', () => {
    const { canvas, recording } = recordingCanvas();
    drawShareCard(canvas, 176, 2, 'https://fluideq.com', true, undefined);
    expect(recording.texts).toEqual(
      expect.arrayContaining(['SCORE', '176', '×2', 'STREAK', 'fluideq.com']),
    );
    expect(recording.texts.join(' ')).not.toMatch(/rainbow/i);
  });

  it('is drawn in the window’s accent', () => {
    setAccent('#e0b04a', '#ffe2a0');
    const { canvas, recording } = recordingCanvas();
    drawShareCard(canvas, 90, 3, 'https://fluideq.com', false, undefined);
    expect(recording.colours).toContain('#e0b04a');
    expect(recording.colours).toContain('#ffe2a0');
  });

  it('carries the palette Colourful mode is in, and never the old spectrum', () => {
    const gold = [
      '#ffd2b2',
      '#ffb472',
      '#f0b64c',
      '#d0b83b',
      '#a8b630',
      '#7bb442',
      '#44b866',
    ];
    setRainbowStops(gold);
    const { canvas, recording } = recordingCanvas();
    drawShareCard(canvas, 90, 10, 'https://fluideq.com', true, undefined);
    expect(recording.colours).toEqual(
      expect.arrayContaining([gold[0], gold[2], gold[4], gold[6]]),
    );
    OLD_SPECTRUM.forEach((colour) => {
      expect(recording.colours).not.toContain(colour);
    });
  });

  it('keeps Lagoon’s run out of a card drawn with the mode off', () => {
    const { canvas, recording } = recordingCanvas();
    drawShareCard(canvas, 90, 3, 'https://fluideq.com', false, undefined);
    expect(recording.colours).not.toContain(LAGOON[6]);
  });

  it('turns the artwork to the window’s colour when it has it', () => {
    setAccent('#e0b04a', '#ffe2a0');
    const { canvas, recording } = recordingCanvas();
    const artwork = document.createElement('img');
    drawShareCard(canvas, 90, 3, 'https://fluideq.com', false, artwork);
    expect(recording.filters).toEqual([artworkFilter('#e0b04a')]);
  });
});

describe('the artwork’s turn', () => {
  it('leaves the cyan it was painted for alone', () => {
    expect(artworkFilter('#32e1eb')).toBe('none');
  });

  it('turns it round the wheel to the accent', () => {
    // #e0b04a sits at 41° in HSL, the artwork's cyan at 183°.
    expect(artworkFilter('#e0b04a')).toBe('hue-rotate(-142deg)');
  });

  it('drains it on a monochrome window, where any hue would be a guess', () => {
    expect(artworkFilter('#d8dadc')).toBe('grayscale(1)');
  });

  it('draws it as painted when the accent cannot be read', () => {
    expect(artworkFilter('color-mix(in srgb, red, blue)')).toBe('none');
  });
});
