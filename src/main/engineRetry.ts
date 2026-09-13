/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Trying an engine step again before telling anybody it failed.
 *
 * Switching engines fails most often because Windows is in the middle of
 * something — its audio service still coming back from the restart the
 * install just asked for, the engine's status unreadable for the same few
 * seconds — and the same step moments later works. Reporting the first
 * failure put an error in the dialog for a switch that would have gone
 * through on its own.
 *
 * So a step is tried up to three times, and only the last failure is the
 * answer. What waits between tries is Windows, never a clock: the setup
 * helper's `settle` returns once the audio services have finished starting or
 * stopping, as the service control manager itself reports. The setup helper's
 * own elevated commands retry the same way inside their one run
 * (`native/system-apo/setup/retry.h`), so a retry never raises the Windows
 * permission prompt a second time.
 */

import log from 'electron-log';
import type { TError } from '../renderer/utils/equalizerApi';

/** How many times an engine step runs before its failure is the answer. */
export const ENGINE_STEP_TRIES = 3;

export type TEngineStepOutcome = { ok: true } | { ok: false; error: TError };

export interface IEngineRetryDeps {
  /** Waits for Windows audio to settle; false when it could not be waited for. */
  settle: () => Promise<boolean>;
  /**
   * Asked after the wait: whether another try could change anything. An
   * engine that is still not installed once Windows has settled will not be
   * installed by trying again, and saying so at once is the honest answer.
   */
  worthAnotherTry: () => Promise<boolean>;
  /**
   * A failure no amount of waiting changes, answered at once — without it,
   * switching to an Equalizer APO that is not installed yet sat through two
   * waits before its own installer could start.
   */
  isFinal: (error: TError) => boolean;
  /** What the step is, for the log line each failed try writes. */
  step: string;
}

export const retryEngineStep = (
  attempt: () => Promise<TEngineStepOutcome>,
  { settle, worthAnotherTry, isFinal, step }: IEngineRetryDeps,
): Promise<TEngineStepOutcome> => {
  const tryFrom = async (made: number): Promise<TEngineStepOutcome> => {
    const outcome = await attempt();
    if (outcome.ok || made >= ENGINE_STEP_TRIES || isFinal(outcome.error)) {
      return outcome;
    }
    // A warning and not an error: nothing has failed yet as far as anybody
    // looking at the window is concerned.
    log.warn(
      `${step} failed on try ${made} of ${ENGINE_STEP_TRIES}; waiting for Windows audio to settle before the next`,
      outcome.error,
    );
    if (!(await settle())) {
      log.error(
        `${step}: Windows audio could not be waited for; not tried again`,
      );
      return outcome;
    }
    if (!(await worthAnotherTry())) {
      return outcome;
    }
    return tryFrom(made + 1);
  };
  return tryFrom(1);
};
