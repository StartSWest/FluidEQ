/* FluidEQ — GPL-3.0-or-later */

/** CGWindowLevelKey values from Apple's public CGWindowLevel.h ABI. */
const DESKTOP = 2;
const NORMAL = 4;
const DESKTOP_ICONS = 18;

type TWindowLevel = (key: number) => number;
let windowLevel: TWindowLevel | undefined;

/**
 * Electron 43.2's desktop type sets kCGDesktopWindowLevel - 1, below the
 * system wallpaper. Keep its Spaces behavior but place our picture one
 * level ABOVE that wallpaper, still below Finder's icons and every app.
 * Query the OS levels rather than freezing their large negative values.
 */
export default function macDesktopLevel(): number {
  if (process.platform !== 'darwin') {
    throw new Error('Mac desktop levels are only available on macOS.');
  }
  if (!windowLevel) {
    // Existing packaged native dependency; never loaded on another platform.
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- platform-only native binding
    const koffi = require('koffi') as typeof import('koffi');
    const graphics = koffi.load(
      '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics',
    );
    windowLevel = graphics.func(
      'int32_t CGWindowLevelForKey(int32_t key)',
    ) as TWindowLevel;
  }
  const desktop = windowLevel(DESKTOP);
  const icons = windowLevel(DESKTOP_ICONS);
  const normal = windowLevel(NORMAL);
  const target = desktop + 1;
  const relative = target - normal;
  if (
    ![desktop, icons, normal, relative].every(Number.isSafeInteger) ||
    target >= icons ||
    target >= normal ||
    relative < -2_147_483_648 ||
    relative > 2_147_483_647
  ) {
    throw new Error('No safe Mac desktop window level is available.');
  }
  return relative;
}
