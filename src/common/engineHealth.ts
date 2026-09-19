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
  /**
   * The engine's own sentence for why it is passing this output through —
   * "FluidEQ is not running", "no config.txt in the configuration directory",
   * and three more (`watcher_log.cpp`). Empty while it is processing.
   *
   * Written by the engine since the first status file and thrown away by the
   * app until 1.7.1, which is why a machine where the engine was attached and
   * silent produced a bug report that could not say why. It is English, from
   * the engine, so it is logged and reported rather than shown: the window
   * says what it means in the user's own language (`engineTrouble.ts`).
   */
  reason?: string;
  /**
   * The last named song live leveling finished on this output, from an
   * engine new enough to level by song. Absent otherwise.
   */
  lastSong?: IFinishedSong;
  /**
   * Sound has actually reached the engine on this output since Windows built
   * its chain — from an engine that counts it (`ENGINE_CARRIED_SINCE`).
   *
   * False while something is playing there is the one state every other
   * field calls healthy and a listener calls broken: Windows created the
   * engine in one of the output's effect slots and plays through a chain
   * that slot is not in, so `locked`, `processing` and `owner` are all true
   * and the EQ does nothing. Absent from an older engine, which says
   * nothing either way and must not be read as false.
   */
  carried?: boolean;
  /**
   * How many channels the stream Windows locked has, from an engine that
   * has the room (1.8 and up). Absent from older engines.
   */
  channels?: number;
  /**
   * What the room does with them — `off`, `no-head`, `front-stage`, `music`
   * (a stereo stream upmixed to the whole ring), `5.1`,
   * `7.1`, `on` — in the engine's words; the card's chip translates. Absent
   * from older engines.
   */
  room?: TRoomState;
  /**
   * The delay this output's audio has, as the engine measures it: the frames
   * it adds, at `rate`, and what each stage contributes (only those that add
   * anything — see `LATENCY_STAGES`). What the DSP and EQ pages show as the
   * lag. Absent from an engine older than game mode; nothing (0, no parts)
   * while the engine passes the sound through.
   */
  latency?: IEngineLatency;
  /**
   * Game mode: the Gaming chain on the rack, or the Games voicing — and only
   * while the engine is processing the output.
   */
  gameMode?: boolean;
}

/**
 * The engine's names for the stages that can delay an output's audio, in
 * the order the sound meets them.
 */
export const LATENCY_STAGES = [
  'leveler',
  'restoration',
  'exciter',
  'bassForge',
  'linearEq',
  'bassPunch',
  'room',
  'dimension',
  'compressor',
  'maximizer',
  'headroom',
  'master',
  'safety',
  'eqPhase',
  'curvePhase',
  'convolution',
  'curves',
  'guard',
  'filters',
  'preamp',
] as const;

export type TLatencyStage = (typeof LATENCY_STAGES)[number];

export interface IEngineLatency {
  /** The stream's rate, which the frames below are frames of. */
  rate: number;
  /** Every stage together: what `GetLatency` hands Windows. */
  frames: number;
  /** The stages that add anything, in the order the audio meets them. */
  parts: { stage: TLatencyStage; frames: number; active?: boolean }[];
}

export const ROOM_STATES = [
  'off',
  'no-head',
  'front-stage',
  'music',
  '5.1',
  '7.1',
  'on',
] as const;

export type TRoomState = (typeof ROOM_STATES)[number];

export const isRoomState = (value: unknown): value is TRoomState =>
  typeof value === 'string' &&
  (ROOM_STATES as readonly string[]).includes(value);

/** What live leveling learned about one song — see `songLevels.ts`. */
export interface IFinishedSong {
  /** The app's own sixteen-hex-digit identity for the song. */
  id: string;
  /** The loudest settled short-term loudness heard, in LUFS. */
  levelLufs: number;
  /** The loudest true peak heard, in dBTP. */
  peakDb: number;
  /** Seconds of music the level was learned from. */
  seconds: number;
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
 * The first engine version whose status says whether sound has reached it —
 * `IEngineOutputHealth.carried`.
 *
 * Its own gate rather than `ENGINE_STATUS_SINCE`, because the two answer
 * different questions: an engine from 1.1 writes statuses and can be
 * trusted about being locked, while only 1.9 can be trusted about a missing
 * `carried` meaning no audio has come rather than an engine that never says.
 */
export const ENGINE_CARRIED_SINCE: readonly [number, number] = [1, 9];

/** Whether `dllVersion` is at or past `since`; false when it cannot be read. */
export const engineAtLeast = (
  dllVersion: string | undefined,
  since: readonly [number, number],
): boolean => {
  const match = /^(\d+)\.(\d+)(?:\.\d+){0,2}$/.exec(dllVersion?.trim() ?? '');
  if (!match) {
    return false;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > since[0] || (major === since[0] && minor >= since[1]);
};

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
export const engineReportsStatus = (dllVersion: string | undefined): boolean =>
  engineAtLeast(dllVersion, ENGINE_STATUS_SINCE);

/**
 * Whether the installed engine says when sound reaches it, so `carried`
 * being false means no audio has come rather than an engine that never says.
 */
export const engineReportsCarried = (dllVersion: string | undefined): boolean =>
  engineAtLeast(dllVersion, ENGINE_CARRIED_SINCE);

/** Versioned Room commands and truthful comparison telemetry. */
export const ENGINE_ROOM_SINCE: readonly [number, number] = [1, 11];
export const engineSupportsRoomUpgrade = (
  dllVersion: string | undefined,
): boolean => engineAtLeast(dllVersion, ENGINE_ROOM_SINCE);
/** The first released engine with Game mode and full processing delay parts. */
export const ENGINE_GAME_MODE_SINCE: readonly [number, number] = [1, 10];

export const engineSupportsGameMode = (
  dllVersion: string | undefined,
  reportedGameMode?: boolean,
): boolean =>
  // Development engines shipped this capability before their version changed.
  // Both true and false prove the field is supported; absent proves nothing.
  typeof reportedGameMode === 'boolean' ||
  engineAtLeast(dllVersion, ENGINE_GAME_MODE_SINCE);
