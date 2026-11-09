/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_WALLPAPER_DISPLAYS,
  WALLPAPER_CLOCK_DAYLIGHT,
  isWallpaperAudio,
  isWallpaperDaylightChoice,
  isWallpaperStart,
  isWallpaperState,
  isWallpaperStop,
  isWallpaperTuningMap,
  monitorDaylight,
  wallpaperPauseReason,
  type IWallpaperStart,
  type IWallpaperState,
} from '../../../common/wallpaper';

const MEMBER_LOOK = 'member:faaed582-d6f4-4e70-999b-86e8518a7dc4:chrome';

const start = (over: Record<string, unknown> = {}): unknown => ({
  lookId: 'premium:alpine',
  displayIds: [2, 3],
  pauseOnBattery: true,
  wave: { height: 0.75, position: 0.2 },
  motion: 'calm',
  ...over,
});

describe('what the window may ask main to put on the desktop', () => {
  it('accepts an official or a member visualizer on named monitors', () => {
    expect(isWallpaperStart(start())).toBe(true);
    expect(isWallpaperStart(start({ lookId: MEMBER_LOOK }))).toBe(true);
    expect(isWallpaperStart(start({ motion: 'music' }))).toBe(true);
  });

  it('refuses a look that is not an installed kind of visualizer', () => {
    [
      'skyline-auto',
      'premium:',
      'premium:../x',
      'member:nobody:chrome',
      7,
    ].forEach((lookId) =>
      expect(isWallpaperStart(start({ lookId }))).toBe(false),
    );
  });

  it('refuses no monitor, the same monitor twice, and more monitors than a desk has', () => {
    expect(isWallpaperStart(start({ displayIds: [] }))).toBe(false);
    expect(isWallpaperStart(start({ displayIds: [2, 2] }))).toBe(false);
    expect(isWallpaperStart(start({ displayIds: [2.5] }))).toBe(false);
    const many = Array.from(
      { length: MAX_WALLPAPER_DISPLAYS + 1 },
      (_, id) => id,
    );
    expect(isWallpaperStart(start({ displayIds: many }))).toBe(false);
    expect(isWallpaperStart(start({ displayIds: many.slice(1) }))).toBe(true);
  });

  it('refuses a wave outside the sliders and a motion it does not know', () => {
    expect(
      isWallpaperStart(start({ wave: { height: 1.2, position: 0 } })),
    ).toBe(false);
    expect(
      isWallpaperStart(start({ wave: { height: 0.5, position: -0.1 } })),
    ).toBe(false);
    expect(isWallpaperStart(start({ wave: undefined }))).toBe(false);
    expect(isWallpaperStart(start({ motion: 'loud' }))).toBe(false);
    expect(isWallpaperStart(start({ motion: undefined }))).toBe(false);
    expect(isWallpaperStart(start({ pauseOnBattery: 'yes' }))).toBe(false);
  });

  it('stops every monitor with no ids, or the ones named', () => {
    expect(isWallpaperStop(undefined)).toBe(true);
    expect(isWallpaperStop([1, 3])).toBe(true);
    expect(isWallpaperStop([])).toBe(false);
    expect(isWallpaperStop(['1'])).toBe(false);
  });

  // What each visualizer is set to reaches the monitors through main, and a
  // page draws by these numbers: every one of them is checked on the way in.
  it('takes what the listener set for each visualizer, and no other shape', () => {
    expect(
      isWallpaperTuningMap({
        'premium:alpine': {
          params: { glow: 0.4, snow: 2 },
          response: { attack: 120, release: 900 },
          wave: { height: 0.4, position: 0.2 },
        },
        [MEMBER_LOOK]: {},
      }),
    ).toBe(true);
    expect(isWallpaperTuningMap({})).toBe(true);
    expect(isWallpaperTuningMap(undefined)).toBe(false);
    // Not a look id, and nothing to draw a scene with.
    expect(isWallpaperTuningMap({ alpine: {} })).toBe(false);
    expect(
      isWallpaperTuningMap({ 'premium:alpine': { params: { glow: 'lots' } } }),
    ).toBe(false);
    expect(
      isWallpaperTuningMap({ 'premium:alpine': { params: { glow: NaN } } }),
    ).toBe(false);
    // The two timings the graph's menu offers, and only those.
    expect(
      isWallpaperTuningMap({
        'premium:alpine': { response: { sensitivity: 2 } },
      }),
    ).toBe(false);
    expect(
      isWallpaperTuningMap({
        'premium:alpine': { wave: { height: 2, position: 0 } },
      }),
    ).toBe(false);
  });
});

