/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';

/** The land: a low hill whose lowest edge is `HORIZON`, so the sun at night
 * (its top under that edge) stands wholly behind it. */
const HORIZON = 20;
const LAND = `M0 ${HORIZON} Q7 17.5 14 19.5 T28 19 V28 H0 Z`;
const SUN_X = 10;
const SUN_RADIUS = 4.2;
const SUN_LOW = HORIZON + SUN_RADIUS + 1;
const SUN_HIGH = 9;
/** The moon and stars are gone by this much day, before the sun climbs to
 * where it would cross them. */
const NIGHT_ENDS = 0.6;
/** The sun and its glow come up over the first fifth of the day, so full
 * night shows no light behind the hill. */
const SUN_RISES = 0.2;

/**
 * The publish dialog's Time of day, drawn as the hour it names: a square of
 * sky on the Studio's element-setting tile (`studio-ambient-icon`), deep
 * night with a moon and two stars at one end, the sun up in a blue sky at the
 * other, so the slider beside it reads at a glance and moves with it.
 */
export default function StudioPublishDaylightIcon({
  daylight,
}: {
  daylight: number;
}) {
  const day = Math.min(
    1,
    Math.max(
      0,
      (daylight - SCENE_DAYLIGHT_MIN) /
        (SCENE_DAYLIGHT_MAX - SCENE_DAYLIGHT_MIN),
    ),
  );
  return (
    <span
      className="studio-ambient-icon studio-publish__daylight"
      style={{ '--day': day } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 28">
        <g
          className="studio-publish__daylight-night"
          opacity={Math.max(0, 1 - day / NIGHT_ENDS)}
        >
          <path d="M19.4 4.6a4 4 0 1 0 3.9 5.6 3.2 3.2 0 1 1-3.9-5.6z" />
          <circle cx="7" cy="6" r="0.8" />
          <circle cx="11.5" cy="11" r="0.6" />
        </g>
        <circle
          className="studio-publish__daylight-sun"
          cx={SUN_X}
          cy={SUN_LOW + (SUN_HIGH - SUN_LOW) * day}
          r={SUN_RADIUS}
          opacity={Math.min(1, day / SUN_RISES)}
        />
        <path className="studio-publish__daylight-land" d={LAND} />
      </svg>
    </span>
  );
}
