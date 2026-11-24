/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The peaks, caps and marks of the standard looks on the white window (Ivan,
 * 2026-11-24: "some things I cannot see, like the peaks, they are white",
 * "in the full app I don't see the peaks of some of those standard viz").
 * The page's 2D views already drew their caps in the window's ink; the
 * engine's shaders, which draw the same looks in the main graph and the amp,
 * still wrote white: RTA, Notes and Energy's caps, Average's crest,
 * Loudness's needle, Phase's pip, Halo's ring, and the glosses and whitened
 * tips of the animated looks — on both renderers for those. Each rule is
 * held per renderer, every light-window case beside the dark window it must
 * leave as it was.
 */

import { getDefaultTuning } from '../../../../common/customLooks';
import type { TSceneViewStyle } from '../../../../common/graphSceneViews';
import { GRAPH_STYLES, type GraphStyle } from '../../../../common/graphStyles';
import { engineLookPack } from '../../../../renderer/graph/engineLooks/engineLooks';
import LOOK_GLSL from '../../../../renderer/graph/engineLooks/lookGlsl';
import drawSceneView, {
  createSceneViewState,
} from '../../../../renderer/graph/sceneViews/drawSceneView';
import {
  LIGHT_WINDOW_DEEPEN,
  markFill,
  sheenFill,
} from '../../../../renderer/graph/sceneViews/sceneFrame';
import { setLightWindow } from '../../../../renderer/utils/windowSide';

const ACCENT = '#00a5ae';

/** The views whose caps the 2D rows already drew in the window's ink. */
const CAPPED: readonly GraphStyle[] = [
  'rta',
  'notes',
  'energy',
  'average',
  'loudness',
  'phase',
];
const root = document.documentElement;

afterEach(() => {
  setLightWindow(false);
  root.style.removeProperty('--ink');
});

describe('a highlight laid over a figure, on the page', () => {
  it('is white at its own alpha on a dark window', () => {
    expect(sheenFill(0.45)).toBe('rgba(255, 255, 255, 0.450)');
  });

  it("deepens on a light window, as the look's highlights do there", () => {
    setLightWindow(true);
    expect(sheenFill(0.45)).toBe(
      `rgba(0, 0, 0, ${(0.45 * LIGHT_WINDOW_DEEPEN).toFixed(3)})`,
    );
  });
});

