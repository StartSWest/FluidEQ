/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The machine's outputs on Linux, as the engine sees them.
 *
 * On Windows a PowerShell script asks the system (`audioDevices.ts`). Here
 * the engine already knows — it is connected to the sound server and follows
 * every output coming and going — and writes `outputs.json` whole whenever
 * that changes. Reading it is all the app has to do, and what it reads is
 * exactly what the engine will play to, by the same ids the engine names its
 * per-output files and statuses with.
 *
 * An output's `id` is the sound server's name for it (PipeWire's
 * `node.name`): stable across reboots, and what the engine is told to play
 * to. Its `guid` is the id the engine derives from that name, which is what
 * every per-output file and `Device:` block is keyed by, as on Windows.
 */

import { promises as fs } from 'fs';
import type { IAudioDevice } from '../../common/constants';
import type { IFluidEngineEndpoint } from '../../common/audioEngine';
import { linuxOutputsPath } from './linuxEngineFiles';

export interface ILinuxOutput {
  id: string;
  name: string;
  description: string;
  channels: number;
  target: boolean;
}

export interface ILinuxOutputs {
  /** The Windows engine's version this engine's processing is. */
  engineVersion?: string;
  /** `pipewire` or `pulseaudio`. */
  backend?: string;
  /** The engine process that wrote it. */
  pid?: number;
  outputs: ILinuxOutput[];
}

export const NO_LINUX_OUTPUTS: ILinuxOutputs = { outputs: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const GUID =
  /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/;

const parseOutput = (value: unknown): ILinuxOutput | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, description, channels, target } = value;
  // An id the engine's file naming would refuse is no output at all: every
  // per-output file is named by it.
  if (typeof id !== 'string' || !GUID.test(id) || typeof name !== 'string') {
    return undefined;
  }
  return {
    id,
    name,
    description:
      typeof description === 'string' && description.trim()
        ? description.trim()
        : name,
    channels: typeof channels === 'number' && channels > 0 ? channels : 2,
    target: target === true,
  };
};

/** The file's text, guarded field by field; nothing usable is no outputs. */
export const parseLinuxOutputs = (text: string): ILinuxOutputs => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NO_LINUX_OUTPUTS;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.outputs)) {
    return NO_LINUX_OUTPUTS;
  }
  return {
    engineVersion:
      typeof parsed.engineVersion === 'string'
        ? parsed.engineVersion
        : undefined,
    backend: typeof parsed.backend === 'string' ? parsed.backend : undefined,
    pid: typeof parsed.pid === 'number' ? parsed.pid : undefined,
    outputs: parsed.outputs
      .map(parseOutput)
      .filter((output): output is ILinuxOutput => output !== undefined),
  };
};

/** Never rejects: a missing or half-read file is no outputs yet. */
export const readLinuxOutputs = async (
  file: string = linuxOutputsPath(),
): Promise<ILinuxOutputs> => {
  try {
    return parseLinuxOutputs(await fs.readFile(file, 'utf8'));
  } catch {
    return NO_LINUX_OUTPUTS;
  }
};

/**
 * As the device list the window shows. Every output is one the engine can
 * play to — there is no per-output install on Linux — so every one reads as
 * attached, able to run effects and with effects on; Equalizer APO does not
 * exist here. The default is the output the engine plays to, which is the
 * one the listener chose: the system's own default is "FluidEQ" itself.
 */
export const toAudioDevices = (outputs: ILinuxOutputs): IAudioDevice[] =>
  outputs.outputs
    .map((output) => ({
      id: output.name,
      name: output.description,
      guid: output.id,
      isDefault: output.target,
      isActive: true,
      isEqualizerApoAttached: false,
      isFluidEngineAttached: true,
      canHostEffects: true,
      effectsEnabled: true,
      channels: output.channels,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

/** As the setup helper's per-output answer on Windows. */
export const toEngineEndpoints = (
  outputs: ILinuxOutputs,
): IFluidEngineEndpoint[] =>
  outputs.outputs.map((output) => ({
    guid: output.id,
    attached: true,
    backupExists: false,
  }));
