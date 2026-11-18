/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's window colours by its time of day (Ivan, 2026-11-18: "allow
 * users to pick two colours too, and the app preselects colours
 * automatically; if users don't pick them, the app does the same while
 * playing"): a set for its night and one for its day, each from the most
 * deliberate source there is, blended at the scene's hour in OKLCH, and
 * checked for a bad window at every tenth of the way between them.
 */

import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  blendWindowColours,
  dayColoursAt,
  dayKeyOf,
  isWornAsNamed,
  resolveDayColours,
  timeKeyOf,
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

describe('the blend through the day', () => {
  it('is exactly the night at 0 and exactly the day at 100', () => {
    expect(blendWindowColours(NIGHT, DAY, 0)).toBe(NIGHT);
    expect(blendWindowColours(NIGHT, DAY, 100)).toBe(DAY);
    // Past either end it holds there.
    expect(blendWindowColours(NIGHT, DAY, -20)).toBe(NIGHT);
    expect(blendWindowColours(NIGHT, DAY, 140)).toBe(DAY);
  });

  it('turns a hue the short way round, through blue from green to violet, never through grey', () => {
    const green = { surface: '#0a2a12', accent: '#40e070', glow: '#54ff8a' };
    const violet = { surface: '#1a0a3a', accent: '#a060ff', glow: '#54ff8a' };
    const dusk = blendWindowColours(green, violet, 50);
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
      const { h } = lch(blendWindowColours(amber, violet, daylight).accent);
      // On the short arc, through the reds, never round through green.
      expect(hueApart(h, from) + hueApart(h, to)).toBeLessThan(
        hueApart(from, to) + 3,
      );
    });
  });

  it('lends a grey end the other end’s hue, so it only gains or loses colour', () => {
    const grey = { surface: '#202020', accent: '#808080', glow: '#909090' };
    const dusk = blendWindowColours(grey, DAY, 50);
    expect(hueApart(lch(dusk.accent).h, lch(DAY.accent).h)).toBeLessThan(3);
  });

  it('wears one set all day when the scene has only one', () => {
    const named = { colours: NIGHT, source: 'named' as const };
    expect(dayColoursAt({ night: named }, 70)).toBe(NIGHT);
    expect(dayColoursAt({ day: named }, 10)).toBe(NIGHT);
    expect(dayColoursAt({}, 50)).toBeUndefined();
  });
});

describe('where each time’s colours come from', () => {
  const PALETTE = { surface: '#101020', accent: '#a0a0ff', glow: '#50ffa0' };
  const PICTURE = { surface: '#202010', accent: '#ffd060', glow: '#60ff60' };
  const MINE = { surface: '#301010', accent: '#ff6060', glow: '#60ffd0' };

  it('takes the choice, else the pack’s, else the palette’s, else the picture’s', () => {
    const resolved = resolveDayColours({
      named: { night: NIGHT },
      palette: PALETTE,
      measured: { night: PICTURE, day: PICTURE },
      chosen: { day: MINE },
    });
    expect(resolved.sides.night).toEqual({ colours: NIGHT, source: 'named' });
    expect(resolved.sides.day).toEqual({ colours: MINE, source: 'chosen' });
    // What the scene has without the choice: the palette's, all day.
    expect(resolved.own.day).toEqual({ colours: PALETTE, source: 'palette' });
    // Nothing for a drawing to give: the pack and the palette answered.
    expect(resolved.measured).toEqual([]);
  });

  it('asks a drawing only for the times nothing else names', () => {
    const resolved = resolveDayColours({
      named: { night: NIGHT },
      measured: { day: PICTURE },
      chosen: {},
    });
    expect(resolved.measured).toEqual(['day']);
    expect(resolved.sides.day).toEqual({
      colours: PICTURE,
      source: 'measured',
    });
  });

  it('wears the blend as named once either set is somebody’s, and lends only its hue otherwise', () => {
    expect(
      isWornAsNamed({
        night: { colours: PICTURE, source: 'measured' },
        day: { colours: MINE, source: 'chosen' },
      }),
    ).toBe(true);
    expect(isWornAsNamed({ night: { colours: NIGHT, source: 'named' } })).toBe(
      true,
    );
    // The control: colours the app worked out on its own.
    expect(
      isWornAsNamed({
        night: { colours: PALETTE, source: 'palette' },
        day: { colours: PICTURE, source: 'measured' },
      }),
    ).toBe(false);
  });

  it('keeps the night under the scene’s own key and the day beside it', () => {
    expect(timeKeyOf('premium:aurora', 'night')).toBe('premium:aurora');
    expect(timeKeyOf('premium:aurora', 'day')).toBe(dayKeyOf('premium:aurora'));
    expect(dayKeyOf('premium:aurora')).not.toBe('premium:aurora');
  });
});

describe('the window colours check through the day', () => {
  it('passes two good sets that keep their accent and glow apart all day', () => {
    expect(windowColourFaults(NIGHT)).toEqual([]);
    expect(windowColourFaults(DAY)).toEqual([]);
    expect(windowColourFaultsThroughDay(NIGHT, DAY)).toBeUndefined();
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
    const fault = windowColourFaultsThroughDay(night, day);
    expect(fault).toBeDefined();
    expect(fault?.daylight).toBeGreaterThan(0);
    expect(fault?.daylight).toBeLessThan(100);
    expect(fault?.faults).toContain('glow-like-accent');
  });
});
