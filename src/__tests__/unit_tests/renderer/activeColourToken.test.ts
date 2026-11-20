/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The interface's "on" colour, read from the compiled stylesheets.
 *
 * It was the lime the music's rainbow is drawn in, written into every badge
 * and live dot directly, so a Plus scene lending the window its colours left
 * lime pills over a blue interface that looked like errors of a different
 * app. It is a token now; these hold that the token is where "on" is said,
 * that its default is still the lime, and that the greens that mean health or
 * data were not swept into it.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const LIME = '#54ff8a';

/** Every value `property` is given for a selector containing `fragment`. */
const valuesFor = (css: string, fragment: string, property: string) =>
  styleRules(css)
    .filter(({ selectors }) =>
      selectors.some((selector) => selector.includes(fragment)),
    )
    .map(({ declarations }) => declarations.get(property))
    .filter((value): value is string => value !== undefined);

/** The rules for a selector containing `fragment`, on one window's ink. */
const badgeRules = (css: string, fragment: string, onWhite: boolean) =>
  styleRules(css).filter(({ selectors }) =>
    selectors.some(
      (selector) =>
        selector.includes(fragment) &&
        selector.includes('[data-window-ink=dark]') === onWhite,
    ),
  );

/** Every value of `property` among `rules`, each once. */
const valuesIn = (rules: ReturnType<typeof badgeRules>, property: string) => [
  ...new Set(
    rules
      .map(({ declarations }) => declarations.get(property))
      .filter((value): value is string => value !== undefined),
  ),
];

/** The inks and fills `selector` is given on each side of the window. */
const badgeFace = (css: string, selector: string) => {
  const dark = badgeRules(css, selector, false);
  const white = badgeRules(css, selector, true);
  return {
    darkInk: valuesIn(dark, 'color'),
    darkFill: valuesIn(dark, 'background'),
    whiteInk: valuesIn(white, 'color'),
    whiteFill: valuesIn(white, 'background'),
  };
};

/**
 * The "on" badge: the token's lit tint and the token lit toward the text's
 * ink on a dark window, the token and its own label on the white one - and,
 * being exactly these, the lime itself written nowhere in it.
 */
const ON_BADGE = {
  darkInk: ['color-mix(in oklab, var(--active), var(--text-primary))'],
  darkFill: [
    expect.stringMatching(
      /^color-mix\(in srgb, var\(--active\) \d+%, transparent\)$/,
    ),
  ],
  whiteInk: ['var(--on-active)'],
  whiteFill: ['var(--active)'],
};

describe('the "on" colour', () => {
  it('defaults to the lime it always was, on the root', () => {
    const app = compileStylesheet('App.scss');
    const root = styleRules(app).find(
      ({ selectors, declarations }) =>
        selectors.includes(':root') && declarations.has('--active'),
    );
    expect(root?.declarations.get('--active')).toBe(LIME);
  });

  // A badge says "on" as the shared "on" badge does (`badge-on` in
  // `_themeMixins.scss`): on a dark window the token's lit tint with its
  // words the token lit halfway to the text's ink (in the token alone they
  // stood at 2.3:1 once "on" could be a deep colour); on the white window
  // the token itself with its own label on it (fad25fea4).
  it.each([
    ['DeviceProfiles.scss', '.default-badge'],
    ['PresetsBar.scss', '.preset-attached'],
  ])('%s says "on" with the token in the badge %s', (file, selector) => {
    expect(badgeFace(compileStylesheet(file), selector)).toEqual(ON_BADGE);
  });

  it.each([
    ['Gallery.scss', '.gallery-preview__live', 'background'],
    ['Studio.scss', '.studio-projects__live', 'background'],
    ['StudioCode.scss', '.studio-code__dot', 'background'],
    ['MainContent.scss', '.eq-mode__bubble-text', 'color'],
  ])('%s says "on" with the token in %s', (file, selector, property) => {
    const values = valuesFor(compileStylesheet(file), selector, property);
    expect(values).toContain('var(--active)');
    expect(values).not.toContain(LIME);
  });

  // A healthy light says "on" too, and takes the scene's colour with the
  // rest; its warnings stay amber and red, which the scene's "on" colour is
  // chosen far enough from never to be mistaken for (`sceneTint.ts`).
  it.each([
    ['StudioStage.scss', '.studio-cost', 'background'],
    ['_RemoteAudioLink.scss', '.remote-audio__link-health', 'background'],
  ])(
    '%s lights a healthy %s in the token and its warnings in their own colours',
    (file, block, property) => {
      const rules = styleRules(compileStylesheet(file)).filter(
        ({ selectors, declarations }) =>
          selectors.some((selector) => selector.startsWith(block)) &&
          declarations.has(property),
      );
      const values = rules.map(({ declarations }) =>
        declarations.get(property),
      );
      expect(values[0]).toBe('var(--active)');
      expect(values.slice(1).length).toBeGreaterThan(0);
      values.slice(1).forEach((value) => {
        expect(value).not.toBe('var(--active)');
        expect(value).not.toBe(LIME);
      });
    },
  );

  // The output being played through says so in its badge alone since
  // acfe5916b (a second left-hand line beside the Library's mark could not
  // be told apart), and the "applied" line is its dot and its colour.
  it('marks Equalizer APO’s configuration as applied, and the output playing, with the token', () => {
    const css = compileStylesheet('ConfigInspector.scss');
    expect(badgeFace(css, '.config-card__badge')).toEqual(ON_BADGE);
    expect(valuesFor(css, '.config-status--on', 'color')).toEqual([
      'var(--active)',
    ]);
    expect(valuesFor(css, '.config-status--on::before', 'background')).toEqual([
      'var(--active)',
    ]);
  });
});
