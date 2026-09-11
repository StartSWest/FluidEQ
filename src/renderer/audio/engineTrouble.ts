/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFluidEngineEndpoint, TAudioEngine } from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
  type IEngineOutputHealth,
} from 'common/engineHealth';

/**
 * Whether the FluidEQ Engine is failing somewhere the user can hear it, and
 * how — or undefined when there is nothing to say.
 *
 * - `off`: sound was heard on an output the engine is attached to, and the
 *   engine is not what it went through. Either Windows never ran it there,
 *   or it runs there cut off from FluidEQ and so applies nothing. Only sound
 *   can tell this from an output that is simply quiet: Windows runs the
 *   engine only while something plays, so "not running" on its own is the
 *   ordinary state of every output nobody is listening to.
 * - `problems`: the engine is running an output without part of what it was
 *   asked for — a convolution file it could not load, a rack it could not
 *   start. That needs no sound: the engine says so the moment it happens,
 *   which is usually the moment the change that caused it is made.
 *
 * Nothing at all under Equalizer APO, which says nothing about itself.
 */
export type TEngineTrouble =
  | { kind: 'off'; device: IAudioDevice; key: string }
  | {
      kind: 'problems';
      device: IAudioDevice;
      problems: string[];
      /** Whether restarting Windows audio, which restarts the engine, can help. */
      canRestartHelp: boolean;
      key: string;
    };

export interface IEngineTroubleFacts {
  engine: TAudioEngine | null;
  /** For names, which output is the default, and which can host effects. */
  devices: readonly IAudioDevice[];
  /**
   * Which outputs the engine is on, as its setup helper last said — the
   * authority on that (`registry.ts`), and already re-read by every action
   * that changes it, so hearing sound never has to list the devices again.
   */
  fluidEndpoints: readonly IFluidEngineEndpoint[];
  health: IEngineHealth;
  /**
   * The output sound was heard on, since the capture hearing it started —
   * undefined until it has heard any. Read together with a `health` read
   * after the sound began: see `useEngineTrouble`.
   */
  heardGuid: string | undefined;
}

/**
 * What a restart cannot mend: a file the engine could not load, a curve it
 * could not build. A restart reads them again and fails the same way; the
 * rest are the engine's own state, which a restart starts over.
 */
const CONTENT_PROBLEMS: readonly string[] = ['convolution', 'graphic-eq'];

const sameEndpoint = (a: string, b: string) =>
  normaliseEndpointGuid(a) === normaliseEndpointGuid(b);

export const engineTrouble = ({
  engine,
  devices,
  fluidEndpoints,
  health,
  heardGuid,
}: IEngineTroubleFacts): TEngineTrouble | undefined => {
  if (engine !== 'fluid') {
    return undefined;
  }
  const deviceOf = (guid: string) =>
    devices.find((device) => sameEndpoint(device.guid, guid));
  const statusOf = (guid: string) =>
    health.outputs.find((output) => sameEndpoint(output.endpoint, guid));
  const isAttached = (guid: string) =>
    fluidEndpoints.some(
      (endpoint) => endpoint.attached && sameEndpoint(endpoint.guid, guid),
    );

  if (heardGuid !== undefined) {
    const device = deviceOf(heardGuid);
    const status = statusOf(heardGuid);
    // Attached, and able to host effects at all: an output the engine was
    // never put on has its own notice, and one Windows runs no effects on
    // has another. Neither is the engine failing.
    if (
      device !== undefined &&
      isAttached(device.guid) &&
      device.canHostEffects !== false &&
      (!status?.locked || !status.owner)
    ) {
      return {
        kind: 'off',
        device,
        key: `off:${normaliseEndpointGuid(device.guid)}`,
      };
    }
  }

  const troubled = health.outputs.filter(
    (output) => output.locked && output.owner && output.problems.length > 0,
  );
  // The output being listened to first: it is the one whose sound is wrong
  // right now. Then any other, such as a second output mirrored to.
  const listened = (output: IEngineOutputHealth) =>
    deviceOf(output.endpoint)?.isDefault === true ? 0 : 1;
  const [first] = [...troubled]
    .filter((output) => deviceOf(output.endpoint) !== undefined)
    .sort((a, b) => listened(a) - listened(b));
  const device = first && deviceOf(first.endpoint);
  if (!first || !device) {
    return undefined;
  }
  return {
    kind: 'problems',
    device,
    problems: first.problems,
    canRestartHelp: first.problems.some(
      (code) => !CONTENT_PROBLEMS.includes(code),
    ),
    key: `problems:${first.endpoint}:${first.problems.join(',')}`,
  };
};
