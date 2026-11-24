/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp on a white window (Ivan, 2026-11-24: "we need to fix the white
 * theme"): the song's title over the picture stood on a black shadow that
 * read as a smudge round the window's dark ink, and the play key, the
 * faders' caps, the lamps and the art carried glows and drops that made grey
 * and teal blurs on white (his standing rule, 2026-11-19: "no dropshadow
 * always clean").
 *
 * jsdom paints nothing, so what is held is the compiled sheet's shape: every
 * glow and drop in the amp is mixed by `--player-glow-share`, which the dark
 * window keeps at all of it and a light window takes to none; the words over
 * the picture take one shadow, which a light window makes a scrim of the
 * panes' own white; and play's glyph is the accent's own label there.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';

/** Splits a value on its top-level commas, so `color-mix(a, b)` stays whole. */
const layers = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < value.length; at += 1) {
    if (value[at] === '(') {
      depth += 1;
    } else if (value[at] === ')') {
      depth -= 1;
    } else if (value[at] === ',' && depth === 0) {
      parts.push(value.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.replace(/\s+/g, ' ').trim());
};

/**
 * A layer that throws light or shade past its box: not inset, and offset or
 * blurred. A ring (`0 0 0 2px`) is an edge, and stays.
 */
const castsBeyond = (layer: string): boolean => {
  if (/\binset\b|^none$/.test(layer)) {
    return false;
  }
  // The lengths before any function: x, y, blur.
  const lengths = layer
    .replace(/[a-z-]+\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '')
    .match(/-?\d*\.?\d+(?:px)?/g);
  return (lengths ?? []).slice(0, 3).some((length) => parseFloat(length) !== 0);
};

describe('the amp on a white window', () => {
  const css = compileStylesheet('MiniPlayer.scss');
  const rules = styleRules(css);

  const declared = (match: (rule: IRule) => boolean, property: string) =>
    rules
      .filter((rule) => match(rule) && rule.declarations.has(property))
      .map((rule) => rule.declarations.get(property) ?? '');

  const lightValue = (property: string) => {
    const values = declared((rule) => rule.selectors.includes(LIGHT), property);
    expect(values).toHaveLength(1);
    return values[0];
  };

  it('mixes every glow and drop it casts by the glow share', () => {
    const cast = rules.flatMap((rule) =>
      layers(rule.declarations.get('box-shadow') ?? 'none')
        .filter(castsBeyond)
        .map((layer) => ({ selector: rule.selectors.join(', '), layer })),
    );
    // Positive control: the amp does cast them - play's glow, the art's
    // drop, the caps', the lamps' - so a parser that found none proves
    // nothing.
    expect(cast.length).toBeGreaterThan(15);
    expect(
      cast.filter(({ layer }) => !layer.includes('var(--player-glow-share')),
    ).toEqual([]);
  });

  it('keeps all of them on a dark window and none on a light one', () => {
    expect(
      declared(
        (rule) => rule.selectors.includes(':scope'),
        '--player-glow-share',
      ),
    ).toEqual(['100%']);
    expect(lightValue('--player-glow-share')).toBe('0%');
  });

  it('puts no shadow under the words and fades the picture into white', () => {
    const dark = declared(
      (rule) => rule.selectors.includes(':scope'),
      '--player-text-shadow',
    );
    // The dark window's shadow, untouched: black.
    expect(dark).toHaveLength(1);
    expect(dark[0]).toMatch(/rgba\(0, 0, 0/);
    // Ivan, 2026-11-24: "that text with dropshadow, hate it" - none at all,
    // not a white halo either.
    expect(lightValue('--player-text-shadow')).toBe('none');
    // The ground under the words is the panes' white, risen further.
    expect(lightValue('--player-scrim')).toBe('var(--surface-panel)');
    const mid = (value: string) => parseFloat(value);
    const darkMid = declared(
      (rule) => rule.selectors.includes(':scope'),
      '--player-shade-mid',
    );
    expect(darkMid).toEqual(['60%']);
    expect(mid(lightValue('--player-shade-mid'))).toBeGreaterThan(
      mid(darkMid[0]),
    );
    // And no word in the amp carries a shadow of its own beside the token.
    const shadows = rules.flatMap((rule) =>
      rule.declarations.has('text-shadow')
        ? [rule.declarations.get('text-shadow')]
        : [],
    );
    expect(shadows.length).toBeGreaterThan(3);
    expect(
      shadows.filter(
        (value) => value !== 'var(--player-text-shadow)' && value !== 'none',
      ),
    ).toEqual([]);
  });

  // "the text is cutted, the g": the title's line is the face's own height,
  // and its margins give back what its box grew, so nothing round it moves.
  it('gives the title room for its descenders without moving it', () => {
    const title = rules.find(
      (rule) =>
        rule.selectors.includes('.player-hero__title') &&
        rule.declarations.has('line-height'),
    );
    const lineHeight = parseFloat(
      title?.declarations.get('line-height') ?? '0',
    );
    expect(lineHeight).toBeGreaterThanOrEqual(1.33);
    expect(title?.declarations.get('height')).toBe(`${lineHeight}em`);
    // The margins give back exactly what the box grew past its old 1.2em.
    const margin = parseFloat(title?.declarations.get('margin-block') ?? '0');
    expect(lineHeight + 2 * margin).toBeCloseTo(1.2, 5);
  });

  it('writes play’s glyph in the accent’s own label on white', () => {
    expect(
      declared(
        (rule) => rule.selectors.includes('.player-dock__play'),
        'color',
      ),
    ).toEqual(['var(--player-play-ink)']);
    expect(lightValue('--player-play-ink')).toBe('var(--on-accent)');
    // With no glow to grow under the pointer, the face steps instead.
    expect(lightValue('--player-play-hover-fill')).toContain('var(--accent)');
  });

  it('reaches a picture of the player drawn in a page too', () => {
    const light = rules.find((rule) => rule.selectors.includes(LIGHT));
    expect(light?.selectors).toContain(
      `${LIGHT} :is(.player-picture, .player-part)`,
    );
  });
});
