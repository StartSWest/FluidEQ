/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import LabelledKnob from '../../renderer/components/LabelledKnob';

const setup = (
  {
    defaultValue,
    isDisabled,
  }: { defaultValue?: number; isDisabled?: boolean } = {
    defaultValue: 3,
  },
) => {
  const onChange = jest.fn();
  const onCommit = jest.fn();
  render(
    <LabelledKnob
      label="Drive"
      value={7}
      min={1}
      max={10}
      step={0.1}
      unit=""
      defaultValue={defaultValue}
      isDisabled={isDisabled}
      onChange={onChange}
      onCommit={onCommit}
    />,
  );
  return { onChange, onCommit };
};

/** The knob's own pointer target — the box that captures the drag. */
const dial = () => {
  const found = document.querySelector('.knob');
  if (!found) {
    throw new Error('no knob rendered');
  }
  return found;
};

/**
 * A pointerdown carrying real modifier keys.
 *
 * `fireEvent.pointerDown` cannot: jsdom does not implement `PointerEvent` at
 * all, so it falls back to a bare `Event` on which `ctrlKey` is simply absent —
 * measured, not assumed. A `MouseEvent` named `pointerdown` reaches React's
 * `onPointerDown` and does carry the modifiers, which is the whole point here.
 */
const pointerDown = (
  target: Element,
  init: { ctrlKey?: boolean; metaKey?: boolean } = {},
) =>
  fireEvent(
    target,
    new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientY: 100,
      ...init,
    }),
  );

describe('LabelledKnob', () => {
  it('shows the parameter name under the dial', () => {
    setup();
    expect(screen.getByText('Drive')).toBeInTheDocument();
  });

  it('names the control for assistive tech', () => {
    setup();
    expect(screen.getByRole('slider', { name: 'Drive' })).toBeInTheDocument();
  });

  /**
   * The gesture every DAW uses, and the reason `defaultValue` exists.
   */
  it('returns the dial to its default on control-click', () => {
    const { onChange } = setup();
    pointerDown(dial(), { ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('accepts the Mac modifier for the same gesture', () => {
    const { onChange } = setup();
    pointerDown(dial(), { metaKey: true });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  /**
   * NULL TEST, with the two controls above it.
   *
   * Without them a `handleChange` fired on every pointer-down would satisfy
   * the reset tests while doing nothing that resembles a reset.
   */
  it('does not change anything on a plain click', () => {
    const { onChange } = setup();
    pointerDown(dial());
    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * A knob with no meaningful home must not invent one.
   *
   * Falling back to `min` would be a trapdoor: on anything measured in
   * decibels that is silence, reached by a gesture the user expected to be
   * harmless.
   */
  it('POSITIVE CONTROL: does nothing on control-click without a default', () => {
    const { onChange } = setup({});
    pointerDown(dial(), { ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports the gesture ending so a caller can save', () => {
    const { onCommit } = setup();
    fireEvent.pointerUp(dial());
    expect(onCommit).toHaveBeenCalled();
  });

  it('is inert while disabled', () => {
    const { onChange } = setup({ defaultValue: 3, isDisabled: true });
    pointerDown(dial(), { ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * Where the filled arc grows FROM, which nothing else in the suite can see.
 *
 * A range that straddles zero symmetrically is a bipolar control: zero is a
 * rest position and either direction from it is a decision. Grown from the low
 * end such a dial sits half filled while doing nothing, which reads as a level
 * — and a dial whose rest position looks like a level is one nobody thinks to
 * turn left. Bass Punch's Attack and Sustain and the EQ's band gain are the
 * dials this covers.
 */
describe('LabelledKnob, on a range that straddles zero', () => {
  const arc = (
    { min, max, value }: { min: number; max: number; value: number } = {
      min: -1,
      max: 1,
      value: 0,
    },
  ) => {
    const view = render(
      <LabelledKnob
        label="Attack"
        value={value}
        min={min}
        max={max}
        step={0.01}
        unit=""
        defaultValue={0}
        onChange={jest.fn()}
      />,
    );
    const found = view.container.querySelector('.knob__value');
    view.unmount();
    return found;
  };

  it('draws no arc at all at the centre, because nothing is being done', () => {
    expect(arc()).toBeNull();
  });

  /**
   * POSITIVE CONTROL for the test above, and the assertion that matters most:
   * equal distances either side of the centre draw the same LENGTH of arc from
   * different starts. A dial still growing from its low end would draw 25% and
   * 75% of the sweep for these two.
   */
  it('POSITIVE CONTROL: grows the same length either side of the centre', () => {
    const up = arc({ min: -1, max: 1, value: 0.5 });
    const down = arc({ min: -1, max: 1, value: -0.5 });
    expect(up).toHaveAttribute('stroke-dasharray', '18.75 100');
    expect(down).toHaveAttribute('stroke-dasharray', '18.75 100');
    // Half a sweep apart: the positive arc starts at the top of the travel,
    // the negative one a quarter of the range earlier.
    expect(up).toHaveAttribute('stroke-dashoffset', '-37.5');
    expect(down).toHaveAttribute('stroke-dashoffset', '-18.75');
  });

  /**
   * A range that merely happens to include negatives is not bipolar: the
   * Master's -24 to +6 dB trim and the Normalizer's -12 to -0.1 target both
   * have a low end that IS their floor, and must keep filling from it.
   */
  it('still fills from the low end where that end is the floor', () => {
    expect(arc({ min: -24, max: 6, value: -24 })).toHaveAttribute(
      'stroke-dasharray',
      '0 100',
    );
    expect(arc({ min: -24, max: 6, value: 6 })).toHaveAttribute(
      'stroke-dashoffset',
      '0',
    );
  });
});
