/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { IGatheredFacts } from 'common/bugReport';
import {
  ErrorCode,
  ErrorDescription,
  getErrorDescription,
} from 'common/errors';
import {
  IAudioDevice,
  IConvolutionProfile,
  IDeviceProfileSettings,
  IFiltersMap,
  IOpraCurve,
  IOpraProduct,
  IOpraUpdateStatus,
  IState,
} from 'common/constants';
import { IConvolutionCatalogEntry } from 'common/convolution';
import { IApoConfigTree } from 'common/apoConfig';
import { IChainImport } from 'common/chainBundle';

/**
 * One request to the main process, and how it is allowed to fail.
 *
 * Two hundred and thirty lines that every one of the sixty-three calls in
 * equalizerApi.ts goes through: the channel is subscribed to, the message is
 * sent, and the reply either resolves or is turned into an error the UI can
 * show. None of it knows what any particular call means.
 *
 * Separated so the transport can be read on its own. The timeout in particular
 * is subtle — it survives the machine sleeping, because a laptop that wakes
 * after twenty minutes must not find every request already failed — and that
 * reasoning was buried under sixty wrappers that each say one thing.
 */
export const TIMEOUT = 10000;

/**
 * How much longer than the timeout the wall clock must have moved before the
 * wait is treated as suspended rather than slow.
 *
 * Twice over is comfortably outside anything scheduling jitter or a busy main
 * process produces, and comfortably inside the shortest sleep anybody takes.
 */
export const SLEEP_ELAPSED_FACTOR = 2;

export interface TSuccess<Type> {
  result: Type;
}

export interface TError {
  errorCode: ErrorCode;
  /**
   * A specific message replacing the code's generic one.
   *
   * Most failures are internal and the canned description is the honest
   * answer. Some are entirely about the user's own file — the wrong sample
   * rate, a truncated WAV — and for those "Internal Error" is both wrong and
   * useless, so the thrower gets to say what actually happened.
   */
  detail?: string;
  /**
   * What to do about it, replacing the code's generic advice.
   *
   * Needed for the same reason `detail` is, and it was the missing half.
   * Overriding only the description left "Internal Error" replaced by a real
   * sentence and "Please reach out to the developers to resolve the issue"
   * still sitting underneath it — so hitting the band limit, which is a rule
   * working exactly as intended, still ended by telling somebody to file a
   * report about it.
   */
  action?: string;
}

type TResult<Type> = TSuccess<Type> | TError;

export const toError = (
  description: ErrorDescription,
): Error & ErrorDescription =>
  Object.assign(new Error(description.shortError), description);

export const promisifyResult = <Type>(
  responseHandler: (
    arg: TResult<Type>,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => void,
  channel: string,
  timeout = TIMEOUT,
) => {
  return new Promise<Type>((resolve, reject) => {
    let timer: NodeJS.Timeout;

    const handler = (arg: unknown) => {
      responseHandler(arg as TResult<Type>, resolve, reject);
      clearTimeout(timer);
    };

    // The unsubscribe the bridge hands back, and it has to be this one.
    //
    // Cleanup used to go through a `removeListener` that took the handler and
    // rebuilt the wrapper around it — a different function every call, so it
    // matched nothing and removed nothing. Every request that timed out left
    // its listener registered for the life of the window, still first in the
    // queue, ready to swallow the reply to a later request on the same
    // channel and answer it with the wrong result.
    const unsubscribe = window.electron.ipcRenderer.once(channel, handler);

    /**
     * A timeout has to survive the machine going to sleep.
     *
     * `setTimeout` is a deadline in wall-clock time, and Chromium fires timers
     * whose deadline passed while the computer was suspended the moment it
     * wakes. So a request in flight when the lid closed used to reject the
     * instant you came back — "Timeout waiting for a response" for a main
     * process that was never asked to answer anything, because nothing ran at
     * all in between.
     *
     * The tell is the clock itself. Ten seconds of waiting cannot take an hour
     * of wall-clock time unless the wait was suspended, so an elapsed time far
     * beyond the timeout is evidence of sleep rather than of a slow reply. In
     * that case the request is given its full window again, once. A second
     * overrun is a real timeout: after a resume the process is awake, and a
     * reply that still has not arrived is genuinely missing.
     */
    let startedAt = Date.now();
    let allowedSleepRecovery = true;

    const arm = () => {
      timer = setTimeout(() => {
        const elapsed = Date.now() - startedAt;
        if (allowedSleepRecovery && elapsed > timeout * SLEEP_ELAPSED_FACTOR) {
          allowedSleepRecovery = false;
          startedAt = Date.now();
          arm();
          return;
        }
        unsubscribe();
        reject(toError(getErrorDescription(ErrorCode.TIMEOUT)));
      }, timeout);
    };

    arm();
  });
};

export const buildResponseHandler = <
  Type extends
    | string
    | number
    | boolean
    | void
    | IState
    | IFiltersMap
    | string[]
    | IAudioDevice[]
    | IDeviceProfileSettings
    | IOpraUpdateStatus
    | IOpraProduct[]
    | IOpraCurve[]
    | IConvolutionCatalogEntry[]
    | IConvolutionProfile
    | IGatheredFacts
    | IApoConfigTree
    | IChainImport,
>(
  resultEvaluator: (
    result: Type,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => void,
) => {
  return (
    arg: TResult<Type>,
    resolve: (value: Type | PromiseLike<Type>) => void,
    reject: (reason?: ErrorDescription) => void,
  ) => {
    if ('errorCode' in arg) {
      const description = getErrorDescription(arg.errorCode);
      reject(
        toError({
          ...description,
          ...(arg.detail ? { shortError: arg.detail } : {}),
          ...(arg.action ? { action: arg.action } : {}),
        }),
      );
      return;
    }
    const { result } = arg as TSuccess<Type>;
    resultEvaluator(result as Type, resolve, reject);
  };
};

export const simpleResponseHandler = <
  Type extends
    | string
    | number
    | boolean
    | void
    | IState
    | IFiltersMap
    | string[]
    | IAudioDevice[]
    | IDeviceProfileSettings
    | IOpraUpdateStatus
    | IOpraProduct[]
    | IOpraCurve[]
    | IConvolutionCatalogEntry[]
    | IConvolutionProfile
    | IGatheredFacts
    | IApoConfigTree
    | IChainImport,
>() =>
  buildResponseHandler<Type>((result, resolve) => {
    resolve(result);
  });

export const setterResponseHandler = buildResponseHandler<void>(
  (_result, resolve) => resolve(),
);
