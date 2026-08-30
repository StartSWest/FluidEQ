/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { DSP_DEFAULTS, TCrossfadeCurve } from '../../common/dsp/chain';
import {
  DSP_DIAGNOSTIC_CODES,
  DSP_DIAGNOSTIC_SCHEMA_VERSION,
} from '../../common/dsp/diagnostics';
import { reportDspDiagnostic } from './diagnostics';

const CURVE_POINTS = 128;
/**
 * Keep the first curve point clear of the event used to establish its start
 * value. Chromium rejects overlapping AudioParam automation instead of merely
 * replacing it; scheduling both at `currentTime` made a failed crossfade abort
 * the whole track handoff.
 */
const AUTOMATION_LEAD_SECONDS = 0.005;

export interface IDspCrossfadeMeter {
  active: boolean;
  progress: number;
  outgoingGain: number;
  incomingGain: number;
  /**
   * The curve the audible fade was started with, which is not always the one
   * the panel is showing.
   *
   * A fade is committed to the audio clock at its first sample and nothing
   * re-reads the setting, so picking a different curve while one runs changes
   * the next fade and not this one. Without this, the preview drew the newly
   * picked curve while the markers kept reporting the old one — the same
   * disagreement as a hand-drawn path, from the other direction.
   */
  curve: TCrossfadeCurve;
}

interface IDeckMixer {
  context: AudioContext;
  elements: readonly HTMLAudioElement[];
  gains: readonly GainNode[];
}

const IDLE_METER: IDspCrossfadeMeter = {
  active: false,
  progress: 0,
  outgoingGain: 1,
  incomingGain: 0,
  // Nothing is audible, so nothing reads this; the panel draws its own setting
  // between fades. It is the default rather than a literal so the two cannot
  // drift apart.
  curve: DSP_DEFAULTS.crossfade.curve,
};

let mixer: IDeckMixer | undefined;
let meter = IDLE_METER;
let meterFrame = 0;
const listeners = new Set<() => void>();

const cancelMeterFrame = (): void => {
  cancelAnimationFrame(meterFrame);
  meterFrame = 0;
};

const emitMeter = (next: IDspCrossfadeMeter): void => {
  meter = next;
  listeners.forEach((listener) => listener());
};

const subscribeMeter = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const crossfadeGain = (
  curve: TCrossfadeCurve,
  progress: number,
  incoming: boolean,
): number => {
  const unit = Math.max(0, Math.min(1, progress));
  if (curve === 'linear') {
    return incoming ? unit : 1 - unit;
  }
  if (curve === 'smooth') {
    const smooth = unit * unit * (3 - 2 * unit);
    return incoming ? smooth : 1 - smooth;
  }
  const incomingPower = Math.sin((unit * Math.PI) / 2);
  const outgoingPower = Math.cos((unit * Math.PI) / 2);
  const unitySum = Math.max(Number.EPSILON, incomingPower + outgoingPower);
  return (incoming ? incomingPower : outgoingPower) / unitySum;
};

const curveValues = (curve: TCrossfadeCurve, incoming: boolean): Float32Array =>
  Float32Array.from({ length: CURVE_POINTS }, (_, index) =>
    crossfadeGain(curve, index / (CURVE_POINTS - 1), incoming),
  );

const cancelAutomation = (parameter: AudioParam, at: number): void => {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(at);
    return;
  }
  parameter.cancelScheduledValues(at);
};

const setGainNow = (gain: GainNode, value: number): void => {
  const parameter = gain.gain;
  const now = gain.context.currentTime;
  try {
    cancelAutomation(parameter, now);
    parameter.setValueAtTime(value, now);
  } catch {
    // A transport command must still complete if a browser rejects stale
    // automation from a previous transition. The direct assignment is the
    // synchronous, unscheduled fallback for exactly that recovery path.
    parameter.value = value;
  }
};

/**
 * Main-thread fallback for the two cases where audio-clock automation cannot
 * run: the DSP mixer has not registered yet, or Chromium rejects an
 * AudioParam curve. The cleanup timer in the player remains the hard end of
 * the overlap; this loop only paints the audible curve while it is active.
 */
const scheduleFrameCrossfade = (
  setOutgoing: (value: number) => void,
  setIncoming: (value: number) => void,
  durationMs: number,
  curve: TCrossfadeCurve,
): void => {
  cancelMeterFrame();
  const startedAt = performance.now();
  const duration = Math.max(1, durationMs);
  const paint = () => {
    const progress = Math.max(
      0,
      Math.min(1, (performance.now() - startedAt) / duration),
    );
    const outgoingGain = crossfadeGain(curve, progress, false);
    const incomingGain = crossfadeGain(curve, progress, true);
    setOutgoing(outgoingGain);
    setIncoming(incomingGain);
    emitMeter({
      active: progress < 1,
      progress,
      outgoingGain,
      incomingGain,
      curve,
    });
    if (progress < 1) {
      meterFrame = requestAnimationFrame(paint);
    } else {
      meterFrame = 0;
    }
  };
  paint();
};

