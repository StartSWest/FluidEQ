/** @jest-environment node */
import {
  macWindowOptions,
  titlebarDoubleClickAction,
  trafficLightBandOf,
  trafficLightHeight,
  trafficLightPlacement,
} from '../../../main/macWindowChrome';

describe('a Mac window keeps its own traffic lights', () => {
  it('hides the title bar on a Mac and asks for the overlay measure', () => {
    expect(macWindowOptions('darwin', false)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: true,
      fullscreenable: true,
    });
  });

  it('draws the player green button disabled on a Mac', () => {
    expect(macWindowOptions('darwin', true).fullscreenable).toBe(false);
  });

  it('changes nothing about the window anywhere else', () => {
    expect(macWindowOptions('win32', false)).toEqual({});
    expect(macWindowOptions('linux', true)).toEqual({});
  });
});

describe('trafficLightHeight', () => {
  it('is 16 points before macOS 26 and 14 from it', () => {
    expect(trafficLightHeight('24.6.0')).toBe(16);
    expect(trafficLightHeight('20.1.0')).toBe(16);
    expect(trafficLightHeight('25.0.0')).toBe(14);
    expect(trafficLightHeight('26.1.0')).toBe(14);
  });
});

describe('trafficLightBandOf', () => {
  it('reads the page’s left, centre line and strip foot', () => {
    expect(trafficLightBandOf([30, 49, 86])).toEqual({
      left: 30,
      centreY: 49,
      bottom: 86,
    });
  });

  it('refuses anything that is not three lengths inside a window', () => {
    expect(trafficLightBandOf(undefined)).toBeUndefined();
    expect(trafficLightBandOf({ left: 30 })).toBeUndefined();
    expect(trafficLightBandOf([30, 49])).toBeUndefined();
    expect(trafficLightBandOf([30, Number.NaN, 86])).toBeUndefined();
    expect(trafficLightBandOf([-1, 49, 86])).toBeUndefined();
    expect(trafficLightBandOf([30, 49, 1e9])).toBeUndefined();
    expect(trafficLightBandOf(['30', 49, 86])).toBeUndefined();
  });
});

describe('trafficLightPlacement', () => {
  it('centres the buttons on the strip’s middle at zoom 1', () => {
    // The titlebar's card: 12px off the top, 74 tall, content 18px in.
    expect(
      trafficLightPlacement({ left: 30, centreY: 49, bottom: 84 }, 1, 16),
    ).toEqual({ position: { x: 30, y: 41 }, sheetOffset: 84 });
  });

  it('takes the page’s pixels to the system’s points at its zoom', () => {
    expect(
      trafficLightPlacement({ left: 30, centreY: 49, bottom: 84 }, 1.25, 14),
    ).toEqual({ position: { x: 38, y: 54 }, sheetOffset: 105 });
  });

  it('never puts the buttons above the window', () => {
    expect(
      trafficLightPlacement({ left: 8, centreY: 4, bottom: 8 }, 1, 16).position
        .y,
    ).toBe(0);
  });
});

describe('titlebarDoubleClickAction', () => {
  it('zooms when nothing is set, and on Maximize or Fill', () => {
    expect(titlebarDoubleClickAction(undefined)).toBe('zoom');
    expect(titlebarDoubleClickAction('')).toBe('zoom');
    expect(titlebarDoubleClickAction('Maximize')).toBe('zoom');
    expect(titlebarDoubleClickAction('Fill')).toBe('zoom');
  });

  it('minimises on Minimize', () => {
    expect(titlebarDoubleClickAction('Minimize')).toBe('minimize');
  });

  it('does nothing on None or a word AppKit does not know', () => {
    expect(titlebarDoubleClickAction('None')).toBe('none');
    expect(titlebarDoubleClickAction('Shade')).toBe('none');
  });
});
