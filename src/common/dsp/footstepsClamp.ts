/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A stored Footsteps read back, within the engine's ranges. */
import { clampBoolean, clampNumber, isRecord } from './chainDefaults';
import {
  FOOTSTEPS_DEFAULTS,
  FOOTSTEPS_RANGES,
  IFootstepsSettings,
} from './footsteps';

/**
 * Anything missing or out of range falls back to the defaults, so every rack
 * saved before the stage existed reads as one with Footsteps off.
 */
const clampFootstepsSettings = (value: unknown): IFootstepsSettings => {
  const stored = isRecord(value) ? value : {};
  const fallback = FOOTSTEPS_DEFAULTS;
  return {
    enabled: clampBoolean(stored.enabled, fallback.enabled),
    isolate: clampBoolean(stored.isolate, fallback.isolate),
    presetId:
      typeof stored.presetId === 'string' ? stored.presetId : fallback.presetId,
    lift: clampNumber(stored.lift, FOOTSTEPS_RANGES.lift, fallback.lift),
    calm: clampNumber(stored.calm, FOOTSTEPS_RANGES.calm, fallback.calm),
  };
};

export default clampFootstepsSettings;
