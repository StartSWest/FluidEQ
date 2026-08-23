/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IEqSettings, clampDspSettings } from './chain';

/**
 * The shareable form of a saved preset: one file, one curve, readable by eye.
 *
 * Equalizer APO's `ParametricEQ` text is the right thing to export a CURVE in —
 * every correction database publishes it and every equaliser reads it — and it
 * is the wrong thing for this. It can say a filter is at 3 kHz with a Q of 2.4.
 * It has no way to say that band only acts above -26 dBFS, that the rack is
 * running in parallel, that the phase is linear, or that there is a quarter of
 * fuzz on the end. Exporting a preset as APO text would hand somebody most of a
 * preset and no sign of what was missing.
 *
 * So the shared form is JSON, and deliberately plain JSON: a name, a version,
 * and the settings under keys that say what they are. Somebody can open it,
 * read it, edit a number and send it on, which is the whole point of a format
 * meant to be passed around.
 */
export interface IPresetFile {
  /** Present so a file dropped on the import dialog can be recognised at all. */
  format: 'fluideq-preset';
  /**
   * Bumped when a change makes an old file mean something different.
   *
   * Not when a field is ADDED — `clampDspSettings` fills anything missing with
   * the default, so a file from an older build stays readable and simply does
   * not set what did not exist yet.
   */
  version: 1;
  name: string;
  eq: IEqSettings;
}

const FORMAT = 'fluideq-preset';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Indented, because a format meant to be shared is meant to be read. */
export const toPresetFile = (name: string, eq: IEqSettings): string =>
  `${JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      name,
      // The bypass switch and which preset was showing are not part of a
      // curve, and shipping them would make somebody else's rack turn itself
      // off on import.
      eq: { ...eq, enabled: DSP_DEFAULTS.eq.enabled, presetId: '' },
    } satisfies IPresetFile,
    null,
    2,
  )}\n`;

/**
 * Read one back, or answer undefined for anything that is not one.
 *
 * Undefined rather than a throw, because the caller's other option is APO text:
 * this runs first on every import and "not a preset file" is the ordinary
 * answer, not an error worth a stack trace.
 *
 * Everything inside goes through `clampDspSettings`, so a hand-edited file with
 * a Q of 900 or a band count of nine hundred arrives as something the
 * coefficient maths can survive rather than as a rack that sounds broken.
 */
export const fromPresetFile = (
  text: string,
): { name: string; eq: IEqSettings } | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== FORMAT ||
    typeof parsed.name !== 'string'
  ) {
    return undefined;
  }
  return {
    name: parsed.name,
    eq: clampDspSettings({ ...DSP_DEFAULTS, eq: parsed.eq }).eq,
  };
};
