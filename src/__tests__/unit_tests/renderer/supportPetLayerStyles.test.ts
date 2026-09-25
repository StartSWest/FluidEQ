/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The pet's layers (`PetArt.tsx`) have to move exactly as the groups they
 * replaced: the same pivots, the same travel, in the drawing's units. Nothing
 * rendered can see a pivot, so it is held as the stylesheet's text, against
 * the numbers of the drawing.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import path from 'path';
import { compile } from 'sass';
import { DANCE_ANIMATION } from '../../../renderer/SupportPet';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');
const { css } = compile(path.join(STYLES_DIR, 'SupportPet.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/**
 * The body of the first rule opened by exactly `selector`, braces excluded:
 * from the start of a line, so a longer selector ending in it is not it.
 */
const bodyOf = (selector: string, from = 0): string => {
  const at = css.indexOf(`\n${selector} {`, from);
  if (at < 0) {
    return '';
  }
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};

/** A point of the 40-unit drawing as a share of its square. */
const share = (units: number) => `${Number(((units / 40) * 100).toFixed(4))}%`;

it('pivots each layer where its group’s own box had its pivot', () => {
  // The body's circle ends at 24 + 12.5; the eyes are centred on y 22; the
  // star's points span 27.4-35.6 across and 8.2-16 down.
  expect(bodyOf('.support-pet__body')).toContain(
    `transform-origin: 50% ${share(36.5)}`,
  );
  expect(bodyOf('.support-pet__eyes')).toContain(
    `transform-origin: 50% ${share(22)}`,
  );
  expect(bodyOf('.support-pet__star')).toContain(
    `transform-origin: ${share(31.5)} ${share(12.1)}`,
  );
  // The control: the ears are still a group in their drawing, pivoting on
  // their own box.
  expect(bodyOf('.support-pet__ears')).toContain('transform-box: fill-box');
  // And no layer is left pivoting on a box it no longer has.
  expect(bodyOf('.support-pet__body')).not.toContain('fill-box');
  expect(bodyOf('.support-pet__eyes')).not.toContain('fill-box');
});

it('moves a layer as far as its group moved, in the drawing’s units', () => {
  // 0.6 and -1.4 units of bob, 1.5 and 3.4 of press.
  const bob = css.slice(css.indexOf('@keyframes pet-bob-layer'));
  expect(bob).toContain(`translate: 0 ${share(0.6)}`);
  expect(bob).toContain(`translate: 0 ${share(-1.4)}`);
  expect(css).toContain(`transform: translateY(${share(1.5)}) scaleY(0.92)`);
  expect(css).toContain(`translate: 0 ${share(3.4)}`);
});

it('ends the dance with a whole number of sways the pet listens for', () => {
  const dance = bodyOf(
    '.support-pet.is-celebrating.is-dancing .support-pet__art',
  );
  expect(dance).toContain(`animation: ${DANCE_ANIMATION} 1150ms`);
  expect(dance).toMatch(/ 6 forwards;/);
  // The same shape as the sway it hands back to, so the hand-over is still.
  const frames = (name: string) => {
    const at = css.indexOf(`@keyframes ${name} {`);
    return css.slice(css.indexOf('{', at), css.indexOf('}\n}', at));
  };
  expect(frames(DANCE_ANIMATION)).toBe(frames('pet-sway'));
  expect(frames('pet-sway')).toContain('rotate: -9deg');
});

it('squints inside the drawings, and lets a perfect tap replace it', () => {
  const squint = bodyOf('.support-pet__squint');
  expect(squint).toContain('transform-box: view-box');
  expect(squint).toContain('transform-origin: 20px 22px');
  expect(squint).toContain('scale: 1 calc(1 - var(--pet-joy, 0) * 0.3)');
  // Not on the layer too, or the streak would squeeze the eyes twice.
  expect(bodyOf('.support-pet__eyes')).not.toContain('--pet-joy');
  expect(bodyOf('.support-pet-tap.is-perfect .support-pet__squint')).toContain(
    'scale: none',
  );
});
