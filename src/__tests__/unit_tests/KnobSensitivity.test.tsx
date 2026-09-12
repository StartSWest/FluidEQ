import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import Knob from 'renderer/widgets/Knob';

const mount = (value = 1000, sensitivity = 1) => {
  const handleChange = jest.fn();
  const result = render(
    <Knob
      name="Frequency"
      value={value}
      min={20}
      max={20000}
      step={1}
      sensitivity={sensitivity}
      unit="Hz"
      isDisabled={false}
      handleChange={handleChange}
    />,
  );
  const knob = result.container.querySelector('.knob');
  if (!knob) {
    throw new Error('Knob missing');
  }
  return { ...result, knob, handleChange };
};

it('makes frequency wheel movement finer without changing other knob defaults', () => {
  const ordinary = mount();
  fireEvent.wheel(ordinary.knob, { deltaY: -1 });
  expect(ordinary.handleChange).toHaveBeenCalledWith(1040);
  ordinary.unmount();
  const gentle = mount(1000, 0.2);
  fireEvent.wheel(gentle.knob, { deltaY: -1 });
  expect(gentle.handleChange).toHaveBeenCalledWith(1008);
});

it('still moves at least one Hz at bass frequencies and with Shift', () => {
  const { knob, handleChange } = mount(25, 0.2);
  fireEvent.wheel(knob, { deltaY: -1, shiftKey: true });
  expect(handleChange).toHaveBeenLastCalledWith(26);
  fireEvent.wheel(knob, { deltaY: 1, shiftKey: true });
  expect(handleChange).toHaveBeenLastCalledWith(24);
});

it('reduces drag distance in the same proportion as the wheel', () => {
  const drag = (knob: Element) => {
    fireEvent(
      knob,
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientY: 200 }),
    );
    fireEvent(
      knob,
      new MouseEvent('pointermove', { bubbles: true, clientY: 180 }),
    );
  };
  const ordinary = mount();
  drag(ordinary.knob);
  const original = ordinary.handleChange.mock.calls[0][0];
  expect(original).toBeGreaterThan(1400);
  ordinary.unmount();
  const gentle = mount(1000, 0.2);
  drag(gentle.knob);
  expect(gentle.handleChange.mock.calls[0][0]).toBeGreaterThan(1000);
  expect(gentle.handleChange.mock.calls[0][0]).toBeLessThan(1200);
});
