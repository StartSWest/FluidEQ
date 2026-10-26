/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The row under the EQ page's bands swapping between the Tone knobs and a
 * band's editor without a cut (Ivan, 2026-10-26: "make the animation where
 * user select a band and show the band knobs and it click out and shows the
 * tone knobs"), and each swap played once ("the tine ban has glich repeapt
 * same animatin").
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import EqRowSwap from 'renderer/eq/EqRowSwap';

/** An animation's end, named, as the element's own or bubbled from a child. */
const animationEnd = (element: Element, animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  act(() => {
    element.dispatchEvent(event);
  });
};

const Row = ({ rowKey, text }: { rowKey: string; text?: string }) => (
  <div data-testid="host">
    <EqRowSwap rowKey={rowKey}>
      <div className="eq-flat-editor">
        <span className="control">{text ?? rowKey}</span>
      </div>
    </EqRowSwap>
  </div>
);

const rowsIn = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('.eq-flat-editor'),
];

const leaveEnds = (row: HTMLElement) => animationEnd(row, 'eq-row-leave');

describe('the row under the bands', () => {
  it('opens as it is, with nothing arriving', () => {
    const { container } = render(<Row rowKey="tone" />);
    const rows = rowsIn(container);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveClass('is-arriving');
  });

  it('keeps the old row, inert and hidden from readers, until its own animation ends', () => {
    const { container, rerender } = render(<Row rowKey="tone" />);
    rerender(<Row rowKey="band:a" />);
    const [leaving, arriving] = rowsIn(container);
    expect(leaving).toHaveClass('is-leaving');
    expect(leaving).toHaveAttribute('inert');
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(arriving).toHaveClass('is-arriving');
    expect(arriving).not.toHaveAttribute('inert');

    // An end bubbling up from a control inside it is not the row's own, and
    // neither is another of the row's animations.
    leaveEnds(leaving.querySelector('.control') as HTMLElement);
    animationEnd(leaving, 'eq-row-arrive');
    expect(rowsIn(container)).toHaveLength(2);

    leaveEnds(leaving);
    expect(rowsIn(container)).toEqual([arriving]);
  });

  it('cuts straight to the new row with Animations off, as before', () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    try {
      const { container, rerender } = render(<Row rowKey="tone" />);
      rerender(<Row rowKey="band:a" />);
      const rows = rowsIn(container);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent('band:a');
      expect(rows[0]).not.toHaveClass('is-arriving');
    } finally {
      document.documentElement.removeAttribute('data-motion');
    }
  });

  it('lets the row that was showing leave as itself, never built again', () => {
    const { container, rerender } = render(<Row rowKey="tone" />);
    const [tone] = rowsIn(container);
    rerender(<Row rowKey="band:a" />);
    expect(rowsIn(container)[0]).toBe(tone);
  });

  it('swaps nothing while the key stays, as a band being dragged', () => {
    const { container, rerender } = render(
      <Row rowKey="band:a" text="100 Hz" />,
    );
    rerender(<Row rowKey="band:a" text="120 Hz" />);
    const rows = rowsIn(container);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('120 Hz');
    expect(rows[0]).not.toHaveClass('is-leaving');
  });

  it('never stands more than two rows, however fast the swaps come', () => {
    const { container, rerender } = render(<Row rowKey="tone" />);
    rerender(<Row rowKey="band:a" />);
    rerender(<Row rowKey="band:b" />);
    rerender(<Row rowKey="tone" />);
    const rows = rowsIn(container);
    expect(rows).toHaveLength(2);
    expect(
      rows.filter((row) => row.classList.contains('is-leaving')),
    ).toHaveLength(1);
  });

  it('keeps a row replaced while it was arriving arriving as it leaves', () => {
    const { container, rerender } = render(<Row rowKey="tone" />);
    rerender(<Row rowKey="band:a" />);
    rerender(<Row rowKey="band:b" />);
    const leaving = rowsIn(container).find((row) =>
      row.classList.contains('is-leaving'),
    );
    expect(leaving).toHaveClass('is-arriving');
  });

  it('takes a row back as itself, in its place, when it returns while leaving', () => {
    const { container, rerender } = render(<Row rowKey="band:a" />);
    const [band] = rowsIn(container);
    rerender(<Row rowKey="tone" />);
    rerender(<Row rowKey="band:a" />);
    const rows = rowsIn(container);
    expect(rows[0]).toBe(band);
    expect(band).not.toHaveClass('is-leaving');
    expect(band).not.toHaveAttribute('inert');
    expect(rows[1]).toHaveClass('is-leaving');
  });
});
