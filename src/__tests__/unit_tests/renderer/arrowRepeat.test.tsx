/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An arrow held down steps once when pressed and once per turn of its
 * `arrow-repeat` animation after that, for as long as it is held. It was an
 * interval beside the button; the animation's own turn is the step now, so a
 * window that draws nothing steps nothing. jsdom runs no animations, so the
 * turns are fired by hand, and the pace is held in the stylesheet below.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ArrowButton from 'renderer/widgets/ArrowButton';
import { I18nProvider } from 'renderer/utils/I18nContext';
import {
  compileStylesheet,
  keyframes,
  styleRules,
} from '../../utils/stylesheetRules';

/** jsdom's AnimationEvent drops `animationName`, so it is put on by hand. */
const turn = (target: Element, animationName = 'arrow-repeat') => {
  const event = new Event('animationiteration', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  fireEvent(target, event);
};

const renderArrow = (handleChange: () => void) =>
  render(
    <I18nProvider>
      <ArrowButton
        name="Gain"
        type="up"
        isDisabled={false}
        handleChange={handleChange}
      />
    </I18nProvider>,
  );

describe('holding an arrow', () => {
  // Fake, so the count below can see a clock if one is ever set again.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('steps on the press, then once per turn, and stops on release', () => {
    const handleChange = jest.fn();
    renderArrow(handleChange);
    const arrow = screen.getByRole('button');

    fireEvent.mouseDown(arrow);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(arrow).toHaveClass('is-repeating');
    expect(jest.getTimerCount()).toBe(0);

    act(() => turn(arrow));
    act(() => turn(arrow));
    expect(handleChange).toHaveBeenCalledTimes(3);

    // Somebody else's animation turning is not a step.
    act(() => turn(arrow, 'pop-in'));
    expect(handleChange).toHaveBeenCalledTimes(3);

    fireEvent.mouseUp(arrow);
    expect(arrow).not.toHaveClass('is-repeating');
  });

  it('stops when the pointer leaves while held', () => {
    const handleChange = jest.fn();
    renderArrow(handleChange);
    const arrow = screen.getByRole('button');

    fireEvent.mouseDown(arrow);
    act(() => {
      arrow.dispatchEvent(new MouseEvent('mouseleave'));
    });

    expect(arrow).not.toHaveClass('is-repeating');
  });
});

describe('the repeat pace', () => {
  const css = compileStylesheet('ArrowButton.scss');

  it('turns five times a second, forever, while held', () => {
    const rule = styleRules(css).find(
      ({ selectors, within }) =>
        within.length === 0 && selectors.includes('.is-repeating'),
    );
    expect(rule?.declarations.get('animation')).toBe(
      'arrow-repeat 200ms linear infinite',
    );
  });

  it('changes nothing that can be seen', () => {
    const frames = keyframes(css, 'arrow-repeat');
    expect(frames.size).toBeGreaterThan(0);
    frames.forEach((declarations) => {
      expect([...declarations.keys()]).toEqual(['visibility']);
    });
  });

  it('keeps its pace under reduced motion, which would repeat a thousand times a second', () => {
    const exempt = styleRules(css).find(({ selectors }) =>
      selectors.some((each) => each.startsWith(':root[data-motion')),
    );
    expect(exempt?.declarations.get('animation')).toBe(
      'arrow-repeat 200ms linear infinite !important',
    );
  });
});
