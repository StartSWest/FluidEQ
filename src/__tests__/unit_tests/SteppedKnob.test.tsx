/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The cut dials: five settings, turned a detent at a time.
 *
 * Reported the morning they shipped (Ivan, 2026-09-23): "I have to move the
 * mouse to much" and "I move and the thing go back and forward". As a sweep
 * stepping by twelve the dial asked for every whole number on the way, which
 * the app refuses, and fell back. These are the cases that would have caught
 * it: nothing but a setting is ever asked for, a setting is a short drag, and
 * a hand resting on the line between two does not flicker.
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import Knob from 'renderer/widgets/Knob';
import SteppedKnob from 'renderer/widgets/SteppedKnob';

const STOPS = [0, 12, 24, 36, 48];

const mount = (value = 0) => {
  const handleChange = jest.fn((_value: number) => Promise.resolve());
  const result = render(
    <SteppedKnob
      name="Low cut"
      stops={STOPS}
      value={value}
      unit="dB/oct"
      isDisabled={false}
      defaultValue={0}
      handleChange={handleChange}
    />,
  );
  const knob = result.container.querySelector('.knob');
  if (!knob) {
    throw new Error('Knob missing');
  }
  const asked = () => handleChange.mock.calls.map(([value]) => value);
  return { ...result, knob, handleChange, asked };
};

const pointer = (
  knob: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number,
  extra: MouseEventInit = {},
) =>
  fireEvent(
    knob,
    new MouseEvent(type, { bubbles: true, button: 0, clientY, ...extra }),
  );

/** Up and back down a pixel at a time, the way a hand drags. */
const dragAround = (knob: Element) => {
  pointer(knob, 'pointerdown', 300);
  for (let y = 299; y >= 150; y -= 1) {
    pointer(knob, 'pointermove', y);
  }
  for (let y = 150; y <= 320; y += 1) {
    pointer(knob, 'pointermove', y);
  }
  pointer(knob, 'pointerup', 320);
};

describe('a dial of settings', () => {
  it('asks for nothing but its settings, however it is dragged', () => {
    const { knob, asked } = mount();

    dragAround(knob);

    expect(asked().length).toBeGreaterThan(0);
    asked().forEach((value) => expect(STOPS).toContain(value));
  });

  /**
   * The control for the check above: the sweep dial it replaced, stepping by
   * twelve over the same range, does ask for values between the settings —
   * so the check can see the fault it guards against.
   */
  it('(the sweep it replaced asked for values between them)', () => {
    const handleChange = jest.fn((_value: number) => Promise.resolve());
    const { container } = render(
      <Knob
        name="Low cut"
        value={0}
        min={0}
        max={48}
        step={12}
        unit="dB/oct"
        isDisabled={false}
        handleChange={handleChange}
      />,
    );
    const knob = container.querySelector('.knob');
    if (!knob) {
      throw new Error('Knob missing');
    }

    dragAround(knob);

    const between = handleChange.mock.calls
      .map(([value]) => value)
      .filter((value) => !STOPS.includes(value));
    expect(between.length).toBeGreaterThan(0);
  });

  it('turns a setting in a short drag, and end to end in about a hundred pixels', () => {
    const one = mount();
    pointer(one.knob, 'pointerdown', 300);
    pointer(one.knob, 'pointermove', 280);
    expect(one.asked()).toEqual([12]);
    one.unmount();

    const all = mount();
    pointer(all.knob, 'pointerdown', 300);
    pointer(all.knob, 'pointermove', 200);
    expect(all.asked()).toEqual([48]);
  });

  it('holds still for a hand resting on the line between two settings', () => {
    const { knob, asked } = mount(24);
    pointer(knob, 'pointerdown', 300);
    // Half a detent up is the line between 24 and 36: a pixel either side of
    // it, over and over.
    for (let move = 0; move < 20; move += 1) {
      pointer(knob, 'pointermove', 288 + (move % 2 ? 1 : -1));
    }
    expect(asked()).toEqual([]);

    pointer(knob, 'pointermove', 283);
    expect(asked()).toEqual([36]);
    for (let move = 0; move < 20; move += 1) {
      pointer(knob, 'pointermove', 283 + (move % 2 ? 1 : -1));
    }
    expect(asked()).toEqual([36]);
  });

  it('turns one setting per wheel notch, and a trackpad by its travel', () => {
    const notch = mount(24);
    fireEvent.wheel(notch.knob, { deltaY: -100 });
    expect(notch.asked()).toEqual([36]);
    notch.unmount();

    // A trackpad's stream of small deltas adds up to a setting, rather than
    // each one being a setting and a single stroke spinning the dial through.
    const pad = mount(24);
    for (let delta = 0; delta < 4; delta += 1) {
      fireEvent.wheel(pad.knob, { deltaY: -10 });
    }
    expect(pad.asked()).toEqual([]);
    fireEvent.wheel(pad.knob, { deltaY: -10 });
    expect(pad.asked()).toEqual([36]);
  });

  it('moves one setting per arrow key, through a range input of its places', () => {
    const { container, asked } = mount(12);
    const input = container.querySelector('input');
    if (!input) {
      throw new Error('Input missing');
    }
    expect(input).toHaveAttribute('max', '4');
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveAttribute('aria-valuetext', '12 dB/oct');

    fireEvent.change(input, { target: { value: '2' } });
    expect(asked()).toEqual([24]);
  });

  it('goes home on Ctrl+click, and the click drags nothing away from it', () => {
    const { knob, asked } = mount(36);
    pointer(knob, 'pointerdown', 300, { ctrlKey: true });
    pointer(knob, 'pointermove', 250);
    expect(asked()).toEqual([0]);
  });

  it('reads a value between two settings as the nearer one', () => {
    const { container } = mount(20);
    expect(container.querySelector('.knob__number')).toHaveTextContent('24');
  });
});
