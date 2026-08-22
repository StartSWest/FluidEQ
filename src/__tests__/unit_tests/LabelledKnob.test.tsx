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
