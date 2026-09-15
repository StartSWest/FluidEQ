/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "The engine is installed and I hear no EQ" — the section of a bug report
 * that answers it.
 *
 * This existed because a report could not. A machine with the FluidEQ Engine
 * installed, attached and chosen, playing through an output with no EQ on it,
 * produced a report whose whole audio content was `Audio engine: FluidEQ
 * Engine` and a hundred and twenty lines about the Library's playback host.
 * Everything that would have said which of the five possible failures it was
 * — Windows never loaded the effect, Windows is set to skip effects on that
 * output, the engine loaded and cannot see FluidEQ, the engine loaded and was
 * given nothing to do, the engine is running and the sound is fine — was
 * either never asked or read and thrown away.
 *
 * Three sources, because no single one of them can tell those apart:
 *  - Windows, through the device list: which output is playing, whether it
 *    can host effects at all, whether its enhancements are switched on.
 *  - The setup helper: whether the engine is installed, which build, and
 *    which outputs it is attached to.
 *  - The engine itself, through its per-output status: whether Windows is
 *    running it, whether it is changing the sound, whether it can see
 *    FluidEQ, and its own sentence for why it is passing through.
 *
 * Kept free of Electron and of `fs` so the wording can be tested.
 */

import type { IAudioDevice } from './constants';
import type { TAudioEngine, IFluidEngineStatus } from './audioEngine';
import { normaliseEndpointGuid, type IEngineHealth } from './engineHealth';

export interface IEngineReportFacts {
  engine: TAudioEngine | null;
  /** Every active output, as Windows describes it. */
  devices: readonly IAudioDevice[];
  /** The setup helper's answer, or undefined where it could not be asked. */
  fluid?: IFluidEngineStatus;
  /** What the engine has written about each output it is loaded on. */
  health: IEngineHealth;
}

const yesNo = (value: boolean | null | undefined): string => {
  if (value === true) {
    return 'yes';
  }
  return value === false ? 'no' : 'unknown';
};

/**
 * One output, in four lines: who it is, what Windows allows on it, whether
 * the engine is on it, and what the engine says from inside it.
 */
const describeOutput = (
  device: IAudioDevice,
  facts: IEngineReportFacts,
): string[] => {
  const guid = normaliseEndpointGuid(device.guid);
  const attached = facts.fluid?.endpoints.find(
    (endpoint) => normaliseEndpointGuid(endpoint.guid) === guid,
  );
  const status = facts.health.outputs.find(
    (output) => normaliseEndpointGuid(output.endpoint) === guid,
  );

  const engineLine = status
    ? `Windows is running it=${yesNo(status.locked)}, ` +
      `changing the sound=${yesNo(status.processing)}, ` +
      `sees FluidEQ=${yesNo(status.owner)}` +
      `${status.reason ? `, passing through: ${status.reason}` : ''}` +
      `${status.problems.length ? `, problems: ${status.problems.join(', ')}` : ''}`
    : // No file is a fact, not a gap: the engine writes one the moment
      // Windows loads it on an output, before any audio passes.
      'never loaded on this output (no status written)';

  return [
    `- ${device.name}${device.isDefault ? ' (playing now)' : ''}`,
    `  Windows: effects possible=${yesNo(device.canHostEffects)}, ` +
      `enhancements on=${yesNo(device.effectsEnabled)}` +
      `${device.sampleRate ? `, ${device.sampleRate} Hz` : ''}`,
    `  Attached: FluidEQ Engine=${yesNo(
      attached ? attached.attached : device.isFluidEngineAttached,
    )}, Equalizer APO=${yesNo(device.isEqualizerApoAttached)}`,
    `  Engine says: ${engineLine}`,
  ];
};

/**
 * The whole section, as plain text for the report's code fence.
 *
 * Under Equalizer APO this is still worth having — which outputs APO is on is
 * the same first question — but the engine's own lines say nothing, because
 * Equalizer APO reports nothing about itself.
 */
export const describeAudioEngine = (facts: IEngineReportFacts): string => {
  const { engine, devices, fluid } = facts;
  const header = [
    `Engine in use: ${engine ?? 'none chosen'}`,
    `FluidEQ Engine installed: ${yesNo(fluid?.installed)}` +
      `${fluid?.dllVersion ? ` (build ${fluid.dllVersion})` : ''}`,
    // The three that decide whether Windows will load it at all. An engine
    // installed and attached on every output and never once created is what
    // these answer, and every one of them can turn false long after setup.
    `Windows allows it to load: ${yesNo(fluid?.unsignedAllowed)}, ` +
      `runtime beside it: ${yesNo(fluid?.runtimeBeside)}, ` +
      `has ever run here: ${yesNo(fluid?.everRan)}`,
  ];
  if (fluid?.configDir) {
    header.push(`Engine configuration: ${fluid.configDir}`);
  }
  if (!devices.length) {
    return [...header, 'Outputs: none Windows would list'].join('\n');
  }
  return [
    ...header,
    'Outputs:',
    ...devices.flatMap((device) => describeOutput(device, facts)),
  ].join('\n');
};

export default describeAudioEngine;
