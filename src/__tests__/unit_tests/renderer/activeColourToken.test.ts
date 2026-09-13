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

  it.each([
    ['DeviceProfiles.scss', '.default-badge', 'background'],
    ['PresetsBar.scss', '.preset-attached', 'background'],
    ['Gallery.scss', '.gallery-preview__live', 'background'],
    ['Studio.scss', '.studio-projects__live', 'background'],
    ['StudioCode.scss', '.studio-code__dot', 'background'],
    ['MainContent.scss', '.eq-mode__bubble-text', 'color'],
  ])('%s says "on" with the token in %s', (file, selector, property) => {
    const values = valuesFor(compileStylesheet(file), selector, property);
    expect(values).toContain('var(--active)');
    expect(values).not.toContain(LIME);
  });

  it('leaves a traffic light green: the Studio says a scene runs smoothly in green, not in a scene’s colour', () => {
    const values = valuesFor(
      compileStylesheet('StudioStage.scss'),
      '.studio-cost__dot',
      'background',
    );
    expect(values[0]).toBe(LIME);
  });
});
