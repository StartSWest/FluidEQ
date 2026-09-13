/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An engine step tried up to three times, Windows waited for between tries,
 * and only the last failure answered.
 */

import { ErrorCode } from '../../../common/errors';
import {
  ENGINE_STEP_TRIES,
  IEngineRetryDeps,
  TEngineStepOutcome,
  retryEngineStep,
} from '../../../main/engineRetry';

jest.mock('electron-log', () => ({ warn: jest.fn(), error: jest.fn() }));

const failed = (errorCode: ErrorCode, detail?: string): TEngineStepOutcome => ({
  ok: false,
  error: { errorCode, ...(detail ? { detail } : {}) },
});

describe('retryEngineStep', () => {
  let calls: string[];
  let deps: IEngineRetryDeps;

  beforeEach(() => {
    calls = [];
    deps = {
      step: 'Switching',
      settle: async () => {
        calls.push('settle');
        return true;
      },
      worthAnotherTry: async () => {
        calls.push('check');
        return true;
      },
      isFinal: () => false,
    };
  });

  const stepThat = (outcomes: TEngineStepOutcome[]) => async () => {
    calls.push('try');
    return outcomes.shift() ?? { ok: true as const };
  };

  it('runs a step that works once, and waits for nothing', async () => {
    await expect(
      retryEngineStep(stepThat([{ ok: true }]), deps),
    ).resolves.toEqual({
      ok: true,
    });
    expect(calls).toEqual(['try']);
  });

  it('waits for Windows, then tries again, and answers the try that worked', async () => {
    const outcome = await retryEngineStep(
      stepThat([failed(ErrorCode.FAILURE), { ok: true }]),
      deps,
    );
    expect(outcome).toEqual({ ok: true });
    expect(calls).toEqual(['try', 'settle', 'check', 'try']);
  });

  it('answers only the last failure, after three tries', async () => {
    expect(ENGINE_STEP_TRIES).toBe(3);
    const outcome = await retryEngineStep(
      stepThat([
        failed(ErrorCode.FAILURE, 'first'),
        failed(ErrorCode.FAILURE, 'second'),
        failed(ErrorCode.FLUID_ENGINE_NOT_INSTALLED, 'third'),
      ]),
      deps,
    );
    expect(outcome).toEqual(
      failed(ErrorCode.FLUID_ENGINE_NOT_INSTALLED, 'third'),
    );
    expect(calls).toEqual([
      'try',
      'settle',
      'check',
      'try',
      'settle',
      'check',
      'try',
    ]);
  });

  it('stops when Windows audio cannot be waited for', async () => {
    deps.settle = async () => {
      calls.push('settle');
      return false;
    };
    const outcome = await retryEngineStep(
      stepThat([failed(ErrorCode.FAILURE, 'first'), { ok: true }]),
      deps,
    );
    expect(outcome).toEqual(failed(ErrorCode.FAILURE, 'first'));
    expect(calls).toEqual(['try', 'settle']);
  });

  it('stops when another try could not change anything', async () => {
    deps.worthAnotherTry = async () => {
      calls.push('check');
      return false;
    };
    const outcome = await retryEngineStep(
      stepThat([failed(ErrorCode.FLUID_ENGINE_NOT_INSTALLED), { ok: true }]),
      deps,
    );
    expect(outcome.ok).toBe(false);
    expect(calls).toEqual(['try', 'settle', 'check']);
  });

  it('answers a final failure at once, without waiting', async () => {
    deps.isFinal = ({ errorCode }) =>
      errorCode === ErrorCode.EQUALIZER_APO_NOT_INSTALLED;
    const outcome = await retryEngineStep(
      stepThat([failed(ErrorCode.EQUALIZER_APO_NOT_INSTALLED), { ok: true }]),
      deps,
    );
    expect(outcome.ok).toBe(false);
    expect(calls).toEqual(['try']);
  });
});
