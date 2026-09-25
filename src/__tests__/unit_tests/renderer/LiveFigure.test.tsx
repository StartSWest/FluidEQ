/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A figure that changes while it is looked at stands in a box of its own
 * (`LiveFigure.tsx`), so the browser lays it out alone. What a test can hold
 * is the shape that makes that true — the text in its own element inside the
 * item, and every widest text on a line of its own, hidden from a reader —
 * and that the refs reach the elements the frame writes to.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import LiveFigure from '../../../renderer/components/LiveFigure';

it('puts the text in its own element inside the item that carries the class', () => {
  const textRef = createRef<HTMLSpanElement>();
  const figureRef = createRef<HTMLSpanElement>();
  const { container } = render(
    <LiveFigure
      className="side-bar__reading is-idle"
      widest={['-00.0 dB', '–']}
      textRef={textRef}
      figureRef={figureRef}
    >
      –
    </LiveFigure>,
  );
  const figure = container.firstElementChild;

  expect(figure).toBe(figureRef.current);
  expect(figure).toHaveClass('live-figure', 'side-bar__reading', 'is-idle');
  expect(textRef.current).toHaveClass('live-figure__text');
  expect(textRef.current?.parentElement).toBe(figure);
  expect(textRef.current?.childNodes).toHaveLength(1);
  expect(textRef.current).toHaveTextContent('–');
});

it('holds every widest text on a line of its own, hidden from a reader', () => {
  const { container } = render(
    <LiveFigure className="studio-meter__value" widest={['Sol♯0', 'Do0']}>
      –
    </LiveFigure>,
  );
  const room = container.querySelector('.live-figure__room');

  expect(room).toHaveAttribute('aria-hidden', 'true');
  expect([...(room?.children ?? [])].map((line) => line.textContent)).toEqual([
    'Sol♯0',
    'Do0',
  ]);
});

it('says nothing until it is written, when it is given nothing to say', () => {
  const textRef = createRef<HTMLSpanElement>();
  render(
    <LiveFigure
      className="studio-cost__reading"
      widest={['00.0 ms']}
      textRef={textRef}
    />,
  );

  expect(textRef.current).toBeEmptyDOMElement();
});
