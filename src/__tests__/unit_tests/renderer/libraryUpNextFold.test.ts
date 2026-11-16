/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library tab's Up next panel folding towards its edge, and the shelf
 * taking its strip back in the same movement, on the Plus rail's motion.
 *
 * It used to be unmounted with only its arrival animated, so folding it was
 * one frame. jsdom neither lays out nor animates, so the fold is checked on
 * the compiled stylesheet, where what went wrong while it was built can be
 * seen: the drag exception outranked by the shelf's own transition rule, and
 * the full-screen slide's transition list replacing the fold's.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

describe('how the Up next panel folds', () => {
  const css = compileStylesheet('Library.scss');
  const rules = styleRules(css);

  const declarations = (selector: string, property: string) =>
    rules
      .filter(
        (rule) =>
          rule.selectors.includes(selector) && rule.declarations.has(property),
      )
      .map((rule) => rule.declarations.get(property));

  it('closes the panel towards its edge instead of removing it', () => {
    expect(declarations('.library-up-next.is-collapsed', 'width')).toEqual([
      '0',
    ]);
    expect(declarations('.library-up-next.is-collapsed', 'visibility')).toEqual(
      ['hidden'],
    );
    // It slides from its edge at its full width, never easing the width
    // itself: a width eased over the move re-laid the shelf every frame and
    // the cover grid counted its columns again each time (Ivan, 2026-11-15:
    // "it seems like the grid is trying to figure out how many columns").
    const [opening] = declarations('.library-up-next', 'transition');
    expect(opening).toMatch(/translate var\(--up-next-move\)/);
    expect(opening).not.toMatch(/width/);
    // Folding, the width goes in one step once the slide is over.
    const [folding] = declarations(
      '.library-up-next.is-collapsed',
      'transition',
    );
    expect(folding).toMatch(/translate var\(--up-next-move\)/);
    expect(folding).toMatch(/width 0s linear var\(--up-next-move\)/);
    // The arrival-only slide the unmounted panel had is gone with it.
    expect(css).not.toContain('@keyframes up-next-in');
  });

  it('gives the shelf its width back in the same movement, except under a drag', () => {
    // The queue is a column of the card's own grid, sized by the panel: as
    // the panel narrows the shelf's column takes the width frame by frame,
    // with no transition of its own to fall out of step. It used to be a
    // margin on every other child, transitioned to match the panel's.
    expect(
      declarations('.library-workspace', 'grid-template-columns'),
    ).toContain('auto minmax(0, 1fr) auto');
    expect(declarations('.library-side', 'grid-column')).toContain('3');
    expect(css).not.toMatch(/transition: margin-right var\(--up-next-move\)/);
    // A drag moves the edge under the pointer, so the panel's own width
    // follows it at once. The card says it is being resized
    // (`LibraryWorkspace`) rather than the stylesheet asking with `:has()`.
    expect(
      declarations(
        '.library-workspace.is-resizing-up-next .library-up-next',
        'transition',
      ),
    ).toEqual(['none']);
  });

  it('keeps the full-screen slide in the panel’s own transitions rather than replacing them', () => {
    const chrome = rules.filter(
      ({ selectors, declarations: declared }) =>
        declared.has('transition') &&
        selectors.some((selector) =>
          selector.startsWith('.library-workspace.is-video-full'),
        ),
    );
    expect(chrome.length).toBeGreaterThan(0);
    chrome.forEach(({ selectors }) =>
      selectors.forEach((selector) =>
        expect(selector).not.toMatch(/\.library-up-next$/),
      ),
    );
    const [opening] = declarations('.library-up-next', 'transition');
    expect(opening).toMatch(/transform var\(--up-next-chrome\)/);
  });

  it('still folds under reduced motion, shorter, instead of jumping', () => {
    const move = rules
      .filter(({ within }) =>
        within.some((rule) => rule.includes('prefers-reduced-motion: reduce')),
      )
      .map(({ declarations: declared }) => declared.get('--up-next-move'))
      .find(Boolean);
    expect(move).toMatch(/^[1-9]\d*ms$/);
  });
});
