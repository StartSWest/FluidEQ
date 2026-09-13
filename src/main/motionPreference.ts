/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import path from 'path';

/**
 * Whether the app animates, chosen in the app rather than inherited from
 * Windows.
 *
 * Every animation here stands down under `prefers-reduced-motion: reduce`,
 * and Chromium answers that from Windows' "Animation effects" — a switch
 * people turn off for a snappier desktop far more often than because motion
 * troubles them. With it off the whole app went still: the rails stopped
 * sliding, the Plus sidebar jumped, every entrance vanished, and it came back
 * each time the setting was touched. So the app says what it wants at launch
 * with Chromium's own switch, animated unless somebody chooses Reduced in the
 * tools menu — and then every rule written for reduced motion applies as
 * before, for the people it was written for.
 *
 * A launch switch, so a new choice applies from the next start.
 */

export const MOTION_PREFERENCES = ['full', 'reduced'] as const;
export type TMotionPreference = (typeof MOTION_PREFERENCES)[number];

export const isMotionPreference = (
  value: unknown,
): value is TMotionPreference =>
  typeof value === 'string' &&
  (MOTION_PREFERENCES as readonly string[]).includes(value);

const FILE = 'motion.json';

/** The Chromium switch that makes `prefers-reduced-motion` say each choice. */
export const MOTION_SWITCHES: Record<TMotionPreference, string> = {
  full: 'force-prefers-no-reduced-motion',
  reduced: 'force-prefers-reduced-motion',
};

/** The choice as last saved; full when none was, or it cannot be read. */
export const readMotionPreference = (
  userDataDir: string,
): TMotionPreference => {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(userDataDir, FILE), 'utf8'),
    );
    return typeof parsed === 'object' &&
      parsed !== null &&
      'motion' in parsed &&
      isMotionPreference(parsed.motion)
      ? parsed.motion
      : 'full';
  } catch {
    // Never chosen, or unreadable: animated, as the app is designed to be.
    return 'full';
  }
};

export const writeMotionPreference = (
  userDataDir: string,
  motion: TMotionPreference,
) => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, FILE), JSON.stringify({ motion }));
};
