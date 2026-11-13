/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChatLimit,
  IStudioChatLimits,
  TStudioChatLimitWindow,
} from 'common/studioChat';

/** A window Opus is held to that is spent, and when it starts over. */
export interface ISpentWindow {
  window: TStudioChatLimitWindow;
  resetsAt: number;
}

/**
 * Whether Opus can answer where Fable's own limit stopped a reply (Ivan,
 * 2026-11-13: "ask to change to opus if there is still session room for
 * opus"). Opus is held to the plan's two windows, which every model shares,
 * and to a weekly window of its own where the plan still keeps one; Fable's
 * window is not one of them.
 *
 * - `room`: both of the plan's windows are known, current and short of
 *   full, and so is Opus's own if there is one. Only then is Opus offered.
 * - `full`: a window Opus is held to is spent; each, with its reset.
 * - `unknown`: the reading lacks a window, or a window's reset has passed
 *   and its figure is the old one's. Nothing is said of Opus: an offer that
 *   lands on the same wall is worse than none.
 */
export type TOpusRoom =
  | { state: 'room' }
  | { state: 'full'; spent: ISpentWindow[] }
  | { state: 'unknown' };

const OPUS_WINDOWS = ['fiveHour', 'week', 'opus'] as const;

export const opusRoomOf = (
  limits: IStudioChatLimits | undefined,
  now: number,
): TOpusRoom => {
  const current = (limit: IStudioChatLimit | undefined) =>
    limit && limit.resetsAt > now ? limit : undefined;
  const spent = OPUS_WINDOWS.flatMap((window): ISpentWindow[] => {
    const limit = current(limits?.[window]);
    return limit && limit.used >= 1
      ? [{ window, resetsAt: limit.resetsAt }]
      : [];
  });
  if (spent.length > 0) {
    return { state: 'full', spent };
  }
  return current(limits?.fiveHour) && current(limits?.week)
    ? { state: 'room' }
    : { state: 'unknown' };
};

/** When Fable answers again, where the reading says and it is still ahead. */
export const fableResetOf = (
  limits: IStudioChatLimits | undefined,
  now: number,
): number | undefined => {
  const fable = limits?.fable;
  return fable && fable.resetsAt > now ? fable.resetsAt : undefined;
};
