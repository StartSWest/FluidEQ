/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The header's name: "Fluid" in white and "EQ" in Lagoon, one box of its own
 * (Ivan, 2026-09-26: "add some white to word and EQ in rainbow", "in our
 * rainbow color not rainbow"). Still one word to anybody reading it.
 */

import { render } from '@testing-library/react';
import SignalBrandName from 'renderer/components/SignalBrandName';

describe('the header name', () => {
  it('reads as one word', () => {
    const { container } = render(<SignalBrandName />);
    expect(container.textContent).toBe('FluidEQ');
  });

  it('puts “EQ”, and only “EQ”, in the box drawn in Lagoon', () => {
    const { container } = render(<SignalBrandName />);
    const suffixes = container.querySelectorAll('.signal-name__suffix');
    expect(suffixes).toHaveLength(1);
    expect(suffixes[0].textContent).toBe('EQ');
    // The control: the white part is outside it, letter by letter.
    const outside = [
      ...container.querySelectorAll('.signal-name > .signal-name__letter'),
    ].map((letter) => letter.textContent);
    expect(outside.join('')).toBe('Fluid');
  });
});