describe('a mark on the ground, on the page', () => {
  it('is white on a dark window', () => {
    expect(markFill(0.3)).toBe('rgba(255, 255, 255, 0.300)');
  });

  it("takes the window's ink on a light window", () => {
    root.style.setProperty('--ink', '#141414');
    setLightWindow(true);
    expect(markFill(0.3)).toMatch(/^rgba\(20, 20, 20, 0\.3/);
  });
});

describe("the engine's shaders", () => {
  // The Truss keeps its whites by design: road markings on dark asphalt,
  // light on the water, a daylight lamp; none of them lies on the floor.
  const shaders = GRAPH_STYLES.flatMap((style) => {
    const pack = style === 'truss' ? undefined : engineLookPack(style);
    return pack ? [[style, pack.source] as const] : [];
  });

  it('cover the looks this rule is about', () => {
    const styles = shaders.map(([style]) => style);
    [...CAPPED, 'halo', 'ledwall', 'echo', 'slope', 'ecg'].forEach((look) =>
      expect(styles).toContain(look),
    );
  });

  it.each(shaders)(
    '%s paints no fixed white over the plot',
    (_style, source) => {
      // A white mark or highlight goes through lookMark, lookSheen,
      // lookSpark or the window's ink, which all know the side.
      expect(source).not.toMatch(/lookPaint\(vec3\(1\.0\)/);
      expect(source).not.toMatch(/vec4\(vec3\(1\.0\), 1\.0\) \*/);
    },
  );

  it("paint the caps of the bar views in the window's ink", () => {
    CAPPED.forEach((style) => {
      expect(engineLookPack(style)?.source).toContain('lookPaint(uWindowInk,');
    });
  });

  it('branch every new helper on the side, and define it before use', () => {
    const at = (signature: string) => {
      const index = LOOK_GLSL.indexOf(signature);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(at('bool lookOnLight()')).toBeLessThan(at('vec4 lookSheen('));
    expect(at('vec4 lookPaint(')).toBeLessThan(at('vec4 lookMark('));
    const body = (name: string) =>
      LOOK_GLSL.slice(at(name), LOOK_GLSL.indexOf('}', at(name)));
    expect(body('vec4 lookSheen(')).toMatch(/lookOnLight\(\) \?/);
    expect(body('vec4 lookMark(')).toMatch(/lookOnLight\(\) \? uWindowInk/);
  });
});

/** Every colour a drawing set or put in a gradient, recorded. */
const recordingContext = () => {
  const colours: string[] = [];
  const gradient = () => ({
    addColorStop: (_at: number, colour: string) => colours.push(colour),
  });
  const target: Record<string, unknown> = {
    canvas: { width: 800, height: 400 },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => null,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  const context = new Proxy(target, {
    get: (object, key: string) =>
      key in object ? object[key] : () => undefined,
    set: (object, key: string, value: unknown) => {
      if (
        (key === 'fillStyle' || key === 'strokeStyle') &&
        typeof value === 'string'
      ) {
        colours.push(value);
      }
      object[key] = value;
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, colours };
};

/** The distinct whites, any alpha above nothing, among `colours`. */
const whites = (colours: readonly string[]): number =>
  new Set(
    colours.map((colour) => colour.trim()).filter((colour) => isWhite(colour)),
  ).size;

/** A white with any alpha above nothing. */
const isWhite = (colour: string): boolean => {
  const match = /^rgba\(255, ?255, ?255, ?([\d.]+)\)$/.exec(colour.trim());
  if (match) {
    return Number(match[1]) > 0;
  }
  return /^#fff(fff)?$/i.test(colour.trim()) || colour.trim() === 'white';
};

/**
 * The whites a look is allowed to keep on white: a tower's glass clearing
 * toward the floor, which is white there anyway. (The LED wall's lamp lens
 * is printed once on a canvas of its own, which jsdom does not give, so it
 * never reaches this recorder.)
 */
const KEPT: Partial<Record<TSceneViewStyle, number>> = {
  towers: 1,
};

const drawLoud = (style: TSceneViewStyle) => {
  const { context, colours } = recordingContext();
  const size = 48;
  const points = Array.from({ length: size }, (_, index) => ({
    x: 20 * 1000 ** (index / (size - 1)),
    y: 14 - Math.abs(index - size / 2) * 0.3,
  }));
  const columns = points.map((_, index) => [10 + index * 16, 0] as const);
  const tuning = { ...getDefaultTuning(style), accents: true };
  const state = createSceneViewState();
  for (let frame = 0; frame < 6; frame += 1) {
    drawSceneView({
      style,
      context,
      ratio: 1,
      plot: { left: 0, right: 800, top: 0, bottom: 400 },
      window: { width: 800, height: 400 },
      bands: [{ top: 0, bottom: 400, flipped: false, opacity: 1 }],
      deltaMs: 16,
      playing: true,
      points,
      live: points,
      columns,
      tuning,
      resolvedPalette: 'level',
      colours: [ACCENT, '#007780'],
      glow: 0,
      state,
    });
  }
  return colours;
};

const STYLES: TSceneViewStyle[] = [
  'halo',
  'ledwall',
  'fallblocks',
  'towers',
  'horizon',
  'ledbars',
  'bars3d',
  'bouncedots',
];

describe("the page's animated looks", () => {
  beforeAll(() => {
    // jsdom draws nothing; the looks only need the shape object to exist.
    if (typeof globalThis.Path2D === 'undefined') {
      const nothing = () => undefined;
      (globalThis as unknown as { Path2D: unknown }).Path2D = function Path2D(
        this: Record<string, () => undefined>,
      ) {
        [
          'addPath',
          'moveTo',
          'lineTo',
          'arc',
          'arcTo',
          'rect',
          'roundRect',
          'ellipse',
          'closePath',
          'bezierCurveTo',
          'quadraticCurveTo',
        ].forEach((method) => {
          this[method] = nothing;
        });
      };
    }
  });

  it.each(STYLES)('%s keeps its white highlights on a dark window', (style) => {
    // The control: the recorder sees the whites these looks are made of.
    expect(whites(drawLoud(style))).toBeGreaterThan(KEPT[style] ?? 0);
  });

  it.each(STYLES)('%s paints none of them white on a light window', (style) => {
    root.style.setProperty('--ink', '#141414');
    setLightWindow(true);
    expect(whites(drawLoud(style))).toBeLessThanOrEqual(KEPT[style] ?? 0);
  });
});
