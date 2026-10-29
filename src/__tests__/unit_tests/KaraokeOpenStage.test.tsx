/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { LOCALES } from '../../common/i18n';
import { IKaraokeSong } from '../../common/karaoke/types';
import KaraokeLyrics from '../../renderer/karaoke/KaraokeLyrics';
import {
  fitKaraokeLyricLayout,
  karaokeLyricBlockGap,
  karaokeLyricRestingSize,
  positionKaraokeLyricBlocks,
  scaleKaraokeLyricLayout,
} from '../../renderer/karaoke/karaokeLyricLayout';

jest.mock('../../renderer/utils/observeShown', () => ({
  __esModule: true,
  default: (_element: Element, onChange: (shown: boolean) => void) => {
    onChange(true);
    return () => undefined;
  },
}));

interface ITextPaint {
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  font: string;
}

// A stand-in for real shaping, in ems: a Han, kana or Hangul grapheme is a
// full em wide, a space 0.3 and anything else 0.55.
const FULL_WIDTH_SCRIPT =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const advanceOf = (grapheme: string): number => {
  if (/\s/u.test(grapheme)) {
    return 0.3;
  }
  return FULL_WIDTH_SCRIPT.test(grapheme) ? 1 : 0.55;
};

// Geometry and the actual component's draw calls are exercised here. Native
// font shaping/contrast still require the separately recorded browser matrix.
const recordingContext = () => {
  const paints: ITextPaint[] = [];
  const clips: { x: number; y: number; width: number; height: number }[] = [];
  const stack: { font: string; globalAlpha: number; fillStyle: string }[] = [];
  const context = {
    font: '700 16px sans-serif',
    globalAlpha: 1,
    fillStyle: '',
    measureText: jest.fn((text: string): TextMetrics => {
      const size: number = Number(context.font.match(/([\d.]+)px/u)?.[1] ?? 16);
      return {
        width: [
          ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
            text,
          ),
        ].reduce((sum, part) => sum + size * advanceOf(part.segment), 0),
      } as TextMetrics;
    }),
    save: () => {
      stack.push({
        font: context.font,
        globalAlpha: context.globalAlpha,
        fillStyle: context.fillStyle,
      });
    },
    restore: () => {
      const previous = stack.pop();
      if (previous) {
        Object.assign(context, previous);
      }
    },
    fillText: (text: string, x: number, y: number) => {
      paints.push({
        text,
        x,
        y,
        color: context.fillStyle,
        alpha: context.globalAlpha,
        font: context.font,
      });
    },
    strokeText: jest.fn(),
    setTransform: jest.fn(),
    clearRect: () => {
      paints.length = 0;
      clips.length = 0;
    },
    beginPath: jest.fn(),
    rect: (x: number, y: number, width: number, height: number) => {
      clips.push({ x, y, width, height });
    },
    clip: jest.fn(),
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    measure: context.measureText,
    paints,
    clips,
  };
};

const scriptFixtures: Record<string, string> = {
  en: 'Follow the light and let the evening carry every word',
  zh: '跟着夜里的光让每一句歌词都清楚地留在眼前',
  'zh-Hant': '跟著夜裡的光讓每一句歌詞都清楚地留在眼前',
  hi: 'रात की रोशनी के साथ हर शब्द को साफ़ गाते चलो',
  es: 'Sigue la luz y deja que la noche lleve cada palabra',
  fr: 'Suis la lumière et laisse la nuit porter chaque parole',
  pt: 'Siga a luz e deixe a noite levar cada palavra',
  ru: 'Следуй за светом и пусть вечер несёт каждое слово',
  ja: '夜の光を追いかけてすべての言葉をはっきり歌おう',
  ko: '밤의 빛을 따라 모든 노랫말을 또렷하게 불러요',
  de: 'Folge dem Licht und lass den Abend jedes Wort tragen',
  it: 'Segui la luce e lascia che la sera porti ogni parola',
};

const paintedText = (layout: ReturnType<typeof fitKaraokeLyricLayout>) =>
  layout.rows
    .flatMap((row) => row.fragments.map((fragment) => fragment.text))
    .join('')
    .replace(/\s/gu, '');

