/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * COLOURFUL MODE PAINTS IN THE PALETTE IN USE, NEVER A FIXED SPECTRUM.
 *
 * The palette is the window's Tint, or the visualizer's colours, written on
 * the root as `--rainbow-1` … `--rainbow-7` (`rainbowPalette.ts`). The flash
 * the mode switches on with, the Support pet's bloom, the beat game's lit
 * marks and its Share button each kept cyan, green, yellow, pink and violet
 * written in after the mode itself had stopped painting them (Ivan,
 * 2026-10-25: "not use those fixed rainbow colors ... but to use current
 * colorful color", "remove all rainbow crap and colors"). jsdom runs no
 * stylesheet, so this reads the compiled CSS.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

const compiled = new Map<string, string>();
const css = (sheet: string) => {
  const known = compiled.get(sheet);
  if (known !== undefined) {
    return known;
  }
  const fresh = compileStylesheet(sheet);
  compiled.set(sheet, fresh);
  return fresh;
};

/** Every rule with `selector` among its own, the licence comment aside. */
const rulesFor = (rules: IRule[], selector: string) =>
  rules.filter((rule) =>
    rule.selectors.some(
      (each) => each === selector || each.endsWith(`*/ ${selector}`),
    ),
  );

/** What the last rule for `selector` gives `property`. */
const valueOf = (
  sheet: string,
  selector: string,
  property: string,
  within: string[] = [],
): string => {
  const value = rulesFor(styleRules(css(sheet), within), selector).reduce<
    string | undefined
  >((last, rule) => rule.declarations.get(property) ?? last, undefined);
  if (value === undefined) {
    throw new Error(`${sheet}: no ${property} for ${selector}`);
  }
  return value;
};

/** A colour written in: a hex, or an rgb() or hsl() of numbers. */
const FIXED_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

const tokensIn = (value: string) =>
  [...value.matchAll(/var\(--rainbow-(\d)\)/g)].map((match) =>
    Number(match[1]),
  );

describe('the flash Colourful mode switches on with', () => {
  it('sweeps the palette in use across the window', () => {
    const sweep = valueOf(
      'Euphoria.scss',
      '.euphoria-burst::before',
      'background',
    );
    expect(sweep).not.toMatch(FIXED_COLOUR);
    expect(tokensIn(sweep)).toEqual([1, 3, 4, 5, 7]);
  });

  it('lights each blade in the colour it is handed', () => {
    const blade = valueOf(
      'Euphoria.scss',
      '.euphoria-burst__blade',
      'background',
    );
    expect(blade).not.toMatch(FIXED_COLOUR);
    expect(blade).toContain('var(--euphoria-blade-colour)');
  });

  it('keeps to the palette under reduced motion too', () => {
    const still = valueOf('Euphoria.scss', '.euphoria-burst', 'background', [
      '@media (prefers-reduced-motion: reduce)',
    ]);
    expect(still).not.toMatch(FIXED_COLOUR);
    expect(tokensIn(still)).toEqual([1, 4, 6]);
  });
});

describe('the Support card in Colourful mode', () => {
  it('blooms behind the creature in all seven stops, closed into a ring', () => {
    const bloom = valueOf(
      'SupportPet.scss',
      '.is-euphoric .support-pet--hero::before',
      'background',
    );
    expect(bloom).not.toMatch(FIXED_COLOUR);
    expect(tokensIn(bloom)).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
  });

  it('fades the bloom out from her middle rather than drawing a disc', () => {
    expect(
      valueOf(
        'SupportPet.scss',
        '.is-euphoric .support-pet--hero::before',
        'mask',
      ),
    ).toMatch(/^radial-gradient\(.*transparent 70%\)$/);
  });

  it('lights a good tap in the palette instead of the game’s lime', () => {
    expect(
      valueOf('Euphoria.scss', '.is-euphoric .rhythm-game', '--game-ink'),
    ).toBe('var(--rainbow-4)');
  });

  it.each([
    ['.rhythm-game__streak', 'color'],
    ['.rhythm-game__streak', 'background'],
    ['.rhythm-game__trace .rhythm-game__peak', 'stroke'],
    ['.rhythm-game__trace .rhythm-game__peak', 'filter'],
    ['.rhythm-game__verdict-multiplier', 'color'],
    ['.rhythm-game__verdict-multiplier', 'text-shadow'],
    ['.rhythm-game__verdict-text--perfect', 'color'],
  ])('draws %s’s %s in the game’s one ink', (selector, property) => {
    const value = valueOf('RhythmGame.scss', selector, property);
    expect(value).not.toMatch(FIXED_COLOUR);
    expect(value).toContain('var(--game-ink)');
  });

  it('paints the wave’s stops in the colours the markup hands them', () => {
    const selector = '.rhythm-game__trace stop';
    expect(valueOf('RhythmGame.scss', selector, 'stop-color')).toBe(
      'var(--stop-colour)',
    );
    expect(valueOf('RhythmGame.scss', selector, 'stop-opacity')).toBe(
      'var(--stop-opacity, 1)',
    );
  });

  it('fills the Share button with a still sweep of the palette', () => {
    const selector = '.rhythm-game__share.is-euphoric';
    const fill = valueOf('ShareScore.scss', selector, 'background');
    expect(fill).not.toMatch(FIXED_COLOUR);
    expect(tokensIn(fill)).toEqual([1, 3, 5, 7]);
    // From the border's edge: from the padding's, the sweep repeated under
    // the transparent border as a sliver down the right side.
    expect(valueOf('ShareScore.scss', selector, 'background-origin')).toBe(
      'border-box',
    );
    expect(
      rulesFor(styleRules(css('ShareScore.scss')), selector).some((rule) =>
        rule.declarations.has('animation'),
      ),
    ).toBe(false);
  });
});

describe('the beat game’s verdict line', () => {
  // The hint wrapped to two lines and the verdict that replaced it took one,
  // so the Share button under the line jumped on every tap (Ivan,
  // 2026-10-25: "ui bug 2 lines push down"). The line holds its longest
  // messages invisibly in the same cell, so it is always their height.
  it.each([
    ['::before', 'attr(data-hint)'],
    ['::after', 'attr(data-listening)'],
  ])('keeps a hidden copy in %s, from %s', (pseudo, content) => {
    const selector = `.rhythm-game__verdict${pseudo}`;
    expect(valueOf('RhythmGame.scss', selector, 'content')).toBe(content);
    expect(valueOf('RhythmGame.scss', selector, 'grid-area')).toBe('1/1');
    expect(valueOf('RhythmGame.scss', selector, 'visibility')).toBe('hidden');
  });

  it('puts what is on show in the same cell', () => {
    expect(valueOf('RhythmGame.scss', '.rhythm-game__verdict', 'display')).toBe(
      'grid',
    );
    expect(
      valueOf('RhythmGame.scss', '.rhythm-game__verdict-row', 'grid-area'),
    ).toBe('1/1');
  });
});
