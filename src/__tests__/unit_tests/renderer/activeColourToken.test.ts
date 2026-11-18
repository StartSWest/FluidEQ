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

describe('the "on" colour', () => {
  it('defaults to the lime it always was, on the root', () => {
    const app = compileStylesheet('App.scss');
    const root = styleRules(app).find(
      ({ selectors, declarations }) =>
        selectors.includes(':root') && declarations.has('--active'),
    );
    expect(root?.declarations.get('--active')).toBe(LIME);
  });

  // A badge says "on" as the shared badge face does (2026-11-17, `badge` in
  // `_themeMixins.scss`): the token's own ink over the token's lit tint.
  it.each([
    ['DeviceProfiles.scss', '.default-badge'],
    ['PresetsBar.scss', '.preset-attached'],
  ])('%s says "on" with the token in the badge %s', (file, selector) => {
    const css = compileStylesheet(file);
    const inks = valuesFor(css, selector, 'color');
    const fills = valuesFor(css, selector, 'background');
    expect(inks).toContain('var(--active)');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect(fill).toMatch(
        /^color-mix\(in srgb, var\(--active\) \d+%, transparent\)$/,
      );
    });
    // CONTROL: the lime itself is written nowhere in it.
    [...inks, ...fills].forEach((value) => {
      expect(value.toLowerCase()).not.toContain(LIME);
    });
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

  it('marks Equalizer APO’s configuration as applied, and the output playing, with the token', () => {
    const css = compileStylesheet('ConfigInspector.scss');
    expect(valuesFor(css, '.config-card__badge', 'color')).toEqual([
      'var(--active)',
    ]);
    expect(
      valuesFor(css, '.config-card.is-current', 'box-shadow').join(),
    ).toContain('var(--active)');
  });
});