describe('Open stage phrase geometry', () => {
  it('wraps a long phrase before reducing the chosen native text size', () => {
    const { context } = recordingContext();
    const text = scriptFixtures.en;
    const layout = fitKaraokeLyricLayout(
      context,
      [{ text }],
      40,
      420,
      180,
      true,
    );
    expect(layout.fontSize).toBe(40);
    expect(layout.rows.length).toBeGreaterThan(1);
    expect(layout.rows.length).toBeLessThanOrEqual(3);
    expect(layout.rows.every((row) => row.width <= 420)).toBe(true);
    expect(paintedText(layout)).toBe(text.replace(/\s/gu, ''));
    // Positive control: the same phrase genuinely exceeds one row.
    expect(context.measureText(text).width).toBeGreaterThan(420);
  });

  it.each(LOCALES.map((locale) => locale.code))(
    'keeps all glyphs inside a narrow three-row budget for %s',
    (locale) => {
      const text = scriptFixtures[locale];
      expect(text).toBeDefined();
      const { context } = recordingContext();
      const layout = fitKaraokeLyricLayout(
        context,
        [{ text }],
        120,
        260,
        120,
        true,
      );
      expect(layout.rows.length).toBeGreaterThan(0);
      expect(layout.rows.length).toBeLessThanOrEqual(3);
      expect(layout.height).toBeLessThanOrEqual(120);
      expect(layout.rows.every((row) => row.width <= 260.01)).toBe(true);
      expect(paintedText(layout)).toBe(text.replace(/\s/gu, ''));
    },
  );

  it('keeps joined provider syllables together and original sweep offsets after wrapping', () => {
    const { context } = recordingContext();
    const tokens = [
      { text: 'to', startsWord: true, startMs: 0, endMs: 200 },
      { text: 'gether', startsWord: false, startMs: 200, endMs: 600 },
      { text: 'again', startsWord: true, startMs: 600, endMs: 1_000 },
    ];
    const layout = fitKaraokeLyricLayout(context, tokens, 30, 150, 150, true);
    const fragments = layout.rows.flatMap((row) => row.fragments);
    expect(fragments.find((fragment) => fragment.wordIndex === 0)?.text).toBe(
      'together',
    );
    const secondWord = fragments.find((fragment) => fragment.wordIndex === 1);
    expect(secondWord?.displayText).toBe(' again');
    expect(secondWord?.start).toBe(1);
    expect(secondWord?.prefixWidth).toBeGreaterThan(0);
    expect(layout.rows).toHaveLength(2);
  });

  it('retains row breaks throughout a size transition and uses bold below display size', () => {
    const { context } = recordingContext();
    const full = fitKaraokeLyricLayout(
      context,
      [{ text: scriptFixtures.en }],
      40,
      420,
      180,
      true,
    );
    const small = scaleKaraokeLyricLayout(context, full, 18, false);
    expect(
      small.rows.map((row) => row.fragments.map((fragment) => fragment.text)),
    ).toEqual(
      full.rows.map((row) => row.fragments.map((fragment) => fragment.text)),
    );
    expect(small.fontWeight).toBe(700);
    expect(full.fontWeight).toBe(900);
    expect(small.height).toBeLessThan(full.height);
  });

  it('fades a complete phrase before the edge and reserves non-overlapping translation blocks', () => {
    const blocks = [
      { index: 2, height: 56 },
      { index: 3, height: 56 },
      { index: 4, height: 100 },
      { index: 5, height: 56 },
    ];
    const positions = positionKaraokeLyricBlocks(blocks, 4, 300, 24);
    const current = positions.find((block) => block.index === 4)!;
    expect(current.top + current.height / 2).toBe(150);
    expect(current.opacity).toBe(1);
    const outside = positions.find((block) => block.index === 2)!;
    expect(outside.top).toBeLessThan(0);
    expect(outside.opacity).toBe(0);
    expect(
      positions.find((block) => block.index === 5)?.opacity,
    ).toBeGreaterThan(0);
    positions.slice(1).forEach((block, index) => {
      expect(block.top - (positions[index].top + positions[index].height)).toBe(
        24,
      );
    });
    const halfway = positionKaraokeLyricBlocks(blocks, 4.5, 300, 24);
    const centers = halfway
      .filter((block) => block.index === 4 || block.index === 5)
      .map((block) => block.top + block.height / 2);
    expect((centers[0] + centers[1]) / 2).toBe(150);
  });

  it('balances a wrapped phrase instead of leaving its last word alone', () => {
    const { context } = recordingContext();
    const layout = fitKaraokeLyricLayout(
      context,
      [{ text: 'Feel the low end fill the room' }],
      40,
      560,
      400,
      true,
    );
    const words = layout.rows.map((row) =>
      row.fragments.map((fragment) => fragment.text.trim()).filter(Boolean),
    );
    expect(words).toEqual([
      ['Feel', 'the', 'low', 'end'],
      ['fill', 'the', 'room'],
    ]);
    expect(layout.fontSize).toBe(40);
    // Positive control: filled greedily, the same stage leaves "room" alone.
    expect(
      context.measureText('Feel the low end fill the').width,
    ).toBeLessThanOrEqual(560);
    expect(context.measureText('Feel the low end fill the room').width).toBe(
      600,
    );
  });

  it('rests the next phrase larger than the sung one, capped on a narrow stage', () => {
    const upcoming = karaokeLyricRestingSize(64, 1, 900, false);
    const sung = karaokeLyricRestingSize(64, -1, 900, false);
    expect(upcoming).toBeGreaterThan(sung);
    expect(upcoming).toBe(30);
    expect(karaokeLyricRestingSize(64, 1, 420, false)).toBe(23);
    expect(karaokeLyricRestingSize(64, 1, 900, true)).toBe(16);
    expect(karaokeLyricBlockGap(900, 200)).toBe(12);
    expect(karaokeLyricBlockGap(420, 600)).toBe(20);
    expect(karaokeLyricBlockGap(900, 600)).toBe(24);
  });
});

