/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TPlusTrialFailure } from '../../common/plusTrial';
import {
  parseTrialExitStatus,
  type ITrialExitStatus,
  type TTrialExitReason,
} from '../../common/trialExit';
import type { IGalleryAuth } from './galleryAccess';
import { rpc } from './galleryApi';

/**
 * The question a member whose free trial ended without Plus is asked, and
 * their answer (premium migration 0054). Whether they are asked at all, and
 * whether they may answer, is the server's to say; nothing here decides it.
 */

export type TTrialExitOutcome =
  | { ok: true; status: ITrialExitStatus }
  | { ok: false; reason: TPlusTrialFailure };

export type TTrialExitReportOutcome =
  { ok: true } | { ok: false; reason: TPlusTrialFailure };

const failureOf = (status: number): TPlusTrialFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  // `not_asked` and a refused answer are invalid_parameter_value (400); a
  // server before 0054 has no such function (404). Either way there is
  // nothing for this member to answer.
  if (status === 400 || status === 404) {
    return 'unavailable';
  }
  return status === 403 ? 'forbidden' : 'server';
};

export const getTrialExit = async (
  auth: IGalleryAuth,
): Promise<TTrialExitOutcome> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_trial_exit', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const status = parseTrialExitStatus(await response.json());
    return status ? { ok: true, status } : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

export const reportTrialExit = async (
  auth: IGalleryAuth,
  answer: { reason: TTrialExitReason; note?: string },
): Promise<TTrialExitReportOutcome> => {
  let response: Response;
  try {
    response = await rpc(auth, 'report_trial_exit', {
      p_reason: answer.reason,
      p_note: answer.note ?? null,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  // A void function answers with no body; its status is the whole answer.
  return response.ok
    ? { ok: true }
    : { ok: false, reason: failureOf(response.status) };
};
