/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDspSettings, clampDspSettings } from './chain';

export interface IDspChainPresetFile {
  format: 'fluideq-dsp-chain';
  version: 1;
  name: string;
  dsp: IDspSettings;
}

const FORMAT = 'fluideq-dsp-chain';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
  });

/** Plain, readable JSON so a chain can be inspected as well as shared. */
export const toDspChainPresetFile = (
  name: string,
  settings: IDspSettings,
): string =>
  `${JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      name,
      dsp: portableDspChainSettings(settings),
    } satisfies IDspChainPresetFile,
    null,
    2,
  )}\n`;

/** Parse and clamp an untrusted, possibly hand-edited complete-chain file. */
export const fromDspChainPresetFile = (
  text: string,
): { name: string; settings: IDspSettings } | undefined => {
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
  return {
    name: parsed.name.trim(),
    settings: portableDspChainSettings(clampDspSettings(parsed.dsp)),
  };
};