describe('what the window accepts back from main', () => {
  const request = start() as IWallpaperStart;
  const state: IWallpaperState = {
    supported: true,
    displays: [
      {
        id: 2,
        label: 'Y27qf-30',
        x: 0,
        y: 0,
        width: 2560,
        height: 1440,
        primary: true,
      },
    ],
    screens: [
      {
        displayId: 2,
        lookId: request.lookId,
        wave: request.wave,
        motion: request.motion,
        phase: 'paused',
        pauseReason: 'covered',
      },
    ],
    pauseOnBattery: true,
  };

  it('takes a state of the shape this window was built for', () => {
    expect(isWallpaperState(state)).toBe(true);
  });

  it('takes a monitor whose visualizer was refused, and no error it does not know', () => {
    const [screen] = state.screens;
    const stopped = { ...screen, phase: 'error', pauseReason: undefined };
    expect(
      isWallpaperState({
        ...state,
        screens: [{ ...stopped, error: 'refused' }],
      }),
    ).toBe(true);
    expect(
      isWallpaperState({
        ...state,
        screens: [{ ...stopped, error: 'haunted' }],
      }),
    ).toBe(false);
  });

  // A main process started before a change to this shape keeps running while
  // the window reloads beside it; an unchecked read there took the window down.
  it('ignores a monitor from a main that predates the wave or the motion', () => {
    const [screen] = state.screens;
    const { motion, ...withoutMotion } = screen;
    const { wave, ...withoutWave } = screen;
    expect(motion).toBe('calm');
    expect(wave).toEqual({ height: 0.75, position: 0.2 });
    expect(isWallpaperState({ ...state, screens: [withoutMotion] })).toBe(
      false,
    );
    expect(isWallpaperState({ ...state, screens: [withoutWave] })).toBe(false);
    expect(
      isWallpaperState({
        ...state,
        screens: [{ ...screen, phase: 'dancing' }],
      }),
    ).toBe(false);
  });
});

describe('the music main hands a desktop page', () => {
  const frame = { points: [{ x: 100, y: -12 }], waveform: [0.5, -0.5] };

  // The window's capture is in stereo, and a scene on the desktop hears
  // where the music stands between the speakers as the graph's own do.
  it('carries where the music stands between the speakers, or nothing', () => {
    expect(isWallpaperAudio(frame)).toBe(true);
    expect(isWallpaperAudio({ ...frame, stereo: [-0.4, 0.9] })).toBe(true);
    expect(isWallpaperAudio({ ...frame, stereo: [-1, 0] })).toBe(true);
  });

  it('refuses a stereo image outside the balance and width a scene reads', () => {
    [[1.5, 0.5], [0, -0.1], [0, 1.2], [0.2], [0.1, 0.2, 0.3], ['0', 0.5], {}]
      .map((stereo) => ({ ...frame, stereo }))
      .forEach((raw) => expect(isWallpaperAudio(raw)).toBe(false));
  });
});

