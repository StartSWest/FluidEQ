/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  IEqSettings,
  clampDspSettings,
} from './chain';

export interface IDspChainPresetFile {
  format: 'fluideq-dsp-chain';
  version: 1;
  name: string;
  dsp: IDspSettings;
  /**
   * The chain's tone, played in the main EQ (`presetCurve.ts`). Optional, so
   * the format stays version 1: a file without one is a rack alone, which is
   * every file written before the tone moved out of the rack — and an older
   * FluidEQ reading a newer file keeps the rack and passes over the rest.
   */
  curve?: IEqSettings;
}

/** A chain as it is saved and shared: the rack and, if it has one, a tone. */
export interface IPortableDspChain {
  name: string;
  settings: IDspSettings;
  curve?: IEqSettings;
}

const FORMAT = 'fluideq-dsp-chain';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A curve from anywhere, fit to play: every field clamped, no monitor on. */
export const portableDspCurve = (curve: unknown): IEqSettings | undefined =>
  isRecord(curve)
    ? { ...clampDspSettings({ eq: curve }).eq, enabled: true, isolate: false }
    : undefined;

/**
 * The complete audible rack, without state that belongs to this listening
 * session rather than to its sound.
 *
 * Crossfade is a player transition and was deliberately moved out of DSP
 * presets. Isolate flags are temporary monitors: exporting one would make an
 * imported chain play only residue instead of the sound its name promises.
 */
export const portableDspChainSettings = (
  settings: IDspSettings,
): IDspSettings =>
  clampDspSettings({
    ...settings,
    enabled: true,
    presetId: '',
    crossfade: DSP_DEFAULTS.crossfade,
    denoise: { ...settings.denoise, isolate: false },
    eq: { ...settings.eq, isolate: false },
    exciter: { ...settings.exciter, isolate: false },
    bassForge: { ...settings.bassForge, isolate: false },
    bassPunch: { ...settings.bassPunch, isolate: false },
    room: {
      ...settings.room,
      compareOriginal: false,
      sourceAlreadySpatial: false,
    },
  });

/** Plain, readable JSON so a chain can be inspected as well as shared. */
export const toDspChainPresetFile = (
  name: string,
  settings: IDspSettings,
  curve?: IEqSettings,
): string => {
  const tone = portableDspCurve(curve);
  return `${JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      name,
      dsp: portableDspChainSettings(settings),
      ...(tone ? { curve: tone } : {}),
    } satisfies IDspChainPresetFile,
    null,
    2,
  )}\n`;
};

/** Parse and clamp an untrusted, possibly hand-edited complete-chain file. */
export const fromDspChainPresetFile = (
  text: string,
): IPortableDspChain | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== FORMAT ||
    parsed.version !== 1 ||
    typeof parsed.name !== 'string' ||
    parsed.name.trim() === '' ||
    !isRecord(parsed.dsp)
  ) {
    return undefined;
  }
  const curve = portableDspCurve(parsed.curve);
  return {
    name: parsed.name.trim(),
    settings: portableDspChainSettings(clampDspSettings(parsed.dsp)),
    ...(curve ? { curve } : {}),
  };
};
