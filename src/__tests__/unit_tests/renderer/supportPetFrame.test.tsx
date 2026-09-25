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
  // Ears under the head, the star over it.
  const layers: (Element | null)[] = [...(art?.children ?? [])];
  expect(layers.indexOf(ears?.closest('svg') ?? null)).toBe(0);
  expect(layers.indexOf(body)).toBe(1);
  expect(layers.indexOf(star)).toBe(2);
});

it('gives every drawing its own ids, so one hidden copy cannot blank another', () => {
  const { container } = render(
    <>
      <PetArt />
      <PetArt />
    </>,
  );
  const ids = [...container.querySelectorAll('[id]')].map(
    (element) => element.id,
  );

  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  // Every reference finds its own drawing's element.
  const unresolved: string[] = [];
  let references = 0;
  container.querySelectorAll('.support-pet__art').forEach((art) => {
    art.querySelectorAll('*').forEach((shape) => {
      ['clip-path', 'fill', 'stroke'].forEach((name) => {
        const id = /url\(#([^)]+)\)/.exec(shape.getAttribute(name) ?? '')?.[1];
        if (id !== undefined) {
          references += 1;
          if (!art.querySelector(`[id="${id}"]`)) {
            unresolved.push(id);
          }
        }
      });
    });
  });
  expect(unresolved).toEqual([]);
  // Ears twice, the body, two pupils' clips, in each of the two.
  expect(references).toBe(10);
});
