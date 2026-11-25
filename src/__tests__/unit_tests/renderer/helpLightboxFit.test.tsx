/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { HELP_CHAPTERS, isLiveFigure } from 'common/helpGuide';
import type { IHelpLiveMeasure } from 'renderer/help/live/HelpLiveSurface';
import HelpLiveEnlarged from 'renderer/help/live/HelpLiveEnlarged';
import {
  lightboxRoom,
  lightboxZoom,
  type ILightboxFrame,
} from 'renderer/help/live/lightboxRoom';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * The enlarged figure pulsed between two sizes at some window sizes (Ivan,
 * 2026-11-25: "zooming in and out by 1 px makes it glitch"): its fit read a
 * width a scrollbar took from and a height its own zoom changed. These hold
 * the fit to the lightbox's frame and to one size of the figure.
 */

const surfaceProps: {
  zoom: number;
  onMeasure?: (measure: IHelpLiveMeasure) => void;
}[] = [];

jest.mock('renderer/help/live/HelpLiveSurface', () => ({
  __esModule: true,
  default: (props: {
    zoom: number;
    onMeasure?: (measure: IHelpLiveMeasure) => void;
  }) => {
    surfaceProps.push(props);
    return null;
  },
}));

/** The lightbox at 930 x 700, as the help harness measured it. */
const AT_930_BY_700: ILightboxFrame = {
  areaWidth: 892,
  areaBordersX: 0,
  maxHeight: 658,
  sheetBordersY: 2,
  titleHeight: 50,
  seam: 1,
  paddingX: 40,
  paddingY: 40,
};

const room = lightboxRoom(AT_930_BY_700);

describe('the room the lightbox gives a live figure', () => {
  it('is what the frame leaves inside the padding', () => {
    expect(room).toEqual({ width: 852, height: 565 });
  });

  // The old fit took 82% of the window's height, 574px here: nine pixels more
  // than the lightbox had, so the Room overflowed and brought a scrollbar.
  it('fits every live figure without running past the lightbox', () => {
    const figures = HELP_CHAPTERS.flatMap((chapter) =>
      chapter.figures.flatMap((figure) =>
        isLiveFigure(figure) ? [figure] : [],
      ),
    );
    expect(figures.length).toBeGreaterThan(0);
    const overflowing = figures.filter((figure) => {
      const zoom = lightboxZoom(room, figure.width, figure.height);
      return (
        figure.height * zoom > room.height + 0.01 ||
        figure.width * zoom > room.width + 0.01
      );
    });
    expect(overflowing).toEqual([]);
    // Control: the 82% height of the old fit does overflow the tallest one.
    const tallest = figures.reduce((one, other) =>
      other.height / other.width > one.height / one.width ? other : one,
    );
    const oldZoom = lightboxZoom(
      { width: room.width, height: 700 * 0.82 },
      tallest.width,
      tallest.height,
    );
    expect(tallest.height * oldZoom).toBeGreaterThan(room.height);
  });

  it('keeps its width whether or not a scrollbar stands in the area', () => {
    // The area's border-box width: a scrollbar takes from the content box
    // inside it, never from this.
    expect(lightboxRoom({ ...AT_930_BY_700 }).width).toBe(room.width);
  });
});

describe('the enlarged live figure', () => {
  const figure = HELP_CHAPTERS.flatMap((chapter) =>
    chapter.figures.flatMap((one) => (isLiveFigure(one) ? [one] : [])),
  ).find((one) => one.live === 'dsp-room');

  // jsdom lays nothing out: the area is given a width that leaves the Room
  // limited by its height, the case that chased itself, and the title one.
  beforeEach(() => {
    surfaceProps.length = 0;
    jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(1600);
    jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(50);
  });

  afterEach(() => jest.restoreAllMocks());

  it('takes its zoom from one size of the figure, not from what its own zoom lays out', () => {
    if (!figure) {
      throw new Error('the Room figure is gone');
    }
    const view = render(
      <I18nProvider>
        <div className="help-lightbox" style={{ maxHeight: '658px' }}>
          <h2 className="help-lightbox__title">Room</h2>
          <div className="help-lightbox__image">
            <HelpLiveEnlarged figure={figure} title="Room" />
          </div>
        </div>
      </I18nProvider>,
    );
    const last = () => surfaceProps[surfaceProps.length - 1];
    expect(last()).toBeDefined();
    const first = { width: 1280, height: 851.8, boxes: [] };
    act(() => last().onMeasure?.(first));
    const { zoom } = last();
    expect(zoom).toBeCloseTo(608 / 851.8, 6);
    // The same drawing laid out again at that zoom wraps a line differently
    // and measures four pixels taller; the zoom must not follow it.
    act(() => last().onMeasure?.({ ...first, height: 855.8 }));
    expect(last().zoom).toBe(zoom);
    act(() => last().onMeasure?.(first));
    expect(last().zoom).toBe(zoom);
    view.unmount();
  });
});
