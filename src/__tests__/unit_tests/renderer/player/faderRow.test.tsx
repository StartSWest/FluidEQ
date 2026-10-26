/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The faders' row cut into ten equal steps in the screen's own pixels
 * (`useFaderRow`), in the player's window and in What's New's picture of the
 * player, which is the same row laid out inside a CSS `zoom`.
 */

import { render } from '@testing-library/react';
import { type CSSProperties, useRef } from 'react';
import useFaderRow from 'renderer/player/useFaderRow';

/** A row the given width on screen, at the given zoom and screen scale. */
const Row = ({
  screenWidth,
  zoom,
  count,
  onFit,
}: {
  screenWidth: number;
  zoom: number;
  count: number;
  onFit: () => void;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  useFaderRow(rowRef, count, onFit);
  return (
    <div
      style={
        {
          '--player-band-gap': '4px',
          '--player-fader-cap': '13px',
        } as CSSProperties
      }
    >
      <div
        ref={(node) => {
          rowRef.current = node;
          if (node) {
            node.getBoundingClientRect = () =>
              ({ width: screenWidth, left: 0 }) as DOMRect;
            Object.defineProperty(node, 'currentCSSZoom', {
              configurable: true,
              value: zoom,
            });
          }
        }}
        data-testid="row"
      />
    </div>
  );
};

const laidOut = (screenWidth: number, zoom: number, count = 10) => {
  const onFit = jest.fn();
  const { getByTestId, unmount } = render(
    <Row screenWidth={screenWidth} zoom={zoom} count={count} onFit={onFit} />,
  );
  const row = getByTestId('row');
  const px = (name: string) => parseFloat(row.style.getPropertyValue(name));
  const result = {
    gap: px('--player-band-gap'),
    band: px('--player-band-width'),
    cap: px('--player-fader-cap'),
    page: px('--player-page-width'),
    padding: parseFloat(row.style.paddingLeft),
    fits: onFit.mock.calls.length,
  };
  unmount();
  return result;
};

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 1,
  });
});

describe('the faders’ row', () => {
  it('cuts the row into ten equal steps, ten bands standing in its middle', () => {
    // 400 px: steps of 40, the 4 px gap off each, the 4 px left over split.
    expect(laidOut(400, 1)).toEqual({
      gap: 4,
      band: 36,
      cap: 13,
      page: 400,
      padding: 2,
      fits: 1,
    });
  });

  // What's New draws the player at its own size inside a zoom, so the same
  // row measures 0.4375 times as wide on the screen: shared out from the
  // screen's width alone it came out at 0.4375 times the steps, ten bands
  // bunched into the left half of the row.
  it('shares a zoomed row out in its own pixels, as the player’s window does', () => {
    const zoomed = laidOut(400 * 0.4375, 0.4375);
    const unzoomed = laidOut(400, 1);
    expect(zoomed.page).toBeCloseTo(unzoomed.page, 0);
    // Within one of the screen's pixels at that zoom, in the row's own.
    expect(Math.abs(zoomed.band - unzoomed.band)).toBeLessThan(1 / 0.4375);
    expect(Math.abs(zoomed.gap - unzoomed.gap)).toBeLessThan(1 / 0.4375);
  });
});
