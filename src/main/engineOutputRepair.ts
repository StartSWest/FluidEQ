/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One output on which the engine is attached and Windows never creates it,
 * put right by the app: the slot ladder.
 *
 * Which of the eight places an effect can be registered a given driver
 * actually builds is written down nowhere Windows will say. The endpoint
 * effect is where every attach goes first and where most drivers create it,
 * and a user's machine — an RME DAC, enhancements on, everything reporting
 * healthy — never once created it there. Equalizer APO's own installer
 * carries rules for the same thing: a mode effect where Windows has combined
 * a Bluetooth output with another, the pre-8.1 values where a driver
 * registered only those. There is no rule that covers every driver, so the
 * app finds out on the machine itself: the window hears sound go past an
 * attached engine that wrote nothing, asks here, and the engine is moved one
 * rung down — newest to oldest — and Windows audio restarted. The next sound
 * either finds it running, or comes back here for the next rung. The first
 * rung that is heard stays, remembered by the helper for that output.
 *
 * Before any of that, the machine-wide facts: a switch or a runtime that a
 * driver's installer undid is repaired by a re-install, which is what the
 * status read already does (`engineLoadRepair.ts`); this asks the same
 * question first so a move is never tried on a machine that cannot load the
 * engine anywhere.
 *
 * Bounded twice over. Each move goes to a rung this output has not been put
 * in before — the helper remembers every one it was asked for by name — so
 * the ladder can only ever spend rungs, never circle them; and every run
 * passes through the one gate all automatic elevated runs share
 * (`automaticSetup.ts`), which lets the ladder take its four steps in one
 * session and nothing more. Silent: no card of its own —
 * the trouble notice stays away while a rung is being tried, and says what
 * is left only once there is no rung left.
 */

import log from 'electron-log';
import type {
  IAudioEngineStatus,
  IAudioRestartOutcome,
  IFluidEngineEndpoint,
  TAudioEngine,
} from '../common/audioEngine';
import {
  engineTakesSingleSlots,
  normaliseEndpointGuid,
} from '../common/engineHealth';
import type { IAutomaticSetup } from './automaticSetup';
import { whatStopsTheEngineLoading } from './engineLoadRepair';

export type TEngineSlot = NonNullable<IFluidEngineEndpoint['slot']>;

/**
 * Newest to oldest: the endpoint effect, the mode effect and the stream
 * effect are the three lists Windows 8.1 and later read; the same three as
 * one class id each are the generation below them; GFX and LFX are the two
 * values everything before Windows 8.1 read, and that some drivers still do.
 * Everything below the lists is only ever taken where nothing is registered
 * or where Windows' own effect is — the helper refuses otherwise, and that
 * refusal ends the ladder.
 *
 * The three `-single` rungs were missing until a Bluetooth headset found
 * them: Windows' own two effects sat in pids 5 and 6 with no list anywhere
 * on the endpoint, the ladder stepped from the lists straight past that
 * whole generation, and the engine came to rest in a value Windows never
 * reads there — attached on every reading, created by Windows not once.
 */
export const SLOT_LADDER: readonly TEngineSlot[] = [
  'efx',
  'mfx',
  'sfx',
  'efx-single',
  'mfx-single',
  'sfx-single',
  'gfx',
  'lfx',
];

/** Which rungs an older helper has no name for, so cannot be asked to take. */
const SINGLE_RUNGS: readonly TEngineSlot[] = [
  'efx-single',
  'mfx-single',
  'sfx-single',
];

/** The ladder as it was before the single values were part of it. */
const LADDER_BEFORE_SINGLES: readonly TEngineSlot[] = [
  'efx',
  'mfx',
  'sfx',
  'gfx',
  'lfx',
];

/**
 * What an output with no recorded history must already have been through.
 *
 * The ladder has only ever walked downwards, so an engine resting in a rung
 * was offered every rung above it and heard in none of them. That is the
 * whole history for an output whose memory an older helper wrote, and it is
 * what makes adding rungs to the middle of the ladder safe: the three that
 * did not exist then are not in it, so they are what comes next rather than
 * a walk from the top all over again.
 */
const historyBehind = (current: TEngineSlot): readonly TEngineSlot[] => {
  // A rung that existed before the singles did: the walk that reached it can
  // only have been the old ladder's, so the singles are untried.
  const before = LADDER_BEFORE_SINGLES.indexOf(current);
  if (before >= 0) {
    return LADDER_BEFORE_SINGLES.slice(0, before + 1);
  }
  const at = SLOT_LADDER.indexOf(current);
  return at < 0 ? [current] : SLOT_LADDER.slice(0, at + 1);
};

/**
 * The next rung nobody has tried on this output, or undefined once there is
 * none left.
 *
 * `takesSingles` is the installed helper's answer, not this tree's: asking
 * an older one for a slot name it does not know refuses the whole command,
 * which costs an administrator prompt and mends nothing. Skipped rather than
 * stopped at, so such a machine still reaches the oldest rungs it does know.
 *
 * `tried` is what the helper remembers for this output, oldest first.
 * Without it — an older helper, or an output whose slot was never asked for
 * by name — the history is taken from where the engine is now.
 */
