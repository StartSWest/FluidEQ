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
 */

import { render } from '@testing-library/react';
import { PetArt } from '../../../renderer/SupportPet';

it('stands the drawing in a frame of its own, never straight in a grid', () => {
  const { container } = render(<PetArt />);
  const drawing = container.querySelector('svg.support-pet__art');

  expect(container.firstElementChild).toHaveProperty(
    'className',
    'support-pet__frame',
  );
  expect(drawing?.parentElement).toBe(container.firstElementChild);
});
