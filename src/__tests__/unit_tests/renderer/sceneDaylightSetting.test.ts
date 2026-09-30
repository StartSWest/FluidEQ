/**
 * Where a Plus visualizer's time of day comes from — Brightness, the clock, or
 * the listener's own Daylight — kept for the full app and the amp apart
 * (Ivan, 2026-09-29), and what the page hands its scenes from it.
 */

import type * as Setting from 'renderer/utils/sceneDaylightSetting';
import type * as Daylight from 'renderer/graph/sceneDaylight';
import type * as Theme from 'renderer/utils/theme';

interface ILaunch {
  setting: typeof Setting;
  daylight: typeof Daylight;
  theme: typeof Theme;
}

// Read once, when the modules load: each launch starts from its own storage.
const launch = (stored: Record<string, string> = {}): ILaunch => {
  window.localStorage.clear();
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let loaded: ILaunch | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require, @typescript-eslint/no-require-imports -- a fresh copy of each per launch */
    loaded = {
      setting: require('renderer/utils/sceneDaylightSetting') as typeof Setting,
      daylight: require('renderer/graph/sceneDaylight') as typeof Daylight,
      theme: require('renderer/utils/theme') as typeof Theme,
    };
    /* eslint-enable global-require, @typescript-eslint/no-require-imports */
  });
  if (!loaded) {
    throw new Error('the modules did not load');
  }
  return loaded;
};

describe('a scene’s time of day', () => {
  it('follows Brightness in a new install', () => {
    const { setting, daylight, theme } = launch();
    expect(setting.getSceneDaylightSetting().source).toBe('brightness');
    // The page's Brightness, whatever a new install starts it at, and moved.
    expect(daylight.pageDaylight()).toBeCloseTo(
      daylight.daylightOfShade(theme.getThemeShade()),
      5,
    );
    theme.setThemeShade(25);
    expect(daylight.pageDaylight()).toBeCloseTo(
      daylight.daylightOfShade(25),
      5,
    );
  });

  it('stays where it is when set on its own, and then keeps the Daylight set', () => {
    const { setting, daylight } = launch();
    setting.setDaylightSource('own', 37);
    expect(daylight.pageDaylight()).toBe(37);
    setting.setSceneDaylight(80);
    expect(daylight.pageDaylight()).toBe(80);
  });

  it('follows the clock when told to, and turning either follow on turns the other off', () => {
    const { setting, daylight } = launch();
    const clock = jest.requireActual<typeof import('common/sceneDaylight')>(
      'common/sceneDaylight',
    );
    setting.setDaylightSource('clock', 0);
    expect(setting.getSceneDaylightSetting().source).toBe('clock');
    expect(daylight.pageDaylight()).toBeCloseTo(
      clock.clockDaylight(new Date()),
      0,
    );
    setting.setDaylightSource('brightness', 0);
    expect(setting.getSceneDaylightSetting().source).toBe('brightness');
  });

  it('is kept for the app and the amp apart', () => {
    const { setting } = launch();
    setting.setDaylightSource('own', 20);
    setting.applySceneDaylightScope('player');
    // The amp starts on the app's choice from launch, not on a later one.
    expect(setting.getSceneDaylightSetting().source).toBe('brightness');
    setting.setDaylightSource('clock', 0);
    setting.applySceneDaylightScope('app');
    expect(setting.getSceneDaylightSetting()).toEqual({
      source: 'own',
      daylight: 20,
    });
    const next = launch({
      'fluideq.sceneDaylight': window.localStorage.getItem(
        'fluideq.sceneDaylight',
      ) as string,
      'fluideq.sceneDaylight.player': window.localStorage.getItem(
        'fluideq.sceneDaylight.player',
      ) as string,
    });
    expect(next.setting.getSceneDaylightSetting().source).toBe('own');
    next.setting.applySceneDaylightScope('player');
    expect(next.setting.getSceneDaylightSetting().source).toBe('clock');
  });

  // The first build of the choice stored `followsBrightness`; a choice made
  // then is read as the same choice.
  it('reads a choice stored by the first build of it', () => {
    expect(
      launch({
        'fluideq.sceneDaylight': JSON.stringify({
          followsBrightness: false,
          daylight: 64,
        }),
      }).setting.getSceneDaylightSetting(),
    ).toEqual({ source: 'own', daylight: 64 });
    expect(
      launch({
        'fluideq.sceneDaylight': JSON.stringify({
          followsBrightness: true,
          daylight: 64,
        }),
      }).setting.getSceneDaylightSetting().source,
    ).toBe('brightness');
    // Anything else is no choice at all: it follows Brightness.
    expect(
      launch({
        'fluideq.sceneDaylight': 'not json',
      }).setting.getSceneDaylightSetting().source,
    ).toBe('brightness');
  });
});
