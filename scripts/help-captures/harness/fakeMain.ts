/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { REQUESTS, INVOKES } from './scenario';

/**
 * The main process, as far as the captures need one: each request the window
 * sends is answered from `scenario.ts`, the way main answers it — the reply on
 * the same channel, carrying the request's id. A channel the scenario does not
 * know is answered with nothing and noted in `window.fluidEqHarness.unanswered`,
 * which is how a new request the window makes shows up when the harness is
 * brought up to date.
 */

export type TEmit = (channel: string, ...args: unknown[]) => void;

interface IHarnessState {
  unanswered: Set<string>;
}

const harness = (): IHarnessState => {
  const holder = window as unknown as { fluidEqHarness?: IHarnessState };
  holder.fluidEqHarness ??= { unanswered: new Set() };
  return holder.fluidEqHarness;
};

export const answerSend = (channel: string, args: unknown[], emit: TEmit) => {
  const [payload, requestId] = args;
  const answer = REQUESTS[channel];
  if (!answer) {
    harness().unanswered.add(`send:${channel}`);
    if (typeof requestId === 'number') {
      // Main answers every request; one with nothing to say says so.
      queueMicrotask(() => emit(channel, { result: undefined }, requestId));
    }
    return;
  }
  const result = answer(Array.isArray(payload) ? payload : [], emit);
  if (typeof requestId === 'number') {
    Promise.resolve(result).then((value) =>
      emit(channel, { result: value }, requestId),
    );
  }
};

export const answerInvoke = async (
  channel: string,
  args: unknown[],
  emit: TEmit,
): Promise<unknown> => {
  const answer = INVOKES[channel];
  if (!answer) {
    harness().unanswered.add(`invoke:${channel}`);
    return undefined;
  }
  return answer(args, emit);
};
