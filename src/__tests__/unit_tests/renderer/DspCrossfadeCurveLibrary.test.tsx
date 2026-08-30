/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  crossfadeShapesMatch,
  defaultCrossfadeShape,
  ICrossfadeShape,
} from '../../../common/dsp/crossfadeShape';
import { saveCrossfadeCurve } from '../../../renderer/dsp/crossfadeCurves';
import DspCrossfadeCurveLibrary from '../../../renderer/dsp/DspCrossfadeCurveLibrary';

/** One handle pulled down, which is what a saved shape is. */
const dipped = (gain: number): ICrossfadeShape => {
  const base = defaultCrossfadeShape();
  return {
    outgoing: base.outgoing.map((point, index) =>
      index === 1 ? { at: point.at, gain } : point,
    ),
    incoming: base.incoming,
  };
};

/**
 * Seeded through the module's own writer rather than by hand, so the storage
 * format is only written down in one place.
 */
const seed = (entries: readonly [string, ICrossfadeShape][]): void => {
  window.localStorage.clear();
  entries.forEach(([name, shape]) => saveCrossfadeCurve(name, shape));
};

const renderLibrary = (shape: ICrossfadeShape) => {
  const onApply = jest.fn();
  const view = render(
    <DspCrossfadeCurveLibrary
      shape={shape}
      isDisabled={false}
      onApply={onApply}
    />,
  );
  return { ...view, onApply };
};

describe('DspCrossfadeCurveLibrary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /**
   * The row's whole job. The fade holds one shape, so the pill whose own
   * handles are that shape says so and no other does.
   */
  it('lights the saved shape the fade is using', () => {
    seed([
      ['Flat', defaultCrossfadeShape()],
      ['Dip', dipped(0.2)],
    ]);
    renderLibrary(dipped(0.2));
    expect(screen.getByRole('button', { name: 'Dip' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Flat' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  /**
   * Why the component asks `find` rather than testing each pill: two curves
   * saved under different names with the same handles would otherwise both
   * claim the fade, and a row with two lit pills says the fade is running two
   * shapes at once.
   */
  it('lights one pill even when two saved shapes are identical', () => {
    seed([
      ['One', dipped(0.2)],
      ['Two', dipped(0.2)],
    ]);
    renderLibrary(dipped(0.2));
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  /**
   * Dragging a handle leaves the match, and nothing is lit. That is the
   * truth: what is on the plot is no longer any saved shape.
   */
  it('lights nothing once the shape has been dragged off every saved one', () => {
    seed([
      ['Flat', defaultCrossfadeShape()],
      ['Dip', dipped(0.2)],
    ]);
    renderLibrary(dipped(0.6));
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('hands back the shape a pill was saved with', () => {
    seed([['Dip', dipped(0.2)]]);
    const { onApply } = renderLibrary(defaultCrossfadeShape());
    fireEvent.click(screen.getByRole('button', { name: 'Dip' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(
      crossfadeShapesMatch(
        onApply.mock.calls[0][0] as ICrossfadeShape,
        dipped(0.2),
      ),
    ).toBe(true);
  });

  it('takes a curve out of the row when its remove button is pressed', () => {
    seed([
      ['Flat', defaultCrossfadeShape()],
      ['Dip', dipped(0.2)],
    ]);
    renderLibrary(defaultCrossfadeShape());
    fireEvent.click(screen.getByRole('button', { name: 'Delete curve Dip' }));
    expect(screen.queryByRole('button', { name: 'Dip' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Flat' })).toBeInTheDocument();
  });

  /**
   * A class assertion, deliberately, and the only kind of check that can hold
   * this one: the pills are the EQ page's applied-layer chip and get their
   * whole appearance from `.active-layer` in `ActiveLayers.scss`. Renaming
   * that class strips the border, the pill radius and the round remove button
   * off this row in silence — nothing else in a test can see it happen.
   */
  it('is drawn as the EQ page applied-layer chip', () => {
    seed([['Dip', dipped(0.2)]]);
    const { container } = renderLibrary(dipped(0.2));
    const pill = container.querySelector('.dsp-crossfade-curve');
    expect(pill).not.toBeNull();
    expect(pill).toHaveClass('active-layer');
    expect(pill).toHaveClass('is-applied');
    expect(
      pill?.querySelector('.dsp-crossfade-curve__pip'),
    ).toBeInTheDocument();
  });

  /**
   * Two saves inside one millisecond used to come away with the same id,
   * because it was `Date.now()` and nothing else. The row then drew a single
   * pill for the pair — React collapses children that share a key — and
   * deleting either took both, since the delete filters by id. Seeding two
   * curves back to back is exactly that timing, which is how this was found.
   */
  it('keeps two curves saved in the same millisecond apart', () => {
    seed([
      ['Flat', defaultCrossfadeShape()],
      ['Dip', dipped(0.2)],
    ]);
    renderLibrary(defaultCrossfadeShape());
    expect(screen.getByRole('button', { name: 'Flat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dip' })).toBeInTheDocument();
  });

  it('names the section on the card rather than behind a menu', () => {
    seed([]);
    renderLibrary(defaultCrossfadeShape());
    expect(screen.getByText('Custom shape')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save curve' }),
    ).toBeInTheDocument();
  });
});