export const nextSlot = (
  current: TEngineSlot,
  takesSingles = true,
  tried: readonly TEngineSlot[] = [],
): TEngineSlot | undefined => {
  const history = tried.length > 0 ? tried : historyBehind(current);
  return SLOT_LADDER.find(
    (rung) =>
      rung !== current &&
      !history.includes(rung) &&
      (takesSingles || !SINGLE_RUNGS.includes(rung)),
  );
};

export interface IEngineOutputRepairDeps {
  getEngine: () => TAudioEngine | null;
  readStatus: () => Promise<IAudioEngineStatus>;
  runEngineSetup: (
    command: 'install' | 'attach',
    args: string[],
  ) => Promise<{ ok: boolean; declined: boolean; error?: string }>;
  automatic: IAutomaticSetup;
}

export interface IEngineOutputRepair {
  /**
   * Sound has gone past the engine on `guid` and the engine wrote nothing.
   * Does one thing about it and says how it went; `ok` means the machine
   * changed and the next sound will tell. `detail` carries why nothing was
   * done, in words the log and the notice can use.
   */
  repair: (guid: string) => Promise<IAudioRestartOutcome>;
}

type TStep =
  | { kind: 'install'; because: string }
  | { kind: 'move'; from: TEngineSlot; to: TEngineSlot }
  | { kind: 'nothing'; because: string };

/**
 * What to do for this output, from a status just read — exported for the
 * test, and because the sentence is what goes in the log.
 */
export const whatToTry = (status: IAudioEngineStatus, guid: string): TStep => {
  const wrong = whatStopsTheEngineLoading(status);
  if (wrong) {
    return { kind: 'install', because: wrong };
  }
  const endpoint = status.fluid.endpoints.find(
    (candidate) =>
      normaliseEndpointGuid(candidate.guid) === normaliseEndpointGuid(guid),
  );
  if (!endpoint?.attached) {
    return { kind: 'nothing', because: 'the engine is not on this output' };
  }
  if (!endpoint.slot) {
    // An older helper: it cannot say where the engine is, so nothing can be
    // moved from anywhere.
    return {
      kind: 'nothing',
      because: 'the setup helper does not report which slot the engine is in',
    };
  }
  const to = nextSlot(
    endpoint.slot,
    engineTakesSingleSlots(status.fluid.dllVersion),
    endpoint.slotsTried,
  );
  if (!to) {
    return {
      kind: 'nothing',
      because: `every slot has been tried on this output (last: ${endpoint.slot})`,
    };
  }
  return { kind: 'move', from: endpoint.slot, to };
};

export const createEngineOutputRepair = ({
  getEngine,
  readStatus,
  runEngineSetup,
  automatic,
}: IEngineOutputRepairDeps): IEngineOutputRepair => ({
  repair: async (guid) => {
    if (process.platform !== 'win32' || getEngine() !== 'fluid') {
      return { ok: false, declined: false, detail: 'not under the engine' };
    }
    const status = await readStatus();
    if (!status.fluid.installed) {
      return {
        ok: false,
        declined: false,
        detail: 'the engine is not installed',
      };
    }
    const step = whatToTry(status, guid);
    if (step.kind === 'nothing') {
      log.info(
        `Nothing left to try for the engine on ${guid}: ${step.because}`,
      );
      return { ok: false, declined: false, detail: step.because };
    }
    const kind = step.kind === 'install' ? 'install' : 'move-slot';
    const describe =
      step.kind === 'install'
        ? `re-installing the engine: ${step.because}`
        : `moving the engine on ${guid} from ${step.from} to ${step.to}`;
    log.info(
      `Sound went past the engine on ${guid} and it wrote nothing; ${describe}`,
    );
    const result = await automatic.attempt(kind, () =>
      step.kind === 'install'
        ? // Never `--attach-all`: which outputs the engine is on stays the
          // user's choice; this is repairing the machine.
          runEngineSetup('install', ['--restart-audio'])
        : runEngineSetup('attach', [
            guid,
            '--slot',
            step.to,
            '--restart-audio',
          ]),
    );
    if (!result) {
      return {
        ok: false,
        declined: false,
        detail: 'an automatic repair already ran this session',
      };
    }
    log.info(
      `Repair of the engine on ${guid} (${describe}): ok=${result.ok}` +
        `${result.declined ? ' (consent declined)' : ''}` +
        `${result.error ? ` error=${result.error}` : ''}`,
    );
    return {
      ok: result.ok,
      declined: result.declined,
      ...(!result.ok && !result.declined && result.error
        ? { detail: result.error }
        : {}),
    };
  },
});

export default createEngineOutputRepair;
