/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The small window under a scene's three colours shows where each one lands
 * in the real window (Ivan, 2026-11-25: "this preview doesn't really show
 * where the second colour may be used"): the surface on the floor, the
 * panes and the graph's field; the accent on a filled button, the chosen
 * tab, a switch that is on and the stage's curve; the second colour on the
 * rail's lamps, an ON badge, the live dot and the spectrum, and at the end
 * of the wave's and the meters' run from the accent.
 *
 * A second colour on the red that says off is refused for "on". Worn as
 * named, the accent says "on" in its place (`pickedWindow`), so the small
 * window paints those parts in the accent and marks them as stood in for;
 * the swatch says the accent does it, not FluidEQ's own (which is what the
 * colours a palette works out get, `skyFromWindowColours`). The run still
 * ends in the refused colour: `RainbowSource` hands it on as it is.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import WindowColoursPreview from 'renderer/components/WindowColoursPreview';
import WindowColourSwatches from 'renderer/components/WindowColourSwatches';
import {
  onSourceOf,
  partWearers,
  PREVIEW_PARTS,
  previewPaintOf,
  type TPreviewPart,
} from 'renderer/utils/windowColoursPreview';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const VIOLET = { surface: '#14202e', accent: '#3fc8ff', glow: '#b48cff' };
const RED = { ...VIOLET, glow: '#ff3b3b' };
const GREY = { ...VIOLET, glow: '#808080' };
/** A dark window's Brightness. */
const DARK = 38;

const SECOND_PARTS: TPreviewPart[] = ['lamp', 'badge', 'live', 'spectrum'];
const ACCENT_PARTS: TPreviewPart[] = ['tab', 'switch', 'button', 'curve'];
const SURFACE_PARTS: TPreviewPart[] = ['floor', 'pane', 'field'];
const RUN_PARTS: TPreviewPart[] = ['wave', 'meter'];

describe('which colour each part wears', () => {
  it('names every part once among the four kinds', () => {
    expect(
      [...SECOND_PARTS, ...ACCENT_PARTS, ...SURFACE_PARTS, ...RUN_PARTS].sort(),
    ).toEqual([...PREVIEW_PARTS].sort());
  });

  it('puts the surface on the floor, the panes and the field', () => {
    SURFACE_PARTS.forEach((part) =>
      expect(partWearers(part, 'second', false)).toEqual({
        wears: ['surface'],
        standsIn: [],
      }),
    );
  });

  it('puts the accent on the button, the chosen tab, the switches and the curve', () => {
    ACCENT_PARTS.forEach((part) =>
      expect(partWearers(part, 'second', false)).toEqual({
        wears: ['accent'],
        standsIn: [],
      }),
    );
  });

  it('puts the second colour on everything that says "on"', () => {
    SECOND_PARTS.forEach((part) =>
      expect(partWearers(part, 'second', false)).toEqual({
        wears: ['glow'],
        standsIn: [],
      }),
    );
  });

  it('runs the wave and the meters from the accent to the second colour', () => {
    RUN_PARTS.forEach((part) =>
      expect(partWearers(part, 'second', false).wears).toEqual([
        'accent',
        'glow',
      ]),
    );
  });

  it('paints "on" in the accent where it stands in, and says for whom', () => {
    SECOND_PARTS.forEach((part) =>
      expect(partWearers(part, 'accent', false)).toEqual({
        wears: ['accent'],
        standsIn: ['glow'],
      }),
    );
    // FluidEQ's own "on" is none of the three.
    SECOND_PARTS.forEach((part) =>
      expect(partWearers(part, 'own', false)).toEqual({
        wears: [],
        standsIn: ['glow'],
      }),
    );
  });

  it('keeps the run in the refused colour, which says no state', () => {
    RUN_PARTS.forEach((part) =>
      expect(partWearers(part, 'accent', false).wears).toEqual([
        'accent',
        'glow',
      ]),
    );
  });

  it('gives the run none of the three where the scene paints its own wave', () => {
    RUN_PARTS.forEach((part) =>
      expect(partWearers(part, 'second', true).wears).toEqual([]),
    );
  });
});

describe('what says "on"', () => {
  it('is the second colour where it can say it', () => {
    expect(onSourceOf(VIOLET, true)).toBe('second');
    expect(onSourceOf(VIOLET, false)).toBe('second');
  });

  it('is the accent for named colours whose second is red or grey', () => {
    expect(onSourceOf(RED, true)).toBe('accent');
    expect(onSourceOf(GREY, true)).toBe('accent');
  });

  it("is FluidEQ's own for worked-out colours whose second is red", () => {
    expect(onSourceOf(RED, false)).toBe('own');
  });
});

describe('the paint', () => {
  it('paints "on" in the second colour itself when it can say it', () => {
    const paint = previewPaintOf(VIOLET, true, DARK);
    expect(paint?.active).not.toBe(paint?.accent);
    expect(paint?.run[0]).not.toBe(paint?.run[6]);
  });

  it('paints a refused "on" in exactly the accent the window wears', () => {
    const paint = previewPaintOf(RED, true, DARK);
    expect(paint?.on).toBe('accent');
    expect(paint?.active).toBe(paint?.accent);
    // The run still ends in red: a hue well away from the accent's cyan.
    expect(paint?.run[6]).toBe(RED.glow);
  });

  it('runs the scene’s own wave palette where it hands one', () => {
    const own = [
      '#111111',
      '#222222',
      '#333333',
      '#444444',
      '#555555',
      '#666666',
      '#777777',
    ];
    const paint = previewPaintOf(VIOLET, true, DARK, own);
    expect(paint?.ownRun).toBe(true);
    expect(paint?.run).toHaveLength(7);
    expect(paint?.run).not.toContain(VIOLET.glow);
  });
});

