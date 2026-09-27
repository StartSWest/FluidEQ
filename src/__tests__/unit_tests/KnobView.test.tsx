/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every dial as drawn (`KnobView`): the reading under the knob, which is also
 * where an exact value is typed (Ivan, 2026-09-26: "make a single number and
 * when click it turns into a input"), and the marks round the knob — its
 * ends and where it rests, or each setting of a stepped one.
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import Knob from 'renderer/widgets/Knob';
import SteppedKnob from 'renderer/widgets/SteppedKnob';

const mount = ({
  min = -20,
  max = 20,
  step = 0.1,
  value = 3,
  unit = 'dB',
  isDisabled = false,
} = {}) => {
  const handleChange = jest.fn((_value: number) => Promise.resolve());
  const view = render(
    <Knob
      name="Gain"
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      isDisabled={isDisabled}
      defaultValue={0}
      handleChange={handleChange}
    />,
  );
  const reading = () => view.container.querySelector('.knob-readout__value');
  const field = () =>
    view.container.querySelector<HTMLInputElement>('.knob-readout__field');
  const asked = () => handleChange.mock.calls.map(([asked]) => asked);
  /** Press the reading, put `text` in the box it turns into, and `key`. */
  const type = (text: string, key: 'Enter' | 'Escape') => {
    const button = reading();
    if (!button) {
      throw new Error('no reading');
    }
    fireEvent.click(button);
    const box = field();
    if (!box) {
      throw new Error('the reading did not open a box');
    }
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key });
  };
  return { ...view, reading, field, asked, type };
};

describe('the reading under a knob', () => {
  it('says the value and its unit', () => {
    const { reading } = mount({ value: 3 });
    expect(reading()).toHaveTextContent('3.0');
    expect(reading()?.querySelector('.knob-readout__unit')).toHaveTextContent(
      'dB',
    );
  });

  it('opens a box holding the reading itself when pressed', () => {
    const { reading, field } = mount({ value: 3 });
    const button = reading();
    if (!button) {
      throw new Error('no reading');
    }
    fireEvent.click(button);
    expect(field()).toHaveValue('3.0');
    expect(field()).toHaveFocus();
  });

  it('sets what is typed on Enter, held to the range', () => {
    const typed = mount();
    typed.type('7.5', 'Enter');
    expect(typed.asked()).toEqual([7.5]);
    expect(typed.field()).toBeNull();

    const over = mount();
    over.type('99', 'Enter');
    expect(over.asked()).toEqual([20]);
  });

  it('reads a comma as the decimal point and a k as thousands', () => {
    const comma = mount();
    comma.type('12,5', 'Enter');
    expect(comma.asked()).toEqual([12.5]);

    const frequency = mount({ min: 20, max: 20000, step: 1, value: 1000 });
    frequency.type('2.5k', 'Enter');
    expect(frequency.asked()).toEqual([2500]);
  });

  it('puts the reading back on Escape, setting nothing', () => {
    const escaped = mount({ value: 3 });
    escaped.type('9', 'Escape');
    expect(escaped.asked()).toEqual([]);
    expect(escaped.field()).toBeNull();
    expect(escaped.reading()).toHaveTextContent('3.0');
  });

  it('sets nothing for a box left as it opened', () => {
    const { reading, field, asked } = mount({ value: 3 });
    const button = reading();
    if (!button) {
      throw new Error('no reading');
    }
    fireEvent.click(button);
    const box = field();
    if (!box) {
      throw new Error('no box');
    }
    fireEvent.blur(box);
    expect(asked()).toEqual([]);
  });

  it('does not open while the knob is not in the hand’s control', () => {
    const { reading, field } = mount({ isDisabled: true });
    expect(reading()).toBeDisabled();
    const button = reading();
    if (button) {
      fireEvent.click(button);
    }
    expect(field()).toBeNull();
  });
});

describe('the marks round a knob', () => {
  const beads = (container: HTMLElement) =>
    container.querySelectorAll('.knob__bead').length;

  it('are its two ends and where it rests, on a boost or cut', () => {
    expect(beads(mount({ min: -20, max: 20 }).container)).toBe(3);
  });

  // The control: a knob that rests at an end has only its two ends.
  it('are its two ends alone where it rests at one of them', () => {
    expect(
      beads(mount({ min: 0, max: 10, value: 2, unit: '' }).container),
    ).toBe(2);
  });

  it('are each setting of a stepped knob', () => {
    const { container } = render(
      <SteppedKnob
        name="Low cut"
        stops={[0, 12, 24, 36, 48]}
        value={12}
        unit="dB/oct"
        isDisabled={false}
        defaultValue={0}
        handleChange={() => Promise.resolve()}
      />,
    );
    expect(beads(container)).toBe(5);
  });
});
