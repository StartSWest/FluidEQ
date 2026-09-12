/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the FluidEQ Engine says it is doing on each output.
 *
 * The engine runs inside Windows' audio service, where nothing it does can
 * reach this window: it used to report only to its own log, so an engine
 * Windows never loaded, a convolution file it could not read and an EQ that
 * was working all looked the same from here. It now writes one small file per
 * output (`native/system-apo/src/status_file.h`), which main reads
 * (`src/main/engineHealth.ts`) and the window turns into a notice when the
 * engine is failing (`src/renderer/audio/engineTrouble.ts`).
 */

/**
 * What the engine was asked for and is not running, as the codes it writes.
 * A code this list does not know — an engine newer than this app — is still
 * shown, as something else that is not running.
 */
export const ENGINE_PROBLEMS = [
  'convolution',
  'graphic-eq',
  'eq-phase',
  'dsp-rack',
  'reload-failed',
  'unwatched',
] as const;

export type TEngineProblem = (typeof ENGINE_PROBLEMS)[number];

export const isEngineProblem = (code: string): code is TEngineProblem =>
  (ENGINE_PROBLEMS as readonly string[]).includes(code);

export interface IEngineOutputHealth {
  /** `{GUID}`, upper-case — `normaliseEndpointGuid`. */
  endpoint: string;
  /**
   * Windows has this output's audio going through the engine right now. Read
   * as false as well when the audio process that wrote it is gone: a file
   * left by an audio service that has since restarted describes nothing.
   */
  locked: boolean;
  /** And the engine is changing it, rather than passing it through. */
  processing: boolean;
  /**
   * The engine can see FluidEQ running. False while this window is open
   * means the line between the two is down, and the EQ with it.
   */
  owner: boolean;
  /** `TEngineProblem` codes, or codes from an engine newer than this app. */
  problems: string[];
}

export interface IEngineHealth {
  outputs: IEngineOutputHealth[];
}

export const NO_ENGINE_HEALTH: IEngineHealth = { outputs: [] };

/** Asked by the window; answered with a fresh read. */
export const ENGINE_HEALTH_CHANNEL = 'engine-health';
/** Pushed to the window whenever what the engine says changes. */
export const ENGINE_HEALTH_CHANGED_CHANNEL = 'engine-health-changed';

/**
 * One spelling for an endpoint id, whichever side wrote it. The engine writes
 * what Windows hands it; the device list comes from a different API and
 * nothing promises the two agree on case or braces.
 */
export const normaliseEndpointGuid = (guid: string): string =>
  `{${guid
    .trim()
    .replace(/^\{|\}$/g, '')
    .toUpperCase()}}`;

/**
 * The first engine version that writes a status for every output it runs —
 * the binary version of `native/system-apo/src/engine.rc`, as the setup
 * helper reports it for the installed DLL (`dllVersion`).
 */
export const ENGINE_STATUS_SINCE: readonly [number, number] = [1, 1];

/**
 * Whether the installed engine writes status files, so that one missing
 * while sound plays means the engine is not running there.
 *
 * Without this, an engine from before status files existed — still installed
 * on a machine whose app was updated, or left in place by a `pnpm dev` that
 * started before the engine changed — was reported as not running on every
 * output it was audibly running, because it had never written a status and
 * never would. A version that cannot be read is treated the same way: the
 * notice has to be sure before it says the EQ is off.
 */
export const engineReportsStatus = (
  dllVersion: string | undefined,
): boolean => {
  const match = /^(\d+)\.(\d+)(?:\.\d+){0,2}$/.exec(dllVersion?.trim() ?? '');
  if (!match) {
    return false;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const [sinceMajor, sinceMinor] = ENGINE_STATUS_SINCE;
  return major > sinceMajor || (major === sinceMajor && minor >= sinceMinor);
};