describe('why a monitor pauses', () => {
  const quiet: Parameters<typeof wallpaperPauseReason>[0] = {
    locked: false,
    suspended: false,
    battery: false,
    game: false,
    cover: 'none',
    pauseOnBattery: true,
  };

  it('plays when nothing asks it to wait', () => {
    expect(wallpaperPauseReason(quiet)).toBeUndefined();
  });

  it('names the strongest reason when several hold at once', () => {
    const everything: typeof quiet = {
      ...quiet,
      locked: true,
      suspended: true,
      battery: true,
      game: true,
      cover: 'others',
    };
    expect(wallpaperPauseReason(everything)).toBe('locked');
    expect(wallpaperPauseReason({ ...everything, locked: false })).toBe(
      'suspended',
    );
    expect(
      wallpaperPauseReason({ ...everything, locked: false, suspended: false }),
    ).toBe('battery');
    expect(
      wallpaperPauseReason({
        ...everything,
        locked: false,
        suspended: false,
        battery: false,
      }),
    ).toBe('game');
  });

  /**
   * A game takes the whole machine's frames, so every screen holds still —
   * not only the one the game covers, which is what `cover` answers.
   */
  it('holds every screen still while a game is in front', () => {
    expect(wallpaperPauseReason({ ...quiet, game: true })).toBe('game');
    expect(
      wallpaperPauseReason({ ...quiet, game: true, cover: 'others' }),
    ).toBe('game');
    expect(wallpaperPauseReason({ ...quiet, cover: 'others' })).toBe('covered');
  });

  it('pauses on battery only when that was chosen', () => {
    expect(wallpaperPauseReason({ ...quiet, battery: true })).toBe('battery');
    expect(
      wallpaperPauseReason({ ...quiet, battery: true, pauseOnBattery: false }),
    ).toBeUndefined();
    expect(
      wallpaperPauseReason({
        ...quiet,
        battery: true,
        pauseOnBattery: false,
        cover: 'others',
      }),
    ).toBe('covered');
  });
});

/**
 * What a monitor's page is told: the graph's while it follows the graph, its
 * own choice otherwise, and nothing where it made none (its scene's own hour).
 */
describe('a monitor’s time of day', () => {
  const told = { graph: 80, brightness: 40 };

  it('is the graph’s while it follows, whatever its own choice says', () => {
    expect(
      monitorDaylight(
        { followsGraph: true, daylight: { source: 'own', daylight: 10 } },
        told,
      ),
    ).toBe(80);
    expect(
      monitorDaylight({ followsGraph: true }, { ...told, graph: undefined }),
    ).toBeUndefined();
  });

  it('is its own choice while it does not follow', () => {
    expect(
      monitorDaylight({ daylight: { source: 'own', daylight: 10 } }, told),
    ).toBe(10);
    expect(
      monitorDaylight(
        { daylight: { source: 'brightness', daylight: 10 } },
        told,
      ),
    ).toBe(40);
    expect(
      monitorDaylight({ daylight: { source: 'clock', daylight: 10 } }, told),
    ).toBe(WALLPAPER_CLOCK_DAYLIGHT);
  });

  it('waits on its own Daylight for a Brightness not yet told', () => {
    expect(
      monitorDaylight(
        { daylight: { source: 'brightness', daylight: 15 } },
        { graph: 80, brightness: undefined },
      ),
    ).toBe(15);
  });

  it('is nothing for a monitor with no choice of its own', () => {
    expect(monitorDaylight({}, told)).toBeUndefined();
  });

  it('reads only the three choices, each with a time of day in range', () => {
    expect(isWallpaperDaylightChoice({ source: 'own', daylight: 0 })).toBe(
      true,
    );
    expect(isWallpaperDaylightChoice({ source: 'clock', daylight: 100 })).toBe(
      true,
    );
    [
      { source: 'moon', daylight: 10 },
      { source: 'own', daylight: 101 },
      { source: 'own', daylight: 'noon' },
      { source: 'brightness' },
      'own',
      null,
    ].forEach((raw) => expect(isWallpaperDaylightChoice(raw)).toBe(false));
  });
});
