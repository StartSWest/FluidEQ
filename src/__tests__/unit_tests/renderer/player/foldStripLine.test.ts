/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The folded strip's song line does not glow (Ivan, 2026-10-26: "the bar not
 * glowing"), and its knob shows only under the pointer, while dragged or
 * focused (A3 of the one-line mockups). It glowed three ways at once — the
 * track's own glow, a drop shadow round the whole line and a halo round the
 * knob — so each is held here. jsdom lays nothing out, so what is held is
 * the compiled rule.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile, compileString } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'renderer',
  'styles',
);

const css = compile(path.join(STYLES_DIR, '_miniPlayerFold.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
}).css.replace(/\s+/g, ' ');

// The app's one slider, which the amps' `.player-range` is
// (`_ampSliders.scss`), ringed in the amp's floor as the amps ring it.
const SLIDER = compileString(
  "@use 'themeMixins' as *;\n.one-slider { @include toggle-knob-slider(var(--fill, 0%), var(--player-floor)); }",
  { loadPaths: [STYLES_DIR], quietDeps: true },
).css.replace(/\s+/g, ' ');

const rulesOf = (sheet: string) =>
  [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    body,
  }));

/** Every rule whose selector list names the line, with its declarations. */
const lineRules = () =>
  rulesOf(css).filter(({ selector }) =>
    selector.includes('.player-fold__seek'),
  );

const bodyOf = (selector: string, sheet = css) =>
  rulesOf(sheet).find((rule) => rule.selector === selector)?.body ?? '';

describe('the folded strip’s song line', () => {
  // The positive control: the rules are found, or every "never" below holds
  // of nothing.
  it('is drawn by the strip’s own rules', () => {
    expect(lineRules().length).toBeGreaterThanOrEqual(3);
    expect(bodyOf('.player-fold__seek.player-range')).toContain(
      'position: absolute',
    );
  });

  it('lights no glow on its track and no halo round its knob', () => {
    // The line is the app's one slider drawn small (2026-11-15), which has
    // no glow to switch off: its knob wears a hard ring in the floor under
    // it, and its track a hairline inside the well. The amp's own glowing
    // line, and the variables that turned its glow off here, are gone.
    const thumb = bodyOf('.one-slider::-webkit-slider-thumb', SLIDER);
    expect(thumb).toMatch(/box-shadow: 0 0 0 \d+px /);
    expect(
      bodyOf('.one-slider::-webkit-slider-runnable-track', SLIDER),
    ).toMatch(/box-shadow: inset 0 0 0 1px /);
    // Nothing on the line itself brings one back.
    lineRules().forEach(({ body }) => {
      expect(body).not.toMatch(/--glow|--thumb-halo|box-shadow/);
    });
  });

  it('casts no shadow round the line', () => {
    lineRules().forEach(({ body }) => {
      expect(body).not.toMatch(/drop-shadow|filter:\s*(?!none)/);
    });
  });

  it('keeps its knob out of sight until the pointer or a drag reaches it', () => {
    expect(
      bodyOf('.player-fold__seek.player-range::-webkit-slider-thumb'),
    ).toContain('opacity: 0');
    const shown = lineRules().filter(({ body }) => body.includes('opacity: 1'));
    const selectors = shown.map(({ selector }) => selector).join(' ');
    expect(selectors).toContain(':hover::-webkit-slider-thumb');
    expect(selectors).toContain(':active::-webkit-slider-thumb');
    expect(selectors).toContain(':focus-visible::-webkit-slider-thumb');
  });
});
