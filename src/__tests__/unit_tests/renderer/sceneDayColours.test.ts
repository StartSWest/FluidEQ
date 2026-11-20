/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's window colours (`sceneDayColours.ts`).
 *
 * ONE SET PER SCENE, THE DAY'S (58d70ea7e; Ivan, 2026-11-19: "pick one
 * colour for the scene, and then during the day just light up"; "when it
 * darks, it simply darks"): the listener's choice, else the pack's, else the
 * palette's, else the picture's by day, kept at the day's point
 * (`SCENE_COLOURS_STOP`); a pack or a choice written with points reads as
 * its day's set, else its first point's.
 *
 * The blend between points stays, for what still names more than one - the
 * Studio agent's check of a pack's points (`windowColourFaultsThroughDay`)
 * and the window's reading of the one set it resolves - in OKLCH, the short
 * way round the wheel, checked for a bad window at every tenth of the way.
 *
 * The cases for five points each resolved apart, and for a night measured
 * beside the day, went with the points: a scene resolves one set now.
 */

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  coloursAtHour,
  isWornAsNamed,
  migrateStopKey,
  resolveStopColours,
  SCENE_COLOURS_STOP,
  stopColoursAt,
  stopKeyOf,
} from 'renderer/utils/sceneDayColours';
import {
  windowColourFaults,
  windowColourFaultsThroughDay,
} from 'renderer/utils/windowColourCheck';

const lch = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { l, a, b } = rgbToLab(parsed.rgb);
  return {
    l,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
};

const hueApart = (left: number, right: number) => {
  const apart = Math.abs(left - right) % 360;
  return apart > 180 ? 360 - apart : apart;
};

/** Aurora's own night: a deep teal floor, a pink accent, a green glow. */
const NIGHT: ISceneWindowColours = {
  surface: '#0e2a26',
  accent: '#f3a6e5',
  glow: '#54ff8a',
};
/** A day of the same scene: a blue floor, a sky-blue accent, the same glow. */
const DAY: ISceneWindowColours = {
  surface: '#14304a',
  accent: '#6cc8ff',
  glow: '#54ff8a',
};

/** The blend of `from` at night and `to` by day, at `daylight`. */
const between = (
  from: ISceneWindowColours,
  to: ISceneWindowColours,
  daylight: number,
) => coloursAtHour({ '0': from, '100': to }, daylight);

