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
    expect(bodyOf(css, '.support-pet__eye-waves path')).toContain(
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

  it('drifts once and then rests lit, arriving or not', () => {
    expect(bodyOf(css, '.eq-engine-label')).toContain(
      'animation: eq-engine-flow 4s linear;',
    );
    const riding = bodyOf(css, '.eq-engine-label.is-riding');
    expect(riding).toContain('eq-engine-flow 4s linear,');
    expect(riding).not.toContain('eq-engine-flow 4s linear infinite');
    // The control: the waiting state's crest does loop, in the same sheet.
    expect(bodyOf(css, '.eq-engine-line--checking .eq-engine-label')).toContain(
      'eq-engine-crest 1.6s linear infinite',
    );
  });

  it('ends the pass on a picture identical to where it began', () => {
    // The image is twice the box, so -200% is one whole image along.
    expect(bodyOf(css, '.eq-engine-label')).toContain(
      'background-size: 200% 100%',
    );
    expect(keyframesOf(css, 'eq-engine-flow')).toContain(
      'background-position: -200% 0',
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

describe('the amp', () => {
  const css = cssOf('MiniPlayer.scss');

  // Each bar's height at rest, in px of the 10px meter, and the floor all three
  // fell to when the fall was the bar's own `height` (25%).
  const RESTS = [6, 10, 4];
  const FLOOR = 2.5;
  const RADIUS = 1;

  it('moves the queue’s bars without changing anything’s size', () => {
    expect(css).not.toContain('@keyframes player-queue-bars');
    RESTS.forEach((_rest, index) => {
      const body = keyframesOf(css, `player-queue-bar-${index + 1}-body`);
      const cap = keyframesOf(css, `player-queue-bar-${index + 1}-cap`);
      expect(body).toMatch(/scale: 1 [\d.]+;/);
      expect(cap).toMatch(/translate: 0 [\d.]+px;/);
      expect(`${body}${cap}`).not.toContain('height');
    });
    // The bar's box keeps its height and draws no lamp itself: the glow is
    // one filter over the pieces, the same 4px halo at every height.
    const bar = bodyOf(css, '.player-queue__bars span');
    expect(bar).not.toContain('animation');
    expect(bar).toContain('filter: drop-shadow(0 0 4px var(--player-glow))');
  });

  it('brings every bar down to the floor the height animation did', () => {
    RESTS.forEach((rest, index) => {
      const scale = Number(
        /scale: 1 ([\d.]+);/.exec(
          keyframesOf(css, `player-queue-bar-${index + 1}-body`),
        )?.[1],
      );
      const drop = Number(
        /translate: 0 ([\d.]+)px;/.exec(
          keyframesOf(css, `player-queue-bar-${index + 1}-cap`),
        )?.[1],
      );
      // The body starts a radius down and shrinks from the foot; the cap
      // rides the top. Both have to land on the same height.
      expect((rest - RADIUS) * scale + RADIUS).toBeCloseTo(FLOOR, 6);
      expect(rest - drop).toBeCloseTo(FLOOR, 6);
    });
  });

  it('keeps the bars still for anybody who asked for less motion', () => {
    const media = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(media).toBeGreaterThan(-1);
    expect(
      bodyOf(css, '.player-queue__bars span:nth-child(n)::after', media),
    ).toContain('animation: none');
  });

  it('blinks the paused clock by the lit layer’s opacity alone', () => {
    // One animation, of a property the compositor runs, on the layer that
    // holds the lit segments (`LedClock.tsx`).
    expect(bodyOf(css, '.player-clock.is-paused .led-clock__lit')).toContain(
      'animation: player-led-blink 1s steps(1) infinite',
    );
    const blink = keyframesOf(css, 'player-led-blink');
    expect(blink).toContain('opacity: 0');
    expect(blink).not.toContain('fill');
    expect(blink).not.toContain('--');
    // Nothing restyles the segments: lit is ink and glow, the face is ghost.
    expect(css).not.toContain('--player-led-lit');
    const lit = bodyOf(css, '.led-clock .is-lit');
    expect(lit).toContain('fill: var(--player-ink)');
    expect(lit).toContain('filter: drop-shadow(0 0 3px var(--player-glow))');
    expect(bodyOf(css, '.led-clock .is-ghost')).toContain(
      'fill: var(--player-lcd-ghost)',
    );
  });

  it('keeps the paused clock lit and still for less motion', () => {
    const media = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(media).toBeGreaterThan(-1);
    expect(
      bodyOf(css, '.player-clock.is-paused .led-clock__lit', media),
    ).toContain('animation: none');
  });
});

describe('the Library’s now-playing mark', () => {
  const css = cssOf('Library.scss');

  it('glows once over its four bars, not once on each', () => {
    expect(bodyOf(css, '.library-list__playing-bars rect')).not.toContain(
      'filter',
    );
    expect(bodyOf(css, '.library-list__playing-frame svg')).toContain(
      'filter: drop-shadow(0 0 3px',
    );
    // The control: the bars still move, each on its own period.
    expect(bodyOf(css, '.library-list__playing-bars rect')).toContain(
      'animation: library-playing-bar 1000ms',
    );
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
