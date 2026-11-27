/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The share card, "Signature" (Ivan, 2026-11-27): the header's brand, the
 * score, the pet mid-jump, all in the window's colours, in the reader's
 * language, with no shadow anywhere. jsdom has no canvas, so the card is
 * drawn into a context that records what it is told.
 */

import type { Dictionary, LocaleCode } from 'common/i18n';
import deLook from 'common/i18n/de/look';
import enLook from 'common/i18n/en/look';
import esLook from 'common/i18n/es/look';
import frLook from 'common/i18n/fr/look';
import hiLook from 'common/i18n/hi/look';
import itLook from 'common/i18n/it/look';
import jaLook from 'common/i18n/ja/look';
import koLook from 'common/i18n/ko/look';
import ptLook from 'common/i18n/pt/look';
import ruLook from 'common/i18n/ru/look';
import zhHantLook from 'common/i18n/zh-Hant/look';
import zhLook from 'common/i18n/zh/look';
import {
  drawShareCard,
  type IShareCardWords,
} from 'renderer/components/shareCardArt';
import { LAGOON, setRainbowStops } from 'renderer/utils/rainbowPalette';

/** The five colours the card used to be drawn in, whatever the window. */
const OLD_SPECTRUM = ['#00e5ff', '#54ff8a', '#ffe66d', '#ff3cac', '#8b5cff'];

/**
 * Each language's part of the dictionary that holds the card's words — that
 * part alone, because loading every whole dictionary cost this file 45 s. A
 * Record over every locale, so a language added without its line here fails
 * to compile.
 */
const CARD_WORDS: Record<LocaleCode, Partial<Dictionary>> = {
  en: enLook,
  es: esLook,
  pt: ptLook,
  fr: frLook,
  de: deLook,
  it: itLook,
  ru: ruLook,
  zh: zhLook,
  'zh-Hant': zhHantLook,
  ja: jaLook,
  ko: koLook,
  hi: hiLook,
};

const ENGLISH: IShareCardWords = {
  scoreLabel: 'Beat my Fluid score',
  streak: 'streak',
  tagline: 'Free EQ for Windows, macOS and Linux',
};

interface IRecording {
  texts: string[];
  colours: string[];
  filters: string[];
  fonts: { font: string; text: string }[];
  /** Every property set that would cast a shadow, by name. */
  shadows: string[];
}

/** A 2D context that keeps every text, colour, font and filter it is handed. */
const recordingCanvas = (): {
  canvas: HTMLCanvasElement;
  recording: IRecording;
  context: CanvasRenderingContext2D;
} => {
  const recording: IRecording = {
    texts: [],
    colours: [],
    filters: [],
    fonts: [],
    shadows: [],
  };
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
          return (text: string) => {
            recording.texts.push(text);
            recording.fonts.push({ font: String(target.font), text });
          };
        case 'measureText':
          return (text: string) => ({
            width:
              text.length * (parseFloat(String(target.font).split(' ')[1]) / 2),
          });
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createConicGradient':
          return gradient;
        default:
          return key in target ? target[key] : () => undefined;
      }
    },
    set: (target, key, value) => {
      if (
        (key === 'fillStyle' || key === 'strokeStyle') &&
        typeof value === 'string'
      ) {
        recording.colours.push(value);
      }
      if (key === 'filter') {
        recording.filters.push(String(value));
      }
      if (
        typeof key === 'string' &&
        key.startsWith('shadow') &&
        value !== 0 &&
        value !== 'transparent'
      ) {
        recording.shadows.push(key);
      }
      Reflect.set(target, key, value);
      return true;
    },
  });
  const canvas = document.createElement('canvas');
  jest
    .spyOn(canvas, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return {
    canvas,
    recording,
    context: context as unknown as CanvasRenderingContext2D,
  };
};

const draw = (
  score: number,
  multiplier: number,
  euphoric: boolean,
  words: IShareCardWords = ENGLISH,
) => {
  const recorded = recordingCanvas();
  drawShareCard(
    recorded.canvas,
    score,
    multiplier,
    'https://fluideq.com',
    euphoric,
    words,
  );
  return recorded.recording;
};

