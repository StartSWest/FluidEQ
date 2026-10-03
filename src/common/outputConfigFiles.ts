/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FLUID_ENGINE_DSP_FILENAME,
  FLUID_ENGINE_PROGRAMME_FILENAME,
} from './audioEngine';
import {
  CURVE_COMPARISON_FILENAME,
  EQ_PHASE_FILENAME,
} from './curveComparison';
import { TREBLE_DESIGN_FILENAMES } from './filterDesign';
import { engineAtLeast } from './engineHealth';

export const ENGINE_OUTPUT_CONFIG_SINCE: readonly [number, number] = [1, 19];

export const engineTakesOutputConfig = (version: string | undefined): boolean =>
  engineAtLeast(version, ENGINE_OUTPUT_CONFIG_SINCE);

export const OUTPUT_CONFIG_BASENAMES = {
  dsp: FLUID_ENGINE_DSP_FILENAME,
  programme: FLUID_ENGINE_PROGRAMME_FILENAME,
  roomHead: 'fluideq-room-head.txt',
  eqPhase: EQ_PHASE_FILENAME,
  curvePhase: CURVE_COMPARISON_FILENAME,
  eqTreble: TREBLE_DESIGN_FILENAMES.eq,
  curveTreble: TREBLE_DESIGN_FILENAMES.curves,
} as const;

export type TOutputConfigFile = keyof typeof OUTPUT_CONFIG_BASENAMES;

/** Native endpoint filenames use a canonical GUID, never an endpoint label. */
export const outputConfigGuid = (endpoint: string): string | undefined => {
  const bare =
    endpoint.startsWith('{') && endpoint.endsWith('}')
      ? endpoint.slice(1, -1)
      : endpoint;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    bare,
  )
    ? bare.toLowerCase()
    : undefined;
};

/** An invalid endpoint has no filename; it must never reach a shared file. */
export const outputConfigFileName = (
  kind: TOutputConfigFile,
  endpoint: string,
): string | undefined => {
  const guid = outputConfigGuid(endpoint);
  return guid === undefined
    ? undefined
    : `${OUTPUT_CONFIG_BASENAMES[kind].slice(0, -4)}-${guid}.txt`;
};

/** Only our canonical endpoint files; used when neutralising an engine. */
export const isOutputConfigFileName = (filename: string): boolean => {
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.txt')) {
    return false;
  }
  return Object.values(OUTPUT_CONFIG_BASENAMES).some((basename) => {
    const prefix = `${basename.slice(0, -4)}-`;
    const guid = lower.slice(prefix.length, -4);
    return (
      lower.startsWith(prefix) &&
      guid.length === 36 &&
      outputConfigGuid(guid) === guid
    );
  });
};
