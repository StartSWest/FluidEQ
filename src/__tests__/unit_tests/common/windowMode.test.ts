/** @jest-environment node */
import {
  PLAYER_DEFAULT_HEIGHT,
  PLAYER_DEFAULT_WIDTH,
  PLAYER_FOLD_HEIGHT,
  PLAYER_MIN_WIDTH,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from 'common/constants';
import {
  appMinimumSize,
  centreIn,
  clampInto,
  isUsableRect,
  placeAtTopRight,
  playerFirstSize,
  playerMinimumSize,
} from 'common/windowMode';

const AREA = { x: 0, y: 0, width: 2560, height: 1392 };
// A second screen to the left of the first, as Windows lays them out.
const LEFT_AREA = { x: -1707, y: 0, width: 1707, height: 1019 };

describe('a window held inside a screen', () => {
  it('is moved back in, and only shrunk when it is bigger than the screen', () => {
    expect(
      clampInto({ x: -40, y: -20, width: 480, height: 640 }, AREA),
    ).toEqual({ x: 0, y: 0, width: 480, height: 640 });
    expect(
      clampInto({ x: 2400, y: 1300, width: 480, height: 640 }, AREA),
    ).toEqual({ x: 2080, y: 752, width: 480, height: 640 });
    expect(
      clampInto({ x: 100, y: 100, width: 3000, height: 2000 }, AREA),
    ).toEqual({ x: 0, y: 0, width: 2560, height: 1392 });
  });

  it('keeps a window that is already inside exactly where it is', () => {
    const rect = { x: 300, y: 200, width: 480, height: 640 };
    expect(clampInto(rect, AREA)).toEqual(rect);
    expect(clampInto({ ...rect, x: -1200 }, LEFT_AREA)).toEqual({
      ...rect,
      x: -1200,
    });
  });
});

describe('where the player opens the first time', () => {
  it('is the middle of the screen the app is on', () => {
    expect(centreIn({ width: 480, height: 1080 }, AREA)).toEqual({
      x: 1040,
      y: 156,
      width: 480,
      height: 1080,
    });
    expect(centreIn({ width: 480, height: 1080 }, LEFT_AREA)).toEqual({
      // Taller than that screen's work area: as tall as it allows, at its top.
      x: -1707 + Math.round((1707 - 480) / 2),
      y: 0,
      width: 480,
      height: 1019,
    });
  });

  it('is the player’s own size, scaled by the page’s zoom', () => {
    expect(playerFirstSize(1)).toEqual({
      width: PLAYER_DEFAULT_WIDTH,
      height: PLAYER_DEFAULT_HEIGHT,
    });
    expect(playerFirstSize(1.25)).toEqual({ width: 600, height: 1350 });
  });
});

describe('the corner the full app goes back to', () => {
  it('shares the top-right corner of the window it came from', () => {
    const anchor = { x: 1500, y: 120, width: 480, height: 640 };
    expect(placeAtTopRight(anchor, { width: 1280, height: 900 }, AREA)).toEqual(
      { x: 700, y: 120, width: 1280, height: 900 },
    );
  });

  it('is pulled onto the screen when that corner would put it off', () => {
    const anchor = { x: 40, y: 1300, width: 480, height: 640 };
    expect(placeAtTopRight(anchor, { width: 1280, height: 900 }, AREA)).toEqual(
      { x: 0, y: 492, width: 1280, height: 900 },
    );
  });
});

describe('the floors', () => {
  it('give the app 1024×800, or the whole of a smaller screen', () => {
    expect(appMinimumSize(AREA)).toEqual({
      width: WINDOW_MIN_WIDTH,
      height: WINDOW_MIN_HEIGHT,
    });
    expect(appMinimumSize({ width: 910, height: 480 })).toEqual({
      width: 910,
      height: 480,
    });
  });

  it('give the player its own width and one folded line, at the page’s zoom', () => {
    expect(playerMinimumSize(1)).toEqual({
      width: PLAYER_MIN_WIDTH,
      height: PLAYER_FOLD_HEIGHT,
    });
    expect(playerMinimumSize(0.9)).toEqual({
      width: Math.ceil(PLAYER_MIN_WIDTH * 0.9),
      height: Math.ceil(PLAYER_FOLD_HEIGHT * 0.9),
    });
  });
});

describe('a remembered rectangle worth reusing', () => {
  it('has a finite position and a real size', () => {
    expect(isUsableRect({ x: 0, y: 0, width: 480, height: 640 })).toBe(true);
    expect(isUsableRect({ x: -2000, y: 0, width: 480, height: 640 })).toBe(
      true,
    );
    expect(isUsableRect(undefined)).toBe(false);
    expect(isUsableRect({ x: 0, y: 0 })).toBe(false);
    expect(isUsableRect({ x: 0, y: 0, width: 0, height: 640 })).toBe(false);
    expect(isUsableRect({ x: NaN, y: 0, width: 480, height: 640 })).toBe(false);
  });
});
