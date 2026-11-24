/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The microphone's Voice stage, as the app holds it: low cut, "Close to the
 * mic", the pop guard, the gate and Voice level. The engine's half is `voice.h`; the
 * ranges here are the ones its decoder accepts, so a value the app can store
 * is one the engine reads.
 *
 * Only a microphone's rack carries it. A music rack has none, which is why
 * `IDspSettings.voice` is optional rather than defaulted off everywhere.
 */

export interface IVoiceSettings {
  enabled: boolean;
  /** 0 is off, otherwise 20 to 300 Hz. */
  lowCutHz: number;
  /** 0 to 12 dB off below 180 Hz: the proximity effect taken back. */
  proximityDb: number;
  /** 0 to 1: how much of a plosive's low burst is taken away. */
  deplosive: number;
  gateEnabled: boolean;
  /** dBFS: over it the gate opens. */
  gateThresholdDb: number;
  /** How far it closes, dB. Under ~15 dB it is an expander. */
  gateRangeDb: number;
  gateHoldMs: number;
  gateAttackMs: number;
  gateReleaseMs: number;
  /**
   * Voice level (engine 1.33): the voice brought to `levelTargetDb` while it
   * speaks, lifted by at most `levelMaxLiftDb`. After the gate.
   */
  levelEnabled: boolean;
  levelTargetDb: number;
  levelMaxLiftDb: number;
}

export const VOICE_RANGES = {
  lowCutHz: { min: 20, max: 300 },
  proximityDb: { min: 0, max: 12 },
  deplosive: { min: 0, max: 1 },
  gateThresholdDb: { min: -80, max: -10 },
  gateRangeDb: { min: 0, max: 80 },
  gateHoldMs: { min: 0, max: 1000 },
  gateAttackMs: { min: 0.1, max: 50 },
  gateReleaseMs: { min: 5, max: 2000 },
  levelTargetDb: { min: -30, max: -10 },
  levelMaxLiftDb: { min: 0, max: 24 },
} as const;

export const VOICE_DEFAULTS: IVoiceSettings = {
  enabled: false,
  lowCutHz: 0,
  proximityDb: 0,
  deplosive: 0,
  gateEnabled: false,
  gateThresholdDb: -50,
  gateRangeDb: 15,
  gateHoldMs: 200,
  gateAttackMs: 2,
  gateReleaseMs: 150,
  levelEnabled: false,
  levelTargetDb: -18,
  levelMaxLiftDb: 18,
};

const clampTo = (
  value: unknown,
  range: { readonly min: number; readonly max: number },
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

/** Anything read back from disk or the bridge, made a valid Voice. */
export const clampVoiceSettings = (value: unknown): IVoiceSettings => {
  const v = (
    typeof value === 'object' && value !== null ? value : {}
  ) as Record<string, unknown>;
  const d = VOICE_DEFAULTS;
  // 0 is "off" for the low cut; anything else lands inside its range.
  const lowCut =
    v.lowCutHz === 0
      ? 0
      : clampTo(v.lowCutHz, VOICE_RANGES.lowCutHz, d.lowCutHz);
  return {
    enabled: v.enabled === true,
    lowCutHz: lowCut,
    proximityDb: clampTo(
      v.proximityDb,
      VOICE_RANGES.proximityDb,
      d.proximityDb,
    ),
    deplosive: clampTo(v.deplosive, VOICE_RANGES.deplosive, d.deplosive),
    gateEnabled: v.gateEnabled === true,
    gateThresholdDb: clampTo(
      v.gateThresholdDb,
      VOICE_RANGES.gateThresholdDb,
      d.gateThresholdDb,
    ),
    gateRangeDb: clampTo(
      v.gateRangeDb,
      VOICE_RANGES.gateRangeDb,
      d.gateRangeDb,
    ),
    gateHoldMs: clampTo(v.gateHoldMs, VOICE_RANGES.gateHoldMs, d.gateHoldMs),
    gateAttackMs: clampTo(
      v.gateAttackMs,
      VOICE_RANGES.gateAttackMs,
      d.gateAttackMs,
    ),
    gateReleaseMs: clampTo(
      v.gateReleaseMs,
      VOICE_RANGES.gateReleaseMs,
      d.gateReleaseMs,
    ),
    levelEnabled: v.levelEnabled === true,
    levelTargetDb: clampTo(
      v.levelTargetDb,
      VOICE_RANGES.levelTargetDb,
      d.levelTargetDb,
    ),
    levelMaxLiftDb: clampTo(
      v.levelMaxLiftDb,
      VOICE_RANGES.levelMaxLiftDb,
      d.levelMaxLiftDb,
    ),
  };
};
