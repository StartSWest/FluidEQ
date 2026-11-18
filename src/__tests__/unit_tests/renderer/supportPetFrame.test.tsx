/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The pet's drawing moves every frame music plays, and a drawing that moves
 * is laid out again. As the item of the grid that centres it, the browser
 * laid the whole window out with it each time; inside a frame of its own the
 * drawing is laid out alone. The grids are the titlebar button's, the hero's
 * and the EQ bubble's, and each centres whatever it holds — so the drawing
 * must never be what it holds.
 *
 * And the drawing is layers (`PetArt.tsx`): what breathes and what blinks
 * each has one of its own, so the compositor moves them, and what holds still
 * through both is outside them.
 */

import { render } from '@testing-library/react';
import { PetArt } from '../../../renderer/SupportPet';

it('stands the drawing in a frame of its own, never straight in a grid', () => {
  const { container } = render(<PetArt />);
  const drawing = container.querySelector('.support-pet__art');

  expect(container.firstElementChild).toHaveProperty(
    'className',
    'support-pet__frame',
  );
  expect(drawing?.parentElement).toBe(container.firstElementChild);
});

it('breathes and blinks on layers of their own, the eyes riding the body', () => {
  const { container } = render(<PetArt />);
  const art = container.querySelector('.support-pet__art');
  const body = container.querySelector('.support-pet__body');
  const eyes = container.querySelector('.support-pet__eyes');

  // A layer is an element of the page, never a group inside a drawing: the
  // compositor animates the one and not the other.
  expect(body?.tagName).toBe('SPAN');
  expect(eyes?.tagName).toBe('SPAN');
  expect(body?.parentElement).toBe(art);
  expect(eyes?.parentElement).toBe(body);
  // Pupils, the waves in them, highlights: in that order, all in the eyes.
  expect(
    [...(eyes?.children ?? [])].map((layer) => layer.getAttribute('class')),
  ).toEqual([
    'support-pet__layer',
    'support-pet__eye-waves support-pet__layer',
    'support-pet__layer',
  ]);
});

it('keeps the ears and the star out of the breath, in the drawing’s order', () => {
  const { container } = render(<PetArt />);
  const art = container.querySelector('.support-pet__art');
  const ears = container.querySelector('.support-pet__ears');
  const star = container.querySelector('.support-pet__star');
  const body = container.querySelector('.support-pet__body');

  // The control: the body does hold the face.
  expect(body?.querySelector('.support-pet__mouth')).not.toBeNull();
  expect(body?.contains(ears ?? null)).toBe(false);
  expect(body?.contains(star ?? null)).toBe(false);
  // Ears under the head, the star over it. The ears ride a sway layer of
  // their own around their drawing (2026-11-16: a turn and a shift on the
  // compositor rather than a group's transform on the main thread).
  const layers: (Element | null)[] = [...(art?.children ?? [])];
  expect(layers.indexOf(ears?.closest('.support-pet__ears-sway') ?? null)).toBe(
    0,
  );
  expect(layers.indexOf(body)).toBe(1);
  expect(layers.indexOf(star)).toBe(2);
});

// Two copies on one page (the titlebar's and the dialog's hero, a hidden one
// among them) used to need ids of their own each, or one hidden copy's
// gradient or clip blanked another. Drawn flat in one colour (2026-11-17)
// with the pupils as windows of the page (2026-11-16), the drawing carries
// no ids and points at none, so there is nothing for copies to share.
it('draws every copy with no ids to share, so one hidden copy cannot blank another', () => {
  const { container } = render(
    <>
      <PetArt />
      <PetArt />
    </>,
  );
  const arts = container.querySelectorAll('.support-pet__art');
  // The control: both drawings are there, whole.
  expect(arts).toHaveLength(2);
  arts.forEach((art) => {
    expect(art.querySelector('.support-pet__body')).not.toBeNull();
    expect(art.querySelectorAll('.support-pet__pupil')).toHaveLength(2);
  });
  expect(container.querySelectorAll('[id]')).toHaveLength(0);
  const references = [...container.querySelectorAll('*')].filter((shape) =>
    ['clip-path', 'fill', 'stroke', 'mask', 'filter'].some((name) =>
      /url\(#/.test(shape.getAttribute(name) ?? ''),
    ),
  );
  expect(references).toHaveLength(0);
});
