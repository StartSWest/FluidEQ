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
import isRequestId from 'common/ipcRequestId';
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
import type { ISongEqEntry } from 'common/songEq';
import type { IOutputFormat, IOutputFormatChange } from 'main/outputFormat';
import type { ICurveComparisonStatus } from 'common/curveComparison';
import type { ITrebleDesigns } from 'common/filterDesign';
import type { IBandDesign } from 'common/bandDesigns';
import type {
  IAudioEngineStatus,
  IAudioRestartOutcome,
} from 'common/audioEngine';
// Type only, so the renderer bundle never pulls `child_process` in behind the
// engine setup helper's module.
import type { IEngineSetupResult } from 'main/engineSetup';

/**
 * One request to the main process, and how it is allowed to fail.
 *
 * What every request the window makes of main goes through: the message is
 * sent with a request id, the reply carrying that id is waited for, and it
 * either resolves or is turned into an error the UI can show. None of it
 * knows what any particular call means.
 *
 * NO DEADLINE. Main answers every request it is sent — a reply, or an error
 * the UI can show (`onWindowMessage`) — so the answer is what is waited for,
 * however long it takes. Each request used to give up after ten seconds,
 * which is a guess at how long another machine takes to enumerate its
 * devices, read a disk or restart its audio: a slow machine was told the
 * request failed while main was still doing it, and the answer that followed
 * was thrown away. The guess needed a second one to survive the machine
 * sleeping (a deadline that passed during a suspend fired on waking), and the
 * slow calls each carried a longer guess of their own; all of that went with
 * it.
 */

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

type TResponseHandler<Type> = (
  arg: TResult<Type>,
  resolve: (value: Type | PromiseLike<Type>) => void,
  reject: (reason?: ErrorDescription) => void,
) => void;

interface IReplyChannel {
  /** What to do with the reply to each request still waiting, by its id. */
  waiting: Map<number, (payload: unknown) => void>;
  stopListening: () => void;
}

/**
 * One listener per reply channel, serving every request waiting on it.
 *
 * Replies used to be matched to requests by channel alone, each request with a
 * one-shot listener of its own. Every listener on a channel hears every reply,
 * so the first reply answered them all: two overlapping writes were both told
 * whichever outcome main finished first, and a request that had timed out left
 * its late reply to be taken by the next request on the channel. Main now
 * hands back the id each request was sent with (`onWindowMessage`), and only
 * the request holding that id hears the reply. One listener rather than one per
 * request, too, because eleven waiting at once is Node's leak warning.
 */
const replyChannels = new Map<string, IReplyChannel>();

const stopWaiting = (replyChannel: string, requestId: number) => {
  const served = replyChannels.get(replyChannel);
  if (!served?.waiting.delete(requestId) || served.waiting.size > 0) {
    return;
  }
  replyChannels.delete(replyChannel);
  served.stopListening();
};

const waitForReply = (
  replyChannel: string,
  requestId: number,
  onReply: (payload: unknown) => void,
) => {
  const served = replyChannels.get(replyChannel);
  if (served) {
    served.waiting.set(requestId, onReply);
    return;
  }
  const waiting = new Map([[requestId, onReply]]);
  const stopListening = window.electron.ipcRenderer.on(
    replyChannel,
    (payload: unknown, repliedTo: unknown) => {
      // A reply naming no request still waiting is one sent to nobody in
      // particular, or one a copy of this module left behind by a hot reload
      // is waiting for; neither is this copy's answer.
      if (!isRequestId(repliedTo)) {
        return;
      }
      const answer = waiting.get(repliedTo);
      if (!answer) {
        return;
      }
      stopWaiting(replyChannel, repliedTo);
      answer(payload);
    },
  );
  replyChannels.set(replyChannel, { waiting, stopListening });
};

/**
 * Starts at a random point so that two copies of this module — a hot reload
 * in development leaves the old one serving whatever still holds it — never
 * hand out the same id for requests waiting on the same channel.
 */
let lastRequestId = Math.floor(Math.random() * 2 ** 32);

export interface IRequestOptions {
  /**
   * Where main answers, when that is not the channel the request was sent on:
   * a band's writes are answered on a channel named after the band.
   */
  replyChannel?: string;
}

/**
 * Send a request to main and settle with the reply to that request.
 *
 * Sent before anything listens, on purpose: no reply can arrive within this
 * call, and a bridge that refuses to send throws right here, synchronously, as
 * it always has — with nothing left subscribed behind it.
 */
export const sendRequest = <Type>(
  channel: string,
  args: unknown[],
  responseHandler: TResponseHandler<Type>,
  { replyChannel = channel }: IRequestOptions = {},
): Promise<Type> => {
  lastRequestId += 1;
  const requestId = lastRequestId;
  window.electron.ipcRenderer.sendMessage(channel, args, requestId);

  return new Promise<Type>((resolve, reject) => {
    waitForReply(replyChannel, requestId, (payload) => {
      responseHandler(payload as TResult<Type>, resolve, reject);
    });
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
    | IOutputFormat
    | IOutputFormatChange
    | IConvolutionProfile
    | IGatheredFacts
    | IApoConfigTree
    | IChainImport
    | ISongEqEntry
    | IAudioEngineStatus
    | ICurveComparisonStatus
    | ITrebleDesigns
    | IBandDesign
    | IBandDesign[]
    | IAudioRestartOutcome
    | IEngineSetupResult,
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
    | IOutputFormat
    | IOutputFormatChange
    | IConvolutionProfile
    | IGatheredFacts
    | IApoConfigTree
    | IChainImport
    | ISongEqEntry
    | IAudioEngineStatus
    | ICurveComparisonStatus
    | IAudioRestartOutcome
    | IEngineSetupResult,
>() =>
  buildResponseHandler<Type>((result, resolve) => {
    resolve(result);
  });

export const setterResponseHandler = buildResponseHandler<void>(
  (_result, resolve) => resolve(),
);
