/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One output on which the engine is attached and Windows never creates it,
 * put right by the app: the slot ladder.
 *
 * Which of the five places an effect can be registered a given driver
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
 * Bounded twice over. Each move goes to the rung after the one the helper
 * reports the engine in, so it can only ever go down the ladder, never
 * round it; and every run passes through the one gate all automatic
 * elevated runs share (`automaticSetup.ts`), which lets the ladder take its
 * four steps in one session and nothing more. Silent: no card of its own —
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
 * effect are the three lists Windows 8.1 and later read; GFX and LFX are the
 * two single values everything before that read, and that some drivers
 * still do. The last two are only ever taken where nothing is registered —
 * the helper refuses them otherwise, and that refusal ends the ladder.
 */
export const SLOT_LADDER: readonly TEngineSlot[] = [
  'efx',
  'mfx',
  'sfx',
  'gfx',
  'lfx',
];

/** The rung after `current`, or undefined at the bottom. */
export const nextSlot = (current: TEngineSlot): TEngineSlot | undefined =>
  SLOT_LADDER[SLOT_LADDER.indexOf(current) + 1];

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
  const to = nextSlot(endpoint.slot);
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
