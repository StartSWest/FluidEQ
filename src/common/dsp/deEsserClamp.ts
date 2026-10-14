/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A stored De-esser read back, within the engine's ranges. */
import { clampBoolean, clampNumber, isRecord } from './chainDefaults';
import {
  DE_ESSER_DEFAULTS,
  DE_ESSER_MIN_SPAN,
  DE_ESSER_MODES,
  DE_ESSER_RANGES,
  IDeEsserSettings,
  TDeEsserMode,
} from './deEsser';

const isMode = (value: unknown): value is TDeEsserMode =>
  typeof value === 'string' &&
  (DE_ESSER_MODES as readonly string[]).includes(value);

/**
 * A stored De-esser read back. Anything missing or out of range falls back to
 * the defaults, so every rack saved before the stage existed reads as one
 * with the De-esser off.
 */
const clampDeEsserSettings = (value: unknown): IDeEsserSettings => {
  const stored = isRecord(value) ? value : {};
  const fallback = DE_ESSER_DEFAULTS;
  const lowHz = clampNumber(
    stored.lowHz,
    DE_ESSER_RANGES.lowHz,
    fallback.lowHz,
  );
  const highHz = Math.max(
    lowHz * DE_ESSER_MIN_SPAN,
    clampNumber(stored.highHz, DE_ESSER_RANGES.highHz, fallback.highHz),
  );
  return {
    enabled: clampBoolean(stored.enabled, fallback.enabled),
    isolate: clampBoolean(stored.isolate, fallback.isolate),
    presetId:
      typeof stored.presetId === 'string' ? stored.presetId : fallback.presetId,
    sensitivity: clampNumber(
      stored.sensitivity,
      DE_ESSER_RANGES.sensitivity,
      fallback.sensitivity,
    ),
    lowHz,
    highHz: Math.min(highHz, DE_ESSER_RANGES.highHz.max),
    rangeDb: clampNumber(
      stored.rangeDb,
      DE_ESSER_RANGES.rangeDb,
      fallback.rangeDb,
    ),
    widthOct: clampNumber(
      stored.widthOct,
      DE_ESSER_RANGES.widthOct,
      fallback.widthOct,
    ),
    mode: isMode(stored.mode) ? stored.mode : fallback.mode,
    attackMs: clampNumber(
      stored.attackMs,
      DE_ESSER_RANGES.attackMs,
      fallback.attackMs,
    ),
    releaseMs: clampNumber(
      stored.releaseMs,
      DE_ESSER_RANGES.releaseMs,
      fallback.releaseMs,
    ),
    centreOnly: clampBoolean(stored.centreOnly, fallback.centreOnly),
    keepCymbals: clampNumber(
      stored.keepCymbals,
      DE_ESSER_RANGES.keepCymbals,
      fallback.keepCymbals,
    ),
  };
};

export default clampDeEsserSettings;
