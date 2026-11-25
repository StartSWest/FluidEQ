/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp casts no glow and no drop, and its words no shadow, on any window
 * (Ivan, 2026-11-24 on white: "that text with dropshadow, hate it"; on dark
 * 2026-11-25, after a before and after of the play key, the art, the faders'
 * caps and the title; his standing rule since 2026-11-19: "no dropshadow
 * always clean"). Over a scene the song's words stand on a band of shade
 * instead, black on a dark window and none on a white one, where the words
 * are the window's dark ink: with the shadow gone and only the scene's scrim
 * under them, a white title vanished into a white sky.
 *
 * jsdom paints nothing, so what is held is the compiled sheet's shape.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';
const WORDS_BAND = '.mini-player.has-scene .player-hero__now::before';

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

/** The first three lengths of a layer, before any function: x, y, blur. */
const offsetAndBlur = (layer: string): number[] =>
  (
    layer
      .replace(/[a-z-]+\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '')
      .match(/-?\d*\.?\d+(?:px)?/g) ?? []
  )
    .slice(0, 3)
    .map((length) => parseFloat(length));

/**
 * A layer that throws light or shade past its box: not inset, and offset or
 * blurred. A ring (`0 0 0 2px`) is an edge, and stays.
 */
const castsBeyond = (layer: string): boolean =>
  !/\binset\b|^none$/.test(layer) &&
  offsetAndBlur(layer).some((length) => length !== 0);

/** A ring: not inset, no offset, no blur, a spread. */
const isRing = (layer: string): boolean =>
  !/\binset\b|^none$/.test(layer) &&
  offsetAndBlur(layer).every((length) => length === 0) &&
  /^0 0 0 \d/.test(layer);

describe('the amp’s glows, drops and words', () => {
  const rules = styleRules(compileStylesheet('MiniPlayer.scss'));

  const declared = (match: (rule: IRule) => boolean, property: string) =>
    rules
      .filter((rule) => match(rule) && rule.declarations.has(property))
      .map((rule) => rule.declarations.get(property) ?? '');

  const onScope = (property: string) =>
    declared((rule) => rule.selectors.includes(':scope'), property);
  const onLight = (property: string) =>
    declared((rule) => rule.selectors.includes(LIGHT), property);

  const shadowLayers = rules.flatMap((rule) =>
    layers(rule.declarations.get('box-shadow') ?? 'none').map((layer) => ({
      selector: rule.selectors.join(', '),
      layer,
    })),
  );

  it('casts nothing past any box, on any window', () => {
    // Positive control: the faders' rings and the focus rings are still
    // there and still read as edges, so a parser that saw no shadow at all
    // proves nothing.
    expect(
      shadowLayers.filter(({ layer }) => isRing(layer)).length,
    ).toBeGreaterThan(4);
    expect(shadowLayers.filter(({ layer }) => castsBeyond(layer))).toEqual([]);
  });

  it('puts no shadow under any word', () => {
    // Control: the words are in the sheet.
    expect(
      rules.some((rule) => rule.selectors.includes('.player-hero__title')),
    ).toBe(true);
    const shadows = rules.flatMap((rule) => {
      const value = rule.declarations.get('text-shadow');
      return value && value !== 'none' ? [rule.selectors.join(', ')] : [];
    });
    expect(shadows).toEqual([]);
  });

  it('stands the words over a scene on a band of shade, black on dark and none on white', () => {
    const band = declared(
      (rule) => rule.selectors.includes(WORDS_BAND),
      'background',
    );
    expect(band).toHaveLength(1);
    // Eased in and out of its own paint, never a fixed colour.
    expect(band[0]).toMatch(/^linear-gradient\(180deg, /);
    expect(band[0]).toContain('var(--player-words-shade)');
    // The band reaches 55%: under it white words on a white sky read 4.7:1.
    expect(band[0]).toContain('var(--player-words-shade) 55%');
    expect(onScope('--player-words-shade')).toEqual(['#000000']);
    expect(onLight('--player-words-shade')).toEqual(['transparent']);
  });

  it('fades the picture under the words as far on both windows, into each one’s own ground', () => {
    expect(onScope('--player-shade-mid')).toEqual(['88%']);
    expect(onScope('--player-shade-reach')).toEqual(['86%']);
    expect(onLight('--player-shade-mid')).toEqual([]);
    expect(onScope('--player-scrim')).toEqual(['#000000']);
    expect(onLight('--player-scrim')).toEqual(['var(--surface-panel)']);
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

  it('steps play’s face away from its glyph under the pointer, with no glow', () => {
    expect(
      declared(
        (rule) => rule.selectors.includes('.player-dock__play'),
        'color',
      ),
    ).toEqual(['var(--player-play-ink)']);
    expect(
      declared(
        (rule) =>
          rule.selectors.includes('.player-dock__play:hover:not(:disabled)'),
        'background',
      ),
    ).toEqual(['var(--player-play-hover-fill)']);
    // Lighter under the dark window's dark glyph, toward white.
    const darkHover = onScope('--player-play-hover-fill');
    expect(darkHover).toHaveLength(1);
    expect(darkHover[0]).toContain('#fff');
    // On white the glyph is the accent's own label, and the face deepens.
    expect(onLight('--player-play-ink')).toEqual(['var(--on-accent)']);
    expect(onLight('--player-play-hover-fill')[0]).toContain('var(--accent)');
  });

  it('reaches a picture of the player drawn in a page too', () => {
    const light = rules.find((rule) => rule.selectors.includes(LIGHT));
    expect(light?.selectors).toContain(
      `${LIGHT} :is(.player-picture, .player-part)`,
    );
  });
});
