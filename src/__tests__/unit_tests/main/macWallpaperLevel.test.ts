/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import macDesktopLevel from 'main/wallpaper/macLevel';

const mockLevel = jest.fn();
const mockLoad = jest.fn();
jest.mock('koffi', () => ({ load: (...args: unknown[]) => mockLoad(...args) }));

const originalPlatform = process.platform;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  mockLoad.mockReturnValue({ func: () => mockLevel });
  mockLevel.mockImplementation((key: number) =>
    new Map([
      [2, -100],
      [4, 0],
      [18, -80],
    ]).get(key),
  );
});
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

it('puts the picture above the OS wallpaper, below icons and normal apps', () => {
  const level = macDesktopLevel();
  expect(level).toBeGreaterThan(-100);
  expect(level).toBeLessThan(-80);
  expect(level).toBeLessThan(0);
  expect(mockLoad).toHaveBeenCalledWith(
    '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics',
  );
});

it('uses the OS normal level as the origin for Electron’s relative offset', () => {
  mockLevel.mockImplementation((key: number) =>
    new Map([
      [2, -500],
      [4, 10],
      [18, -400],
    ]).get(key),
  );
  expect(macDesktopLevel() + 10).toBe(-499);
});

it.each([
  [-100, -99, 0],
  [0, 20, 0],
  [Number.NaN, -80, 0],
  [-100.5, -80, 0],
  [-2_147_483_648, -80, 20],
])(
  'refuses unsafe wallpaper/icon/app levels %s / %s / %s',
  (desktop, icons, normal) => {
    mockLevel.mockImplementation((key: number) =>
      new Map([
        [2, desktop],
        [4, normal],
        [18, icons],
      ]).get(key),
    );
    expect(macDesktopLevel).toThrow('No safe Mac desktop window level');
  },
);

it('does not query a native library on another platform', () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  mockLevel.mockClear();
  expect(macDesktopLevel).toThrow('only available on macOS');
  expect(mockLevel).not.toHaveBeenCalled();
});
