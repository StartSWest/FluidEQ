/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ask main to put the engine right on an output, silently, each time sound
 * has gone past an engine Windows never created there — once per slot.
 *
 * Why here and not in main, where the rest of the engine's repairs live: main
 * reads the setup helper's answer and nothing else, and from that answer a
 * machine where Windows has never created the engine looks exactly like one
 * where setup finished a minute ago and nothing has played yet. Repairing on
 * that read alone would put a Windows permission prompt in front of somebody
 * seconds after installing, before they had heard anything at all.
 *
 * The window knows the difference. This trouble is only reached once the live
 * capture has heard sound on an output the engine is on and the engine has
 * still written nothing — which is the evidence, and is the state a user's
 * machine sat in with everything reporting healthy.
 *
 * What main does with it is the slot ladder (`engineOutputRepair.ts`): the
 * install put back where a machine-wide switch was undone, otherwise the
 * engine moved one slot down the list of places Windows can build it, newest
 * to oldest, and Windows audio restarted. Each move changes the slot the
 * helper reports for the output, and that is what "once" is keyed by: the
 * next sound past an engine that still wrote nothing is a new slot and a
 * new ask, until main answers that there is nothing left — and only then
 * does the notice say so. A crash-recovery reload keeps the memory, in
 * `sessionStorage`; a fresh launch starts over, which is right, because the
 * gate in main starts over with it.
 *
 * `isTryingSlots` is the notice's silence: true from the moment the trouble
 * appears until an ask for the current slot has come back with nothing
 * done, or a change came back and the same slot was heard failing again.
 */

import { useEffect, useRef, useState } from 'react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import type { TEngineTrouble } from '../audio/engineTrouble';
import { reportError, reportInfo } from './logger';

const MEMORY_KEY = 'fluideq.engineNeverRanRepairs';

/**
 * `running`: asked, no answer yet. `skipped`: could not be started (the
 * maintenance lock was held) — asked again once the trouble has gone and
 * come back. `changed`: main did something; `armed` once the trouble has
 * gone away since, so that its coming back in the same slot is the next
 * sound's verdict. `settled`: nothing more will be asked for this slot, and
 * the notice may say what is left.
 */
type TAskState = 'running' | 'skipped' | 'changed' | 'armed' | 'settled';
type TMemory = Readonly<Record<string, TAskState>>;

const ASK_STATES: readonly TAskState[] = [
  'running',
  'skipped',
  'changed',
  'armed',
  'settled',
];

const isAskState = (value: unknown): value is TAskState =>
  ASK_STATES.some((state) => state === value);

const readMemory = (): TMemory => {
  try {
    const raw = window.sessionStorage.getItem(MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(([, state]) => isAskState(state)),
    ) as TMemory;
  } catch {
    // Storage refused or garbled: the in-memory copy still holds for as
    // long as the window lives.
    return {};
  }
};

const writeMemory = (memory: TMemory): void => {
  try {
    window.sessionStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // See above.
  }
};

export interface IRepairWhenEngineNeverRan {
  /** The notice stays away while this is true. */
  isTryingSlots: boolean;
}

const useRepairWhenEngineNeverRan = (
  trouble: TEngineTrouble | undefined,
  isSuppressed: boolean,
  /** Resolves undefined when it could not even be started (the lock was held). */
  repair: (guid: string) => Promise<IAudioRestartOutcome | undefined>,
  /** Where the helper says the engine sits on the troubled output. */
  slot: string | undefined,
): IRepairWhenEngineNeverRan => {
  const [memory, setMemory] = useState<TMemory>(readMemory);
  const neverRan = trouble?.kind === 'off' && trouble.neverRan === true;
  const guid = neverRan ? trouble.device.guid : undefined;
  const key = guid === undefined ? undefined : `${guid}:${slot ?? '?'}`;
  // The latest callback, read when it is time; the prop is rebuilt on every
  // render.
  const run = useRef(repair);
  run.current = repair;

  const remember = (at: string, state: TAskState) => {
    setMemory((current) => {
      const next = { ...current, [at]: state };
      writeMemory(next);
      return next;
    });
  };

  const state = key === undefined ? undefined : memory[key];

  // The trouble gone — the capture rebuilt after the restart, or the page
  // left — is what arms a change to be judged, and what lets a skipped ask
  // be made again.
  useEffect(() => {
    if (key !== undefined) {
      return;
    }
    setMemory((current) => {
      const entries = Object.entries(current);
      if (!entries.some(([, at]) => at === 'changed' || at === 'skipped')) {
        return current;
      }
      const next = Object.fromEntries(
        entries
          .filter(([, at]) => at !== 'skipped')
          .map(([slotKey, at]) => [slotKey, at === 'changed' ? 'armed' : at]),
      ) as TMemory;
      writeMemory(next);
      return next;
    });
  }, [key]);

  useEffect(() => {
    if (key === undefined || guid === undefined || isSuppressed) {
      return;
    }
    if (state === 'armed') {
      // Main changed the machine for this slot, the trouble went away with
      // the restart, and the sound was heard going past a silent engine in
      // the same slot again: that change did not help, and nothing more is
      // asked for it.
      remember(key, 'settled');
      return;
    }
    if (state !== undefined) {
      return;
    }
    remember(key, 'running');
    reportInfo(
      `Repairing the engine on ${guid}: sound played on it and Windows ` +
        `never created the engine there (slot ${slot ?? 'unknown'})`,
    );
    const ask = async () => {
      const outcome = await run.current(guid);
      if (outcome === undefined) {
        remember(key, 'skipped');
        return;
      }
      remember(key, outcome.ok ? 'changed' : 'settled');
      if (!outcome.ok) {
        reportInfo(
          `Nothing more will be tried for the engine on ${guid}: ${
            outcome.declined
              ? 'consent declined'
              : (outcome.detail ?? 'the repair failed')
          }`,
        );
      }
    };
    ask().catch((error) => {
      remember(key, 'settled');
      reportError('The engine could not be repaired', error);
    });
    // `remember` and `slot` only matter through `key` and `state`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, guid, state, isSuppressed]);

  return { isTryingSlots: neverRan && state !== 'settled' };
};

export default useRepairWhenEngineNeverRan;
