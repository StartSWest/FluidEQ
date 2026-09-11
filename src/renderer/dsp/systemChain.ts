/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack, on its way to the engine that runs it on everything.
 *
 * Under FluidEQ Engine the same flat array the Library player's host receives
 * is also written to `fluideq-dsp.txt`, which the effect inside audiodg.exe
 * reads and applies to every attached output. Under Equalizer APO nothing is
 * written and the rack stays Library-only; main answers `'not-fluid'` and
 * that is a supported configuration, not a failure.
 *
 * The store is its one caller: it sends on every settings change, which is
 * what makes the rack reach the engine with nothing playing, and whenever the
 * rack's place changes (`rackPlacement.ts`). The Library player's host used
 * to send here too, and that was half of the rack running twice on every
 * track the Library played. De-duplicating here means one edit is one IPC
 * message however often it is asked for.
 */

import { setSystemDspChain } from '../utils/audioEngineApi';
import { reportError } from '../utils/logger';

/**
 * The last array actually sent, joined.
 *
 * A string rather than the array, because this is compared far more often
 * than it is replaced — every settings emit, which during a drag is one per
 * pointer move — and comparing two joined strings is one memcmp against a
 * loop with a length check and 219 double comparisons.
 */
let lastSent: string | null = null;

/**
 * Let the next call send `key` again, unless something newer already has.
 *
 * A send that failed must not be remembered as delivered: the settings that
 * produced it can stay untouched for the rest of the session, and the rack
 * would then never reach the engine again.
 */
const forget = (key: string): void => {
  if (lastSent === key) {
    lastSent = null;
  }
};

/**
 * Send `values` to the engine unless they are the ones already there.
 *
 * Fire and forget on purpose: nothing on the audio path may wait for a file
 * to be written, and the answer is only ever interesting when it says the
 * window sent something malformed. `'not-fluid'` and `'not-installed'` are
 * states the DSP page already describes on screen, so they are not errors to
 * log on every slider release — but they are still, like a rejection or a
 * throw, an array that never reached disk. Only `'written'` means it did, so
 * every other answer forgets the key: a `'not-fluid'` machine that later
 * switches engines, or a momentary IPC hiccup, must not leave the rack
 * looking delivered when the engine never received it.
 */
export const sendSystemDspChain = (values: number[]): void => {
  const key = values.join(' ');
  if (key === lastSent) {
    return;
  }
  lastSent = key;
  try {
    setSystemDspChain(values).then(
      (result) => {
        if (result !== 'written') {
          forget(key);
          if (result === 'rejected') {
            // A payload main refused is a bug in the window rather than a
            // state a user can be in — the encoder and the validator
            // disagreeing about the wire is exactly the failure the log has
            // to show. `'not-fluid'` and `'not-installed'` are not logged:
            // the page already explains both on screen.
            reportError('the system-wide DSP chain was rejected', result);
          }
        }
        return result;
      },
      (error: unknown) => {
        forget(key);
        reportError('the system-wide DSP chain could not be sent', error);
      },
    );
  } catch (error) {
    // The send is fire-and-forget in both directions: it is called from the
    // store, which is called from every knob on the DSP page, and a knob that
    // throws because an IPC bridge is missing would take the sound with it.
    forget(key);
    reportError('the system-wide DSP chain could not be sent', error);
  }
};

/**
 * Forget what was last sent, so the next call sends whatever it is given.
 *
 * The engine is chosen at runtime and the file only exists under FluidEQ
 * Engine, so switching to it has to re-send a rack this module may already
 * consider delivered. Tests use it for the same reason: module state that
 * survives between cases is a test that passes because of the one before it.
 */
export const resetSystemDspChain = (): void => {
  lastSent = null;
};