describe('Open stage real canvas behavior', () => {
  const previousObserver = window.ResizeObserver;
  let draw: (() => void) | undefined;
  let now = 0;
  let recording: ReturnType<typeof recordingContext>;
  const song: IKaraokeSong = {
    id: 'open-stage-wrapped',
    title: 'Open stage',
    assets: [],
    timingPrecision: 'line',
    lines: [
      {
        id: 'long',
        startMs: 0,
        endMs: 10_000,
        tokens: [{ text: scriptFixtures.en, startMs: 0, endMs: 10_000 }],
      },
      {
        id: 'next',
        startMs: 10_000,
        endMs: 20_000,
        tokens: [{ text: 'The next phrase stays ready' }],
      },
    ],
    pitch: { kind: 'none', reason: 'missing' },
    meta: { sourceFormat: 'lrc', gapMs: 0, language: 'en' },
  };
  beforeEach(() => {
    now = 0;
    draw = undefined;
    recording = recordingContext();
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(recording.context);
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 420,
        height: 520,
        right: 420,
        bottom: 520,
        toJSON: () => ({}),
      });
    window.ResizeObserver = jest
      .fn()
      .mockImplementation((callback: () => void) => {
        draw = callback;
        return {
          observe: () => undefined,
          unobserve: () => undefined,
          disconnect: () => undefined,
        };
      }) as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    window.ResizeObserver = previousObserver;
  });
  const paintFrame = (time: number) => {
    now = time;
    expect(draw).toBeDefined();
    act(() => draw?.());
  };

  it('keeps the lyric sweep on the original timeline across wrapped rows and seeks every painted row', () => {
    const onSeek = jest.fn();
    const { rerender } = render(
      <KaraokeLyrics song={song} playheadMs={0} onSeek={onSeek} />,
    );
    paintFrame(1_000);
    expect(recording.clips).toHaveLength(0);
    const originalCanvas = screen.getByRole('button', { name: 'Lyric line 1' });
    expect(originalCanvas).toHaveAttribute('lang', 'en');
    rerender(<KaraokeLyrics song={song} playheadMs={9_000} onSeek={onSeek} />);
    paintFrame(1_050);
    const rows = [...new Set(recording.clips.map((clip) => clip.y))];
    expect(rows.length).toBeGreaterThan(1);
    expect(
      recording.clips.every(
        (clip) =>
          clip.width > 0 && clip.x >= 20 && clip.x + clip.width <= 400.01,
      ),
    ).toBe(true);
    const basePaints = recording.paints.filter(
      (paint) => paint.color === 'rgb(242, 246, 255)' && paint.text.trim(),
    );
    const lastRowY = Math.max(...basePaints.map((paint) => paint.y));
    const lastRow = basePaints.find((paint) => paint.y === lastRowY)!;
    expect(lastRow).toBeDefined();
    fireEvent(
      originalCanvas,
      new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: lastRow.x + 2,
        clientY: lastRow.y,
      }),
    );
    expect(onSeek).toHaveBeenCalledWith(0);
    onSeek.mockClear();
    fireEvent(
      originalCanvas,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 4 }),
    );
    expect(onSeek).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lyric line 1' })).toBe(
      originalCanvas,
    );
  });

  it('reuses wrapped geometry on ordinary playback frames while still advancing the sweep', () => {
    const { rerender } = render(
      <KaraokeLyrics song={song} playheadMs={1_000} onSeek={jest.fn()} />,
    );
    paintFrame(1_000);
    const initialMeasures = recording.measure.mock.calls.length;
    const firstPaintedWidth = recording.clips.reduce(
      (sum, clip) => sum + clip.width,
      0,
    );
    recording.measure.mockClear();
    rerender(
      <KaraokeLyrics song={song} playheadMs={5_000} onSeek={jest.fn()} />,
    );
    paintFrame(1_050);
    expect(
      recording.clips.reduce((sum, clip) => sum + clip.width, 0),
    ).toBeGreaterThan(firstPaintedWidth);
    expect(recording.measure.mock.calls.length).toBeLessThan(
      initialMeasures / 4,
    );
  });
});