const scheduleElementVolumeCrossfade = (
  outgoing: HTMLAudioElement,
  incoming: HTMLAudioElement,
  durationMs: number,
  curve: TCrossfadeCurve,
): void => {
  const outgoingVolume = outgoing.volume;
  const incomingVolume = incoming.volume;
  scheduleFrameCrossfade(
    (gain) => {
      outgoing.volume = outgoingVolume * gain;
    },
    (gain) => {
      incoming.volume = incomingVolume * gain;
    },
    durationMs,
    curve,
  );
};

/**
 * Register the stable player decks once their Web Audio nodes exist.
 *
 * The returned cleanup is identity-checked so a stale engine teardown cannot
 * clear a newer engine created by a hot reload.
 */
export const registerDspDeckMixer = (
  context: AudioContext,
  elements: readonly HTMLAudioElement[],
  gains: readonly GainNode[],
): (() => void) => {
  const registered = { context, elements, gains };
  mixer = registered;
  return () => {
    if (mixer === registered) {
      mixer = undefined;
      cancelAnimationFrame(meterFrame);
      meterFrame = 0;
      emitMeter(IDLE_METER);
    }
  };
};

/** Exactly one decoder is audible outside an active transition. */
export const selectDspDeck = (active: HTMLAudioElement): void => {
  cancelMeterFrame();
  const current = mixer;
  if (!current) {
    emitMeter(IDLE_METER);
    return;
  }
  current.elements.forEach((element, index) => {
    const gain = current.gains[index];
    if (gain) {
      setGainNow(gain, element === active ? 1 : 0);
    }
  });
  emitMeter(IDLE_METER);
};

/**
 * Schedule the audible transition on the audio clock.
 *
 * Paint can be throttled or suspended without changing this automation. The
 * outgoing deck therefore reaches digital silence even if the renderer never
 * delivers the animation frame that later releases its decoder.
 */
export const scheduleDspDeckCrossfade = (
  outgoing: HTMLAudioElement,
  incoming: HTMLAudioElement,
  durationMs: number,
  curve: TCrossfadeCurve,
): boolean => {
  if (outgoing === incoming) {
    return false;
  }
  const current = mixer;
  if (!current) {
    reportDspDiagnostic({
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code: DSP_DIAGNOSTIC_CODES.crossfadeMixerFallback,
      severity: 'warn',
      origin: 'renderer',
      values: { durationMs, curve },
    });
    scheduleElementVolumeCrossfade(outgoing, incoming, durationMs, curve);
    return true;
  }
  const outgoingIndex = current.elements.indexOf(outgoing);
  const incomingIndex = current.elements.indexOf(incoming);
  const outgoingNode = current.gains[outgoingIndex];
  const incomingNode = current.gains[incomingIndex];
  if (!outgoingNode || !incomingNode || outgoingIndex === incomingIndex) {
    reportDspDiagnostic({
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code: DSP_DIAGNOSTIC_CODES.crossfadeDeckFallback,
      severity: 'warn',
      origin: 'renderer',
      values: { durationMs, curve },
    });
    scheduleElementVolumeCrossfade(outgoing, incoming, durationMs, curve);
    return true;
  }

  const durationSeconds = Math.max(0.001, durationMs / 1_000);
  const now = current.context.currentTime;
  const startsAt = now + AUTOMATION_LEAD_SECONDS;
  try {
    [outgoingNode.gain, incomingNode.gain].forEach((parameter) => {
      cancelAutomation(parameter, now);
    });
    outgoingNode.gain.setValueAtTime(1, now);
    incomingNode.gain.setValueAtTime(0, now);
    outgoingNode.gain.setValueCurveAtTime(
      curveValues(curve, false),
      startsAt,
      durationSeconds,
    );
    incomingNode.gain.setValueCurveAtTime(
      curveValues(curve, true),
      startsAt,
      durationSeconds,
    );
  } catch {
    // Audio-clock automation is preferred, but a browser rejection must not
    // turn the requested fade into an instant cut. The same gain nodes remain
    // the audible path, so move them frame by frame until player cleanup.
    reportDspDiagnostic({
      schemaVersion: DSP_DIAGNOSTIC_SCHEMA_VERSION,
      code: DSP_DIAGNOSTIC_CODES.crossfadeAutomationFallback,
      severity: 'warn',
      origin: 'renderer',
      values: { durationMs, curve },
    });
    scheduleFrameCrossfade(
      (gain) => setGainNow(outgoingNode, gain),
      (gain) => setGainNow(incomingNode, gain),
      durationMs,
      curve,
    );
    return true;
  }

  cancelMeterFrame();
  const paintMeter = () => {
    const progress = Math.max(
      0,
      Math.min(1, (current.context.currentTime - startsAt) / durationSeconds),
    );
    emitMeter({
      active: progress < 1,
      progress,
      outgoingGain: crossfadeGain(curve, progress, false),
      incomingGain: crossfadeGain(curve, progress, true),
      curve,
    });
    if (progress < 1 && mixer === current) {
      meterFrame = requestAnimationFrame(paintMeter);
    } else {
      meterFrame = 0;
    }
  };
  meterFrame = requestAnimationFrame(paintMeter);
  return true;
};

export const readDspCrossfadeMeter = (): IDspCrossfadeMeter => meter;

export const useDspCrossfadeMeter = (): IDspCrossfadeMeter =>
  useSyncExternalStore(
    subscribeMeter,
    readDspCrossfadeMeter,
    readDspCrossfadeMeter,
  );
