/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A stored Game filter read back, within the engine's ranges. */
import { clampBoolean, clampNumber, isRecord } from './chainDefaults';
import {
  FOOTSTEPS_DEFAULTS,
  FOOTSTEPS_RANGES,
  IFootstepsSettings,
} from './footsteps';

/**
 * Anything missing or out of range falls back to the defaults, so every rack
 * saved before the stage existed reads as one with it off. A rack saved
 * before the Game filter's other parts holds none of them, and reads as
 * having none — no Environment, no Voices — so a Footsteps somebody tuned
 * sounds as it did.
 */
const clampFootstepsSettings = (value: unknown): IFootstepsSettings => {
  const stored = isRecord(value) ? value : {};
  const fallback = FOOTSTEPS_DEFAULTS;
  // Only a filter that was saved, as Footsteps alone, reads as having none
  // of the other parts. A rack with no filter at all takes the defaults: it
  // read as Environment and Voices at zero, so switching the filter on by
  // hand on a rack from before the stage played Footsteps alone.
  const isGame =
    !isRecord(value) || 'voices' in stored || 'environment' in stored;
  return {
    enabled: clampBoolean(stored.enabled, fallback.enabled),
    isolate: clampBoolean(stored.isolate, fallback.isolate),
    presetId:
      typeof stored.presetId === 'string' ? stored.presetId : fallback.presetId,
    lift: clampNumber(stored.lift, FOOTSTEPS_RANGES.lift, fallback.lift),
    calm: clampNumber(stored.calm, FOOTSTEPS_RANGES.calm, fallback.calm),
    heavy: clampBoolean(stored.heavy, false),
    environment: clampNumber(
      stored.environment,
      FOOTSTEPS_RANGES.environment,
      isGame ? fallback.environment : 0,
    ),
    voices: clampNumber(
      stored.voices,
      FOOTSTEPS_RANGES.voices,
      isGame ? fallback.voices : 0,
    ),
    duck: clampBoolean(stored.duck, false),
    useRoom: clampBoolean(stored.useRoom, false),
  };
};

export default clampFootstepsSettings;
