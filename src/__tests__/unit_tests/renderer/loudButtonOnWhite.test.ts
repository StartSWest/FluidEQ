/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The suggested action is solid on a light window (Ivan, 2026-11-25, "yes"
 * to a before and after of the Scenes sign-up, Add curve and the first-run
 * notice): the accent at 22% over white read as switched off beside the
 * quiet outlines next to it. What is a state rather than a press - a switch
 * on, the chosen one of a set, a menu open - keeps the tint, or a chosen
 * band or a vote given becomes the loudest thing on its row. The credit's
 * coin on a solid face rings itself in the face's word colour (Ivan, the
 * same day: "make sure that the coin is visible"), where its dark outline
 * and accent rim sank into the fill.
 *
 * jsdom paints nothing, so what is held is the compiled sheets.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

// As Sass writes them: the quotes round a plain word are dropped.
const LIGHT = ':where(:root[data-window-ink=dark])';
const NOT_A_STATE =
  ':where(:not([aria-pressed], [aria-checked], [aria-selected], [aria-current], [aria-expanded]))';

const sheets = new Map<string, IRule[]>();
const rulesOf = (sheet: string): IRule[] => {
  const known = sheets.get(sheet);
  if (known) {
    return known;
  }
  const rules = styleRules(compileStylesheet(sheet));
  sheets.set(sheet, rules);
  return rules;
};

const declared = (sheet: string, selector: string) =>
  rulesOf(sheet)
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.declarations);

/** The light window's face for `selector`, at rest. */
const solidFace = (sheet: string, selector: string) =>
  declared(sheet, `${LIGHT} ${selector}${NOT_A_STATE}`);

/** Every light-window rule that names `selector` at all. */
const lightRulesNaming = (sheet: string, selector: string) =>
  rulesOf(sheet).filter((rule) =>
    rule.selectors.some(
      (one) => one.startsWith(LIGHT) && one.includes(selector),
    ),
  );

describe('the suggested action on a light window', () => {
  it('is the accent, solid, with the accent’s own label', () => {
    const face = solidFace('Button.scss', '.button');
    expect(face).toHaveLength(1);
    expect(face[0].get('background')).toBe('var(--accent)');
    expect(face[0].get('color')).toBe('var(--on-accent)');
    expect(face[0].get('border-color')).toBe('transparent');
    // On a dark window the same button keeps its tint: the rule above is
    // the only one that fills it.
    const dark = declared('Button.scss', '.button').find((rule) =>
      rule.has('background'),
    );
    expect(dark?.get('background')).not.toBe('var(--accent)');
  });

  it('is red, solid, under the panes’ white for an answer that cannot be taken back', () => {
    const face = solidFace('Button.scss', '.button.danger');
    expect(face).toHaveLength(1);
    expect(face[0].get('background')).toMatch(/^var\(--ink-removed/);
    expect(face[0].get('color')).toBe('var(--surface-panel)');
  });

  it('rings the credit’s coin in the word’s colour', () => {
    const [face] = solidFace('Button.scss', '.button');
    expect(face.get('--coin-ring')).toBe(face.get('color'));
    expect(face.get('--coin-rim-low')).toContain(face.get('color'));
  });

  it('never fills a pressed, chosen, selected, current or open button', () => {
    const light = lightRulesNaming('Button.scss', '.button');
    // Positive control: there are light rules for the button at all.
    expect(light.length).toBeGreaterThan(2);
    light.forEach((rule) =>
      rule.selectors
        .filter((one) => one.startsWith(LIGHT))
        .forEach((one) => expect(one).toContain(NOT_A_STATE)),
    );
  });

  it.each([
    ['MyCurveRow.scss', '.my-curve__actions .button.is-armed'],
    ['EqAutoPanel.scss', '.eq-auto__save'],
    ['Library.scss', '.library-hero__button.is-go'],
    [
      'Karaoke.scss',
      '.karaoke-maker button:not(:where(.dialog-frame .button, .compact-frame .button, .dialog-close)).is-primary',
    ],
  ])('fills %s’s action %s', (sheet, selector) => {
    expect(solidFace(sheet, selector)).toHaveLength(1);
  });

  it.each([
    ['Dsp.scss', '.dsp-eq-pick.is-active'],
    ['Library.scss', '.library-toolbar__chip.is-active'],
    [
      'Library.scss',
      '.library-pane__drawer-head > .library-up-next__chip.is-active',
    ],
    ['ActionsMenu.scss', '.menu-preference__choice.is-on'],
    ['ForumPost.scss', '.forum-post__vote.is-on'],
    ['Gallery.scss', '.gallery-like.is-on'],
    [
      'Karaoke.scss',
      '.karaoke-maker button:not(:where(.dialog-frame .button, .compact-frame .button, .dialog-close)).is-active',
    ],
  ])('keeps %s’s state %s tinted', (sheet, selector) => {
    // Control: the state is lit on every window.
    expect(
      declared(sheet, selector).some((rule) => rule.has('background')),
    ).toBe(true);
    expect(lightRulesNaming(sheet, selector)).toEqual([]);
  });
});