/** The px size of the font the last `text` was set in. */
const sizeOf = (recording: IRecording, text: string): number => {
  const drawn = recording.fonts.filter((entry) => entry.text === text).pop();
  return drawn ? parseFloat(drawn.font.split(' ')[1]) : NaN;
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

  it('is about the score: the challenge, the number, the streak and where to get the app', () => {
    const recording = draw(176, 2, true);
    expect(recording.texts).toEqual(
      expect.arrayContaining([
        'Beat my Fluid score',
        '176',
        '×2',
        'streak',
        'Free EQ for Windows, macOS and Linux',
        'fluideq.com',
      ]),
    );
    expect(recording.texts.join(' ')).not.toMatch(/rainbow/i);
  });

  it('draws the words it is handed, so a reader in another language reads their own', () => {
    const recording = draw(176, 2, false, {
      scoreLabel: 'Schlagen Sie mein Fluid-Ergebnis',
      streak: 'Serie',
      tagline: 'Kostenloser EQ für Windows, macOS und Linux',
    });
    expect(recording.texts).toEqual(
      expect.arrayContaining([
        'Schlagen Sie mein Fluid-Ergebnis',
        'Serie',
        'Kostenloser EQ für Windows, macOS und Linux',
      ]),
    );
    // Control: the English it would otherwise carry is nowhere on it.
    expect(recording.texts).not.toContain('Beat my Fluid score');
  });

  it('challenges whoever sees it in every language, keeping "Fluid" as the brand', () => {
    // Ivan, 2026-11-27: the line over the number dares the reader to beat
    // it, where it used to name the game. "Fluid" is the brand, so no
    // language translates it away.
    const labels = Object.entries(CARD_WORDS).map(
      ([code, words]) => `${code}: ${words['support.game.cardScore']}`,
    );
    expect(labels).toContain('en: Beat my Fluid score');
    labels.forEach((label) => {
      expect(label).toMatch(/^[\w-]+: .*\bFluid\b/);
    });
    // Control: each language carries words of its own, not the English
    // copied in.
    expect(
      labels.filter((label) => label.endsWith(': Beat my Fluid score')),
    ).toEqual(['en: Beat my Fluid score']);
  });

  it('never says the app is for Windows alone', () => {
    draw(90, 3, false).texts.forEach((text) => {
      expect(text).not.toMatch(/for Windows$/);
    });
  });

  it('shrinks a long score to fit rather than clipping it', () => {
    const short = draw(90, 3, false);
    const long = draw(123456789012, 3, false);
    expect(sizeOf(short, '90')).toBe(240);
    expect(sizeOf(long, '123456789012')).toBeLessThan(240);
  });

  it('is drawn in the window’s accent', () => {
    setAccent('#e0b04a', '#ffe2a0');
    const recording = draw(90, 3, false);
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
    const recording = draw(90, 10, true);
    expect(recording.colours).toEqual(
      expect.arrayContaining([gold[0], gold[2], gold[4], gold[6]]),
    );
    OLD_SPECTRUM.forEach((colour) => {
      expect(recording.colours).not.toContain(colour);
    });
  });

  it('keeps Colourful mode’s palette out of a card drawn with the mode off', () => {
    const recording = draw(90, 3, false);
    expect(recording.colours).not.toContain(LAGOON[6]);
  });

  it('draws the music wave in the window’s colours, not a picture of another', () => {
    setAccent('#e0b04a', '#ffe2a0');
    const recording = draw(90, 3, false);
    // The ribbon's strands are the accent at a strength; no picture is
    // turned round the wheel to get there.
    expect(
      recording.colours.some((colour) =>
        colour.startsWith('rgba(224, 176, 74,'),
      ),
    ).toBe(true);
    expect(recording.filters.join(' ')).not.toMatch(/hue-rotate|grayscale/);
  });

  it('casts no shadow anywhere (Ivan: "no dropshadow always clean")', () => {
    expect(draw(344, 3, true).shadows).toEqual([]);
    // Control: the recorder does catch one.
    const { context, recording } = recordingCanvas();
    context.shadowBlur = 28;
    expect(recording.shadows).toEqual(['shadowBlur']);
  });
});
