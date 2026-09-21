/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene stage's shape and its wait, held as text.
 *
 * Nothing rendered can see any of this: jsdom computes no layout, runs no
 * animation and resolves no cascade, and each of these rules exists because of
 * something that could only be seen in the running window.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const { css } = compile(path.join(STYLES_DIR, 'Gallery.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/** The body of the first rule whose selector contains `selector`. */
const bodyOf = (selector: string, from = 0): string => {
  const at = css.indexOf(selector, from);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

it('caps the scene page stage without letting it give up its width', () => {
  const body = bodyOf('.gallery-scene .gallery-preview');
  expect(body).toContain('max-height: min(56vh, 560px)');
  // The width has to be stated. A box whose width is `auto` keeps 16/9 by
  // narrowing instead, and the stage pulled 428px away from the panel beside
  // it — measured in the running window.
  expect(body).toContain('width: 100%');
});

it('paints the stage an opaque ground of the scene’s own colour', () => {
  const body = bodyOf('.gallery-preview__ground');
  // The window is transparent to its backdrop material, so a stage with no
  // ground of its own is the desktop's colour for any frame nothing paints.
  expect(body).toContain('background: var(--scene-sky');
  expect(body).toContain('position: absolute');
});

it('crosses the picture over to the scene instead of swapping it', () => {
  const body = bodyOf('.gallery-preview__still.is-behind');
  expect(body).toContain('opacity: 0');
  // A card's framing is not this band's, so the two do not line up and a
  // quick swap reads as the picture jumping. It holds while the scene reaches
  // full strength and then takes its time; the scene behind it is the same
  // scene, so the wait costs nothing.
  expect(body).toMatch(/transition: opacity 700ms [^;]*900ms/);
});

it('holds the wait ring back so a scene already downloaded never flashes one', () => {
  const body = bodyOf('.gallery-preview__wait');
  // Delayed, and filling backwards, so the element is painted at the fade's
  // first frame — nothing — for the whole of the hold.
  expect(body).toMatch(/animation: fade-in .* 500ms backwards/);
  expect(bodyOf('.gallery-preview__wait.is-done')).toContain('animation: none');
});

it('keeps that hold when the app stands its animations down', () => {
  // Two separate stand-downs, and either one on its own brought the flash
  // back: the `animate` mixin turns itself off under `prefers-reduced-motion`,
  // which is how the window is launched when Animations are off, and App.scss
  // stands every animation down the moment the switch is thrown mid-session.
  const media = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(media).toBeGreaterThan(-1);
  expect(bodyOf('.gallery-preview__wait:not(.is-done)', media)).toMatch(
    /animation: fade-in .* 500ms backwards/,
  );
  expect(
    bodyOf(':root[data-motion=reduced] .gallery-preview__wait:not(.is-done)'),
  ).toContain('animation-delay: 500ms !important');
});
