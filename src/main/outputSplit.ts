/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the FluidEQ Engine can play a second output itself, and the file
 * that tells it to.
 *
 * Under the FluidEQ Engine both outputs' effects run inside Windows' audio
 * service, so the main output's engine hands raw sound to each receiver's
 * independent graph through shared memory. Each receiver reports its own
 * buffering and processing delay; none of those buffers delay the main.
 * A helper copy adds capture and render buffers (Ivan, 2026-10-02: "keep both
 * apo path if apo selected and fluid fastest path for realtime 2nd output if
 * fluid engine selected"). The engine's side is
 * `native/system-apo/src/split_tap.h`; `split_test.cpp` holds it to the text
 * written here.
 */

import type {
  IAudioEngineStatus,
  TAudioEngine,
  TEngineSlotName,
} from '../common/audioEngine';
import {
  ENGINE_SPLIT_SINCE,
  engineAtLeast,
  normaliseEndpointGuid,
  type IEngineHealth,
} from '../common/engineHealth';
import type { IAudioDevice } from '../common/profileTypes';

/**
 * The effect slots whose engine hears an output's whole mix, which is what
 * the main output's engine has to hand on and the second output's has to
 * play into. A stream or local effect runs once per stream: on the main
 * output it would hand on one program's sound, on the second it would add
 * the main output's into one stream of several.
 */
const WHOLE_MIX_SLOTS: readonly TEngineSlotName[] = [
  'efx',
  'mfx',
  'gfx',
  'efx-single',
  'mfx-single',
];

export interface ISplitLine {
  /** The main output's id. */
  from: string;
  /** The second output's. */
  to: string;
  /** Its volume, 0 to 1. */
  volume: number;
}

/** The file's text: every line, whole, so a stale one never survives a write. */
export const splitFileText = (lines: readonly ISplitLine[]): string =>
  `${[
    '# FluidEQ Engine second outputs v1',
    ...lines.map(
      ({ from, to, volume }) =>
        `${from.toLowerCase()} ${to.toLowerCase()} ${Math.min(
          1,
          Math.max(0, volume),
        ).toFixed(3)}`,
    ),
  ].join('\r\n')}\r\n`;

export interface ISplitFacts {
  engine: TAudioEngine | null;
  /** The setup helper's report: the installed engine and its slots. */
  status: IAudioEngineStatus;
  /** What the engine has said about each output. */
  health: IEngineHealth;
  main: IAudioDevice;
  second: IAudioDevice;
}

/**
 * Why the engine cannot play this second output itself — a sentence for the
 * log — or undefined when it can. Anything not known for certain is a
 * reason: the helper's copy works everywhere, and a second output the engine
 * was asked to play and never did would be silent.
 */
export const splitRefusal = ({
  engine,
  status,
  health,
  main,
  second,
}: ISplitFacts): string | undefined => {
  if (engine !== 'fluid') {
    return 'Equalizer APO is the engine';
  }
  if (
    !status.fluid.installed ||
    !engineAtLeast(status.fluid.dllVersion, ENGINE_SPLIT_SINCE)
  ) {
    return `the engine is ${status.fluid.dllVersion ?? 'not installed'}`;
  }
  const refusalFor = (device: IAudioDevice): string | undefined => {
    const id = normaliseEndpointGuid(device.guid);
    if (device.effectsEnabled === false) {
      return `audio enhancements are off on ${device.name}`;
    }
    const endpoint = status.fluid.endpoints.find(
      (candidate) => normaliseEndpointGuid(candidate.guid) === id,
    );
    if (!endpoint?.attached) {
      return `the engine is not on ${device.name}`;
    }
    if (!endpoint.slot || !WHOLE_MIX_SLOTS.includes(endpoint.slot)) {
      return `the engine is in the ${endpoint.slot ?? 'unknown'} slot on ${device.name}`;
    }
    // A status is written the first time Windows creates the engine on an
    // output, and stays. Without one, attached may still mean never loaded.
    if (!health.outputs.some((output) => output.endpoint === id)) {
      return `the engine has never run on ${device.name}`;
    }
    return undefined;
  };
  return refusalFor(main) ?? refusalFor(second);
};

/** What the split's readings are read from. */
export interface ISplitReaders {
  getEngine: () => TAudioEngine | null;
  /** The setup helper's report on the installed engine. */
  readStatus: () => Promise<IAudioEngineStatus>;
  /** What the engine has said about each output, read now. */
  readHealth: () => Promise<IEngineHealth>;
}

/** Why the engine cannot play `second` from `main` now, or undefined. */
export const readSplitRefusal = async (
  readers: ISplitReaders,
  main: IAudioDevice,
  second: IAudioDevice,
): Promise<string | undefined> => {
  const engine = readers.getEngine();
  if (engine !== 'fluid') {
    return 'Equalizer APO is the engine';
  }
  try {
    const [status, health] = await Promise.all([
      readers.readStatus(),
      readers.readHealth(),
    ]);
    return splitRefusal({ engine, status, health, main, second });
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    return `the engine's status could not be read (${said})`;
  }
};

/** What the engine's health says of a second output it plays. */
export type TSplitReading =
  /** The shared transport was refused: this output cannot be played so. */
  | { kind: 'refused' }
  /** Not playing from this main output yet, or no delay to report. */
  | { kind: 'waiting' }
  | { kind: 'playing'; delayMs: number };

export const readSplitHealth = (
  health: IEngineHealth,
  main: IAudioDevice,
  second: IAudioDevice,
): TSplitReading => {
  const from = normaliseEndpointGuid(main.guid);
  const output = health.outputs.find(
    ({ endpoint }) => endpoint === normaliseEndpointGuid(second.guid),
  );
  const source = health.outputs.find(({ endpoint }) => endpoint === from);
  if (
    [source, output].some(
      (candidate) =>
        candidate?.locked &&
        candidate.owner &&
        candidate.problems.includes('split-transport'),
    )
  ) {
    // A mapping refusal is not "waiting for music": the receiver stops, and
    // main's ordinary processing keeps running.
    return { kind: 'refused' };
  }
  const split = output?.split;
  const latency = output?.latency;
  if (split?.state !== 'playing' || split.from !== from || !latency) {
    return { kind: 'waiting' };
  }
  // 1.18 reported the source rack separately. 1.19 sends raw sound and
  // reports zero source DSP plus the receiver's complete graph.
  const processing =
    split.sourceDspMs !== undefined && split.outputEqMs !== undefined
      ? split.sourceDspMs + split.outputEqMs
      : (latency.frames * 1000) / latency.rate;
  return { kind: 'playing', delayMs: split.lagMs + processing };
};