describe('the blend between two points', () => {
  it('is exactly the night at 0 and exactly the day at 100', () => {
    expect(between(NIGHT, DAY, 0)).toBe(NIGHT);
    expect(between(NIGHT, DAY, 100)).toBe(DAY);
    // Past either end it holds there.
    expect(between(NIGHT, DAY, -20)).toBe(NIGHT);
    expect(between(NIGHT, DAY, 140)).toBe(DAY);
    // CONTROL: in between it is neither.
    expect(between(NIGHT, DAY, 50)).not.toEqual(NIGHT);
    expect(between(NIGHT, DAY, 50)).not.toEqual(DAY);
  });

  it('turns a hue the short way round, through blue from green to violet, never through grey', () => {
    const green = { surface: '#0a2a12', accent: '#40e070', glow: '#54ff8a' };
    const violet = { surface: '#1a0a3a', accent: '#a060ff', glow: '#54ff8a' };
    const dusk = between(green, violet, 50);
    if (!dusk) {
      throw new Error('no blend between two named points');
    }
    const from = lch(green.accent);
    const to = lch(violet.accent);
    const middle = lch(dusk.accent);
    // Between the two hues, on the short arc.
    expect(hueApart(middle.h, from.h)).toBeLessThan(hueApart(from.h, to.h));
    expect(hueApart(middle.h, to.h)).toBeLessThan(hueApart(from.h, to.h));
    // CONTROL: the same two mixed straight in OKLab pass close to grey.
    const labOf = (hex: string) => {
      const parsed = parseCssColour(hex);
      return parsed ? rgbToLab(parsed.rgb) : { l: 0, a: 0, b: 0 };
    };
    const mixed = Math.hypot(
      (labOf(green.accent).a + labOf(violet.accent).a) / 2,
      (labOf(green.accent).b + labOf(violet.accent).b) / 2,
    );
    expect(middle.c).toBeGreaterThan(mixed * 2);
  });

  it('takes the short way across red too, from an amber to a violet', () => {
    const amber = { surface: '#2a1a0a', accent: '#ff9a2f', glow: '#54ff8a' };
    const violet = { surface: '#1a0a3a', accent: '#a060ff', glow: '#54ff8a' };
    const from = lch(amber.accent).h;
    const to = lch(violet.accent).h;
    [25, 50, 75].forEach((daylight) => {
      const blend = between(amber, violet, daylight);
      if (!blend) {
        throw new Error('no blend between two named points');
      }
      const { h } = lch(blend.accent);
      // On the short arc, through the reds, never round through green.
      expect(hueApart(h, from) + hueApart(h, to)).toBeLessThan(
        hueApart(from, to) + 3,
      );
    });
  });

  it('lends a grey end the other end’s hue, so it only gains or loses colour', () => {
    const grey = { surface: '#202020', accent: '#808080', glow: '#909090' };
    const dusk = between(grey, DAY, 50);
    if (!dusk) {
      throw new Error('no blend between two named points');
    }
    expect(hueApart(lch(dusk.accent).h, lch(DAY.accent).h)).toBeLessThan(3);
  });

  it('wears one set all day when only one point holds it', () => {
    const named = { colours: NIGHT, source: 'named' as const };
    expect(stopColoursAt({ '0': named }, 70)).toBe(NIGHT);
    expect(stopColoursAt({ [SCENE_COLOURS_STOP]: named }, 10)).toBe(NIGHT);
    expect(stopColoursAt({}, 50)).toBeUndefined();
  });
});

