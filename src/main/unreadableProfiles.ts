/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';

/**
 * A profile that cannot be read, said once.
 *
 * `fetchPreset` logged every failure with its stack, and it is asked for the
 * same profile over and over by callers that are right to ask again: the
 * config writer on every flush (a slider drag is dozens), the layer list on
 * every refresh, the output's state on every change of output. A 2.4.0 report
 * carried 106 stack traces for one output, which pushed everything else out
 * of the 2,000 lines a report keeps. The callers learned to look before
 * asking for a profile that is not there; one that is there and damaged still
 * said so on every flush.
 *
 * So the reader itself says a failure once per profile and per thing that is
 * wrong with it: again when the file changes to another kind of damage, and
 * again after it has read, when losing it is news once more. It still throws
 * every time, which is what its callers act on.
 */

/** By profile: what could not be read the last time it was said. */
const said = new Map<string, string>();

const keyOf = (presetName: string, presetsDir: string) =>
  JSON.stringify([presetsDir, presetName]);

/**
 * `content` is the profile's text when the file itself could be read, and
 * the failure is then in what it holds; without it the failure is the read's.
 */
export const sayProfileUnreadable = (
  presetName: string,
  presetsDir: string,
  content: string | undefined,
  error: unknown,
) => {
  const wrong =
    content ?? (error instanceof Error ? error.message : String(error));
  const key = keyOf(presetName, presetsDir);
  if (said.get(key) === wrong) {
    return;
  }
  said.set(key, wrong);
  log.error(`Could not read the profile "${presetName}" in ${presetsDir}`);
  log.error(error);
};

/** It read: the next failure of this profile is said again. */
export const profileWasRead = (presetName: string, presetsDir: string) => {
  said.delete(keyOf(presetName, presetsDir));
};
