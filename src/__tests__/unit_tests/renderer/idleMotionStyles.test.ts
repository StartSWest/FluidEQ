/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Motion that ran for nobody, or ran on the main thread where the compositor
 * could have carried it, held as the stylesheets' own text.
 *
 * Nothing rendered can see any of this: jsdom runs no animation and resolves
 * no cascade, and every one of these cost a paint or a layout a frame in the
 * running window while looking exactly as it was meant to.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import path from 'path';
import { compile } from 'sass';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const cssOf = (name: string) =>
  compile(path.join(STYLES_DIR, name), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  }).css;

/** The body of the first rule that `selector` opens, braces excluded. */
const bodyOf = (css: string, selector: string, from = 0): string => {
  const at = css.indexOf(`${selector} {`, from);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

/** The bodies of every rule that `selector` opens, joined. */
const bodiesOf = (css: string, selector: string): string => {
  const bodies: string[] = [];
  let at = css.indexOf(`${selector} {`);
  while (at >= 0) {
    const open = css.indexOf('{', at);
    bodies.push(css.slice(open + 1, css.indexOf('}', open)));
    at = css.indexOf(`${selector} {`, open);
  }
  return bodies.join('\n');
};

/** Everything between `@keyframes name {` and the brace that closes it. */
const keyframesOf = (css: string, name: string): string => {
  const at = css.indexOf(`@keyframes ${name} {`);
  if (at < 0) {
    return '';
  }
  let depth = 0;
  for (let index = css.indexOf('{', at); index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(at, index + 1);
      }
    }
  }
  return '';
};

describe('the titlebar pet', () => {
  const css = cssOf('SupportPet.scss');

  it('draws the waves in its eyes only while there is a streak to show', () => {
    const waves = bodyOf(css, '.support-pet__eye-waves');
    expect(waves).toContain('display: none');
    // Taken out only once the fade to nothing is over, so a run that ends
    // keeps scrolling while it fades.
    expect(waves).toContain('display 0s linear 260ms allow-discrete');
    // The control: under a streak they are drawn, and they still scroll.
    expect(bodyOf(css, ':root.has-pet-joy .support-pet__eye-waves')).toContain(
      'display: block',
    );
    // On a layer of the page (2026-11-16), so the compositor scrolls it.
    expect(bodiesOf(css, '\n.support-pet__eye-wave')).toContain(
      'animation: pet-eye-scroll 900ms linear infinite',
    );
  });

  it('fades them in from nothing, as it did when they were always drawn', () => {
    const starting = css.indexOf('@starting-style');
    expect(starting).toBeGreaterThan(-1);
    const from = bodyOf(
      css,
      ':root.has-pet-joy .support-pet__eye-waves',
      starting,
    );
    expect(from).toContain('opacity: 0');
    expect(from).toContain('stroke-width: 0.35px');
  });
});

describe('the engine’s name over the EQ', () => {
  const css = cssOf('MainContent.scss');

  // Plain ink since 2026-11-17 (Ivan: "fix FluidEQ Engine, change that text
  // too, it can't be in little colours like that"): the drift through its
  // letters is gone, and nothing moves it at rest.
  it('rests in the words’ own ink, with no drift through its letters', () => {
    const label = bodyOf(css, '\n.eq-engine-label');
    expect(label).toContain('color: var(--text-primary)');
    expect(label).not.toContain('animation');
    expect(label).not.toContain('background');
    expect(keyframesOf(css, 'eq-engine-flow')).toBe('');
    // Its arrival plays once, never on a loop.
    const riding = bodyOf(css, '.eq-engine-label.is-riding');
    expect(riding).toContain('eq-engine-arrive 640ms');
    expect(riding).not.toContain('infinite');
    // The control: the waiting state's crest does loop, in the same sheet.
    expect(bodyOf(css, '.eq-engine-line--checking .eq-engine-label')).toContain(
      'eq-engine-crest 1.6s linear infinite',
    );
  });
});

describe('the scene page’s wait', () => {
  const css = cssOf('Gallery.scss');

  it('lets go of its blur and its ring once it has faded', () => {
    const done = bodyOf(css, '.gallery-preview__wait.is-done');
    expect(done).toContain('backdrop-filter: none');
    // Held for the fade, so the fade is exactly what it was.
    expect(done).toContain('backdrop-filter 0s linear 520ms');
    expect(done).toContain('visibility 0s linear 520ms');
    const ring = bodyOf(
      css,
      '.gallery-preview__wait.is-done .gallery-preview__wait-mark::before',
    );
    expect(ring).toContain('display: none');
    expect(ring).toContain('display 0s linear 520ms allow-discrete');
  });

  it('keeps the blur and the ring while it is waiting', () => {
    // The control for the rule above: the veil it inherits from blurs, and
    // the ring turns.
    expect(bodyOf(css, '.gallery-preview__veil')).toContain(
      'backdrop-filter: blur(3px)',
    );
    // From the start of a line: the rule above ends with the same selector.
    expect(bodyOf(css, '\n.gallery-preview__wait-mark::before')).toContain(
      'animation: loading-ring-turn',
    );
  });
});

describe('the aurora under a scene band', () => {
  it('holds still under the scene’s picture and drifts without one', () => {
    const css = cssOf('SceneBand.scss');
    expect(bodyOf(css, '.scene-band.is-scene::before')).toContain(
      'animation-play-state: paused',
    );
    expect(bodyOf(css, '.scene-band::before')).toContain(
      'animation: fluid-aurora-drift',
    );
  });
});

describe('the Library’s now-playing mark', () => {
  const css = cssOf('Library.scss');

  // The bars are elements of the page moved by `scale` (2026-11-16), which
  // the compositor runs; their box carries the one glow.
  it('glows once over its four bars, not once on each', () => {
    const bar = bodyOf(css, '.library-list__playing-bars > span');
    expect(bar).not.toContain('filter');
    expect(bodyOf(css, '\n.library-list__playing-bars')).toContain(
      'filter: drop-shadow(0 0 3px',
    );
    // The control: the bars still move, each on its own period.
    expect(bar).toContain('animation: library-playing-bar 1000ms');
    expect(keyframesOf(css, 'library-playing-bar')).toContain('scale:');
  });

  it('lays its drawing out in a box of its own, the mark’s own size', () => {
    expect(bodyOf(css, '.library-list__playing-mark')).toContain(
      'display: block',
    );
    const frame = bodyOf(css, '.library-list__playing-frame');
    expect(frame).toContain('contain: size layout style');
    expect(frame).toContain('width: 100%');
    expect(frame).toContain('height: 100%');
  });
});