describe('the one set a scene resolves', () => {
  const PALETTE = { surface: '#101020', accent: '#a0a0ff', glow: '#50ffa0' };
  const PICTURE = { surface: '#202010', accent: '#ffd060', glow: '#60ff60' };
  const MINE = { surface: '#301010', accent: '#ff6060', glow: '#60ffd0' };

  it('takes the choice over the pack’s, and keeps the pack’s as the scene’s own', () => {
    const resolved = resolveStopColours({
      named: { [SCENE_COLOURS_STOP]: DAY },
      palette: PALETTE,
      measured: { '100': PICTURE },
      chosen: { [SCENE_COLOURS_STOP]: MINE },
    });
    expect(resolved.sides).toEqual({
      [SCENE_COLOURS_STOP]: { colours: MINE, source: 'chosen' },
    });
    expect(resolved.own).toEqual({
      [SCENE_COLOURS_STOP]: { colours: DAY, source: 'named' },
    });
    // Nothing for a drawing to give: the pack answered.
    expect(resolved.measured).toEqual([]);
  });

  it('reads a pack written with points as its day’s set, else its first point’s', () => {
    const withDay = resolveStopColours({
      named: { '0': NIGHT, '50': PICTURE, '100': DAY },
      measured: {},
      chosen: {},
    });
    expect(withDay.own[SCENE_COLOURS_STOP]?.colours).toBe(DAY);
    const withoutDay = resolveStopColours({
      named: { '25': NIGHT, '75': PICTURE },
      measured: {},
      chosen: {},
    });
    expect(withoutDay.own[SCENE_COLOURS_STOP]?.colours).toBe(NIGHT);
    // One set, at one point: none of the others is resolved apart.
    expect(Object.keys(withDay.sides)).toEqual([SCENE_COLOURS_STOP]);
  });

  it('reads a choice made at another point as the scene’s one set', () => {
    const resolved = resolveStopColours({
      named: { [SCENE_COLOURS_STOP]: DAY },
      measured: {},
      chosen: { '0': MINE },
    });
    expect(resolved.sides[SCENE_COLOURS_STOP]).toEqual({
      colours: MINE,
      source: 'chosen',
    });
  });

  it('falls back to the palette, brought to the day’s point, before any picture', () => {
    const within = jest.fn(
      (colours: ISceneWindowColours): ISceneWindowColours => ({
        ...colours,
        surface: '#000000',
      }),
    );
    const resolved = resolveStopColours({
      named: {},
      palette: PALETTE,
      measured: { '100': PICTURE },
      chosen: {},
      within,
    });
    expect(resolved.sides[SCENE_COLOURS_STOP]).toEqual({
      colours: { ...PALETTE, surface: '#000000' },
      source: 'palette',
    });
    expect(within).toHaveBeenCalledWith(PALETTE, SCENE_COLOURS_STOP);
    expect(resolved.measured).toEqual([]);
  });

  it('asks a drawing by day alone, and only when nothing else names the colours', () => {
    const resolved = resolveStopColours({
      named: {},
      measured: { '0': NIGHT, '100': PICTURE },
      chosen: {},
    });
    expect(resolved.measured).toEqual(['100']);
    // The picture by day; the night's is never what a scene wears.
    expect(resolved.sides[SCENE_COLOURS_STOP]).toEqual({
      colours: PICTURE,
      source: 'measured',
    });
    // Not drawn yet: asked for, and nothing to wear meanwhile.
    const unmeasured = resolveStopColours({
      named: {},
      measured: {},
      chosen: {},
    });
    expect(unmeasured.measured).toEqual(['100']);
    expect(unmeasured.sides).toEqual({});
  });

  it('wears the set as named once it is somebody’s, and lends only its hue otherwise', () => {
    expect(
      isWornAsNamed({
        [SCENE_COLOURS_STOP]: { colours: MINE, source: 'chosen' },
      }),
    ).toBe(true);
    expect(
      isWornAsNamed({
        [SCENE_COLOURS_STOP]: { colours: NIGHT, source: 'named' },
      }),
    ).toBe(true);
    // The control: colours the app worked out on its own.
    expect(
      isWornAsNamed({
        [SCENE_COLOURS_STOP]: { colours: PICTURE, source: 'measured' },
      }),
    ).toBe(false);
    expect(
      isWornAsNamed({
        [SCENE_COLOURS_STOP]: { colours: PALETTE, source: 'palette' },
      }),
    ).toBe(false);
  });

  it('keeps the first point under the scene’s own key and the others beside it, a two-point day reading as the day’s point', () => {
    expect(stopKeyOf('premium:aurora', '0')).toBe('premium:aurora');
    expect(stopKeyOf('premium:aurora', SCENE_COLOURS_STOP)).toBe(
      'premium:aurora@100',
    );
    expect(migrateStopKey('premium:aurora@day')).toBe('premium:aurora@100');
    // CONTROL: a key of today's is left as it is.
    expect(migrateStopKey('premium:aurora@100')).toBe('premium:aurora@100');
    expect(migrateStopKey('premium:aurora')).toBe('premium:aurora');
  });
});

describe('the window colours check through the day', () => {
  it('passes two good sets that keep their accent and glow apart all day', () => {
    expect(windowColourFaults(NIGHT)).toEqual([]);
    expect(windowColourFaults(DAY)).toEqual([]);
    expect(
      windowColourFaultsThroughDay({ '0': NIGHT, '100': DAY }),
    ).toBeUndefined();
  });

  // As Aurora's first day set did: the accent and the glow trading hues from
  // night to day, and meeting at dusk (here cyan and violet, which meet in
  // blue, clear of the warning hues).
  it('finds the hour two good sets turn into one colour between them', () => {
    const night = { surface: '#0e2a26', accent: '#40d0ff', glow: '#c070ff' };
    const day = { surface: '#0e2240', accent: '#c070ff', glow: '#40d0ff' };
    // The control: each end on its own is a good window.
    expect(windowColourFaults(night)).toEqual([]);
    expect(windowColourFaults(day)).toEqual([]);
    const fault = windowColourFaultsThroughDay({ '0': night, '100': day });
    expect(fault).toBeDefined();
    expect(fault?.daylight).toBeGreaterThan(0);
    expect(fault?.daylight).toBeLessThan(100);
    expect(fault?.faults).toContain('glow-like-accent');
  });
});
