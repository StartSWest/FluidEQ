/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  anchorOf,
  anchorPosition,
  clampedCaptionCentre,
  containedPicture,
  DEFAULT_SUBTITLE_STYLE,
  parseSubtitleStyle,
  positionFromPoint,
  SUBTITLE_ANCHORS,
} from 'common/library/subtitleStyle';

/**
 * The captions' style as it is kept and read back, and where the caption
 * box stands on the picture: a named place, or one dragged by hand, held
 * inside the picture by the box's own size.
 */

describe('a kept caption style', () => {
  it('reads back what was kept', () => {
    const kept = {
      enabled: false,
      size: 'xl',
      colour: 'yellow',
      background: 'box',
      opacity: 0.5,
      position: { x: 0.25, y: 0.1 },
    };
    expect(parseSubtitleStyle(JSON.stringify(kept))).toEqual(kept);
  });

  it('is the default with nothing kept, or with text that is not a style', () => {
    expect(parseSubtitleStyle(null)).toEqual(DEFAULT_SUBTITLE_STYLE);
    expect(parseSubtitleStyle('not json')).toEqual(DEFAULT_SUBTITLE_STYLE);
    expect(parseSubtitleStyle('[1,2]')).toEqual(DEFAULT_SUBTITLE_STYLE);
    // The default is the bottom centre, white on an outline, shown.
    expect(DEFAULT_SUBTITLE_STYLE).toMatchObject({
      enabled: true,
      colour: 'white',
      background: 'outline',
      position: { x: 0.5, y: 1 },
    });
  });

  it('falls back field by field, never losing the rest to one bad value', () => {
    expect(
      parseSubtitleStyle(
        JSON.stringify({
          enabled: 'yes',
          size: 'huge',
          colour: 'pink',
          background: 'glow',
          opacity: 0.33,
          position: { x: 4, y: 'low' },
        }),
      ),
    ).toEqual({
      ...DEFAULT_SUBTITLE_STYLE,
      // The good one is kept; the place is held inside the picture.
      colour: 'pink',
      position: { x: 1, y: DEFAULT_SUBTITLE_STYLE.position.y },
    });
  });
});

describe('the nine named places', () => {
  it('are the corners, edges and middle, in reading order', () => {
    expect(SUBTITLE_ANCHORS.map(anchorPosition)).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0.5 },
      { x: 0, y: 1 },
      { x: 0.5, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it('name a position that is exactly one, and none that was dragged', () => {
    expect(anchorOf({ x: 0.5, y: 1 })).toBe('bottomCentre');
    expect(anchorOf({ x: 0, y: 0 })).toBe('topLeft');
    expect(anchorOf({ x: 0.42, y: 0.8 })).toBe(undefined);
  });
});

describe('the caption box on the picture', () => {
  const room = { width: 1000, height: 500 };
  const box = { width: 400, height: 60 };

  it('stands where asked, inside the picture', () => {
    expect(clampedCaptionCentre({ x: 0.5, y: 0.5 }, room, box, 20)).toEqual({
      left: 500,
      top: 250,
    });
  });

  it('is held off every edge by its own size and the margin', () => {
    // Bottom centre: its foot 20px above the picture's.
    expect(clampedCaptionCentre({ x: 0.5, y: 1 }, room, box, 20)).toEqual({
      left: 500,
      top: 450,
    });
    // Top left: flush left and top, whatever the line's length.
    expect(clampedCaptionCentre({ x: 0, y: 0 }, room, box, 20)).toEqual({
      left: 220,
      top: 50,
    });
    expect(clampedCaptionCentre({ x: 1, y: 0 }, room, box, 20).left).toBe(780);
  });

  it('is centred when it is wider than the picture', () => {
    expect(
      clampedCaptionCentre(
        { x: 0, y: 0.5 },
        room,
        { width: 990, height: 60 },
        20,
      ).left,
    ).toBe(500);
  });

  it('keeps a drag as the fractions of where it was let go, held inside', () => {
    expect(positionFromPoint({ left: 300, top: 100 }, room, box, 20)).toEqual({
      x: 0.3,
      y: 0.2,
    });
    // Dragged past the corner: kept where the box still fits.
    expect(positionFromPoint({ left: -50, top: 900 }, room, box, 20)).toEqual({
      x: 0.22,
      y: 0.9,
    });
    // The control: nothing to measure against keeps the default place.
    expect(
      positionFromPoint(
        { left: 10, top: 10 },
        { width: 0, height: 0 },
        box,
        20,
      ),
    ).toEqual(DEFAULT_SUBTITLE_STYLE.position);
  });
});

describe('the picture inside its letterbox', () => {
  it('is the whole width of a wide film, centred down or hung from the top', () => {
    const box = { width: 1000, height: 1000 };
    const film = { width: 1920, height: 1080 };
    expect(containedPicture(box, film, false)).toEqual({
      left: 0,
      top: 218.75,
      width: 1000,
      height: 562.5,
    });
    expect(containedPicture(box, film, true).top).toBe(0);
  });

  it('is the whole height of a tall one, centred across', () => {
    expect(
      containedPicture(
        { width: 1000, height: 500 },
        { width: 1080, height: 1920 },
        false,
      ),
    ).toEqual({ left: 359.375, top: 0, width: 281.25, height: 500 });
  });

  it('is the whole box while the film’s size is unknown', () => {
    expect(
      containedPicture(
        { width: 640, height: 360 },
        { width: 0, height: 0 },
        true,
      ),
    ).toEqual({ left: 0, top: 0, width: 640, height: 360 });
  });
});