/** Every element of the small window that is `part`. */
const parts = (container: HTMLElement, part: TPreviewPart) => [
  ...container.querySelectorAll<HTMLElement>(`[data-part="${part}"]`),
];

const styleOf = (container: HTMLElement, name: string) =>
  container
    .querySelector<HTMLElement>('.window-colours-preview')
    ?.style.getPropertyValue(name);

describe('the small window', () => {
  it('marks each part with the colour it wears', () => {
    const { container } = render(
      <WindowColoursPreview colours={VIOLET} named />,
    );
    expect(
      screen.getByRole('img', { name: 'graph.sceneColours.preview' }),
    ).toBeInTheDocument();
    SECOND_PARTS.forEach((part) => {
      expect(parts(container, part).length).toBeGreaterThan(0);
      parts(container, part).forEach((element) => {
        expect(element).toHaveAttribute('data-wears', 'glow');
        expect(element).not.toHaveAttribute('data-stands-in');
      });
    });
    ACCENT_PARTS.forEach((part) =>
      parts(container, part).forEach((element) =>
        expect(element).toHaveAttribute('data-wears', 'accent'),
      ),
    );
    RUN_PARTS.forEach((part) =>
      parts(container, part).forEach((element) =>
        expect(element).toHaveAttribute('data-wears', 'accent glow'),
      ),
    );
    // Two rail rows are on: two lamps, two switches; the third is off.
    expect(parts(container, 'lamp')).toHaveLength(2);
    expect(parts(container, 'switch')).toHaveLength(2);
    expect(styleOf(container, '--preview-active')).not.toBe(
      styleOf(container, '--preview-accent'),
    );
  });

  it('shows what stands in for a refused second colour, and never the colour', () => {
    const { container } = render(<WindowColoursPreview colours={RED} named />);
    expect(container.querySelector('.window-colours-preview')).toHaveAttribute(
      'data-on',
      'accent',
    );
    SECOND_PARTS.forEach((part) =>
      parts(container, part).forEach((element) => {
        expect(element).toHaveAttribute('data-wears', 'accent');
        expect(element).toHaveAttribute('data-stands-in', 'glow');
      }),
    );
    expect(styleOf(container, '--preview-active')).toBe(
      styleOf(container, '--preview-accent'),
    );
    expect(styleOf(container, '--preview-active')).not.toBe(RED.glow);
    // The wave still ends in it.
    parts(container, 'wave').forEach((element) =>
      expect(element).toHaveAttribute('data-wears', 'accent glow'),
    );
    const stops = [...container.querySelectorAll('stop')].map((stop) =>
      stop.getAttribute('stop-color'),
    );
    expect(stops[stops.length - 1]).toBe(RED.glow);
  });

  it('draws the wave and the meters in what they really run through', () => {
    const own = [
      '#102030',
      '#203040',
      '#304050',
      '#405060',
      '#506070',
      '#607080',
      '#708090',
    ];
    const { container } = render(
      <WindowColoursPreview colours={VIOLET} named run={own} />,
    );
    RUN_PARTS.forEach((part) =>
      parts(container, part).forEach((element) =>
        expect(element).toHaveAttribute('data-wears', ''),
      ),
    );
    const stops = [...container.querySelectorAll('stop')].map((stop) =>
      stop.getAttribute('stop-color'),
    );
    expect(stops).not.toContain(VIOLET.glow);
  });
});

describe('the swatches', () => {
  const swatches = (colours: typeof VIOLET, named: boolean) =>
    render(
      <WindowColourSwatches
        colours={colours}
        own={colours}
        named={named}
        onChange={jest.fn()}
        onCommit={jest.fn()}
      />,
    );

  it('names the colour each one is, for the small window to light up', () => {
    const { container } = swatches(VIOLET, true);
    expect(
      [...container.querySelectorAll('[data-role]')].map((element) =>
        element.getAttribute('data-role'),
      ),
    ).toEqual(['surface', 'accent', 'glow']);
  });

  it('says nothing of a second colour that can say "on"', () => {
    swatches(VIOLET, true);
    expect(
      screen.getByText('graph.sceneColours.glowAbout'),
    ).toBeInTheDocument();
  });

  it('says the accent says "on" for a refused named second colour', () => {
    swatches(RED, true);
    expect(
      screen.getByText('graph.sceneColours.glowUnusedAccent'),
    ).toBeInTheDocument();
    expect(screen.queryByText('graph.sceneColours.glowUnused')).toBeNull();
  });

  it('says FluidEQ keeps its own for a refused worked-out one', () => {
    swatches(RED, false);
    expect(
      screen.getByText('graph.sceneColours.glowUnused'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('graph.sceneColours.glowUnusedAccent'),
    ).toBeNull();
  });
});
