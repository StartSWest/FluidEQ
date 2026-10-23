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
 * engine anywhere. Then the slot the engine is in: one with no processing
 * mode beside it is never reached, so it gets that mode where it is before
 * any rung below is spent (`modeMissing`).
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
import { normaliseEndpointGuid } from '../common/engineHealth';
import type { IAutomaticSetup } from './automaticSetup';
import { whatStopsTheEngineLoading } from './engineLoadRepair';

export type TEngineSlot = NonNullable<IFluidEngineEndpoint['slot']>;

/**
 * Newest to oldest: the endpoint effect, the mode effect and the stream
 * effect are the three lists Windows 8.1 and later read; the same three as
 * one class id each are the generation below them; GFX and LFX are the two
 * values everything before Windows 8.1 read, and that some drivers still do.
 * Everything below the lists is only ever taken where nothing is registered
 * or where Windows' own effect is — the helper refuses otherwise. It names
 * such rungs in its status (`slotsHeld`, from its own planner) and `nextSlot`
 * steps past them, so a held rung costs no Windows prompt; a refusal is left
 * only for an output that changed between that status and the attach, and it
 * still ends the ladder. Asking for a held rung used to end it every time: a
 * 2.0.0 report's output stopped at a vendor's SFX value with GFX — what
 * played on the same user's RME — never offered.
 *
 * The three `-single` rungs were missing until a Bluetooth headset found
 * them: Windows' own two effects sat in pids 5 and 6 with no list anywhere
 * on the endpoint, the ladder stepped from the lists straight past that
 * whole generation, and the engine came to rest in a value Windows never
 * reads there — attached on every reading, created by Windows not once.
 *
 * Every rung is offered whatever engine is installed. The helper that takes
 * the move is the one shipped beside this app (`getEngineSetupPath`), never
 * the installed copy, so it always knows every name here; the DLL it moves
 * is the same file in any slot. The three used to be held back until the
 * installed engine was 1.12 or newer, and that skipped exactly the rungs a
 * Bluetooth headset needs on a machine updated from 1.7.4: its engine was
 * still 1.9 when the first sound was heard, so the walk spent LFX — a rung
 * that output had been refused in — and ended there (issue 29).
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
 * The next rung nobody has tried on this output and nobody else holds, or
 * undefined once there is none left.
 *
 * `tried` is what the helper remembers for this output, oldest first.
 * Without it — a memory an older helper wrote, or an output whose slot was
 * never asked for by name — the history is taken from where the engine is
 * now. `held` is what the helper's planner would refuse there now.
 */
export const nextSlot = (
  current: TEngineSlot,
  tried: readonly TEngineSlot[] = [],
  held: readonly TEngineSlot[] = [],
): TEngineSlot | undefined => {
  // What the helper remembers is only what was asked for BY NAME, so the
  // rung every output starts in — chosen by the attach itself — is never in
  // it. Taking the record alone as the whole history therefore offered the
  // top of the ladder again to an output that had walked the whole way
  // down: the first move it recorded is the proof it was walked to, so the
  // rungs above that one are spent too.
  const history =
    tried.length > 0
      ? [...new Set([...historyBehind(tried[0]), ...tried])]
      : historyBehind(current);
  return SLOT_LADDER.find(
    (rung) =>
      rung !== current && !history.includes(rung) && !held.includes(rung),
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
  | { kind: 'mode'; slot: TEngineSlot }
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
  if (endpoint.modeMissing) {
    // Where it is, before anywhere else: the slot has no processing mode
    // beside it, so Windows never reaches it whatever the driver builds, and
    // an attach into the same slot writes the one it lacks. Every helper
    // before 2.0.1 left the single values that way — a Sound BlasterX G6
    // sat in its EFX value, never created, while the ladder below it was
    // all Creative's.
    return { kind: 'mode', slot: endpoint.slot };
  }
  const to = nextSlot(endpoint.slot, endpoint.slotsTried, endpoint.slotsHeld);
  if (!to) {
    const held = endpoint.slotsHeld ?? [];
    const heldNote =
      held.length > 0
        ? `; held by other programs' effects: ${held.join(', ')}`
        : '';
    return {
      kind: 'nothing',
      because: `every slot has been tried on this output (last: ${endpoint.slot})${heldNote}`,
    };
  }
  return { kind: 'move', from: endpoint.slot, to };
};

/** What a step does, as the log says it. */
const describeStep = (
  step: Exclude<TStep, { kind: 'nothing' }>,
  guid: string,
): string => {
  switch (step.kind) {
    case 'install':
      return `re-installing the engine: ${step.because}`;
    case 'mode':
      return (
        `giving the engine on ${guid} the processing mode its slot ` +
        `(${step.slot}) lacks`
      );
    default:
      return `moving the engine on ${guid} from ${step.from} to ${step.to}`;
  }
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
    const describe = describeStep(step, guid);
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
            step.kind === 'mode' ? step.slot : step.to,
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
