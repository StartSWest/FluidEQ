import type { Display, Point, Rectangle } from 'electron';
import type { IWallpaperDisplay } from '../../common/wallpaper';

/**
 * A monitor's length in physical pixels, from Chromium's DIP length and scale.
 *
 * Chromium rounds on the way to DIPs, so the way back is ambiguous: 2560 and
 * 2561 both come out as 1707 at 150%, and multiplying back gave "2561 × 1601"
 * for a 2560 × 1600 monitor. Monitor modes are even, which settles it.
 */
export const physicalLength = (dip: number, scale: number): number =>
  2 * Math.round((dip * scale) / 2);

/**
 * Monitors as Windows' display settings name and arrange them.
 *
 * `toScreenRect` is `screen.dipToScreenRect`, which Electron has on Windows
 * only. `nativeOrigin` looked like the physical origin and is not: a 150%
 * monitor left of a 100% one reported -1707, so the two overlapped by half.
 */
export const toWallpaperDisplays = (
  displays: readonly Display[],
  primaryId: number,
  toScreenRect: (rect: Rectangle) => Rectangle,
): IWallpaperDisplay[] =>
  displays.map((display) => {
    const origin: Point = toScreenRect(display.bounds);
    return {
      id: display.id,
      label: display.label,
      x: origin.x,
      y: origin.y,
      width: physicalLength(display.size.width, display.scaleFactor),
      height: physicalLength(display.size.height, display.scaleFactor),
      primary: display.id === primaryId,
    };
  });
