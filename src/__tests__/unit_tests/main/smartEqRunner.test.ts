/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart EQ run by the core: the running mode runs exactly while it should,
 * follows the song and the tap, and writes one refinement at a time; the
 * one-shot measures, solves, writes once and says so — or says why not —
 * and gives the running mode back when it is over.
 *
 * The measurement and the solve are stood in for: what is under test is
 * what the runner does with what they answer.
 */
import type { ISmartEqSettings } from 'common/constants';
import type { TranslationKey } from 'common/i18n';
import {
  CONTINUOUS_HALF_LIFE_MS,
  type IBalanceReport,
  type IBalanceResult,
} from 'common/autoBalanceCapture';
import {
  createSmartEqMeasurement,
  type ISmartEqMeasurementOptions,
} from 'common/smartEqMeasurement';
import {
  isSameSmartEqLayer,
  planSmartEqRewrite,
  smartEqLayerOf,
  solveSmartEq,
} from 'common/smartEqSolve';
import {
  DEFAULT_SMART_EQ_SETTINGS,
  type ISmartEqCoreSettings,
  type ISmartEqRunState,
  type ISmartEqWrote,
} from 'common/smartEqCore';
import { createSmartEqRunner } from 'main/smartEq/smartEqRunner';
import type { TRawSourceKind } from 'main/smartEq/rawSourceFrames';

jest.mock('common/smartEqMeasurement', () => ({
  ...jest.requireActual('common/smartEqMeasurement'),
  createSmartEqMeasurement: jest.fn(),
}));
jest.mock('common/smartEqSolve', () => ({
  ...jest.requireActual('common/smartEqSolve'),
  planSmartEqRewrite: jest.fn(),
  solveSmartEq: jest.fn(),
  smartEqLayerOf: jest.fn(),
  isSameSmartEqLayer: jest.fn(),
}));

const LAYER: ISmartEqSettings = { filters: {}, status: 'ready' };
const RESULT = {
  status: 'ready',
  lowFrequency: 40,
  highFrequency: 16000,
} as unknown as IBalanceResult;
const REPORT = {} as IBalanceReport;

interface IMeasured {
  options: ISmartEqMeasurementOptions;
  setSilent: jest.Mock;
  restart: jest.Mock;
  end: jest.Mock;
}
interface ITap {
  kind: TRawSourceKind;
  isClosed: boolean;
  lose: (reason: TranslationKey) => void;
}

const flush = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- each turn lets one link of a promise chain run
    await Promise.resolve();
  }
};

const setUp = ({
  settings = { ...DEFAULT_SMART_EQ_SETTINGS, mode: 'detail', continuous: true },
  bypassed = false,
  writes = true,
  failOpen = false,
}: {
  settings?: ISmartEqCoreSettings;
  bypassed?: boolean;
  writes?: boolean;
  failOpen?: boolean;
} = {}) => {
  const measured: IMeasured[] = [];
  jest.mocked(createSmartEqMeasurement).mockImplementation((options) => {
    const entry = {
      options,
      setSilent: jest.fn(),
      restart: jest.fn(),
      end: jest.fn(),
    };
    measured.push(entry);
    return { hear: jest.fn(), ...entry };
  });
  const taps: ITap[] = [];
  const state: { settings: ISmartEqCoreSettings; bypassed: boolean } = {
    settings,
    bypassed,
  };
  const told = {
    states: [] as ISmartEqRunState[],
    remarks: [] as string[],
    wrote: [] as ISmartEqWrote[],
  };
  const write = jest.fn(() => Promise.resolve(writes));
  const onRefined = jest.fn();
  const runner = createSmartEqRunner({
    settings: () => state.settings,
    layer: () => undefined,
    isBypassed: () => state.bypassed,
    write,
    openSource: (kind, _onFrame, onLost) => {
      if (failOpen) {
        return Promise.reject(new Error('eq.smart.error.noSource'));
      }
      const tap: ITap = { kind, isClosed: false, lose: onLost };
      taps.push(tap);
      return Promise.resolve(() => {
        tap.isClosed = true;
      });
    },
    text: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
    now: () => 0,
    tellState: (runState) => told.states.push(runState),
    tellRemark: (remark) => told.remarks.push(remark),
    tellView: jest.fn(),
    tellWrote: (wrote) => told.wrote.push(wrote),
    onRefined,
  });
  return { runner, measured, taps, state, told, write, onRefined };
};

beforeEach(() => {
  jest.mocked(planSmartEqRewrite).mockReset();
  jest.mocked(solveSmartEq).mockReset();
  jest.mocked(smartEqLayerOf).mockReset();
  jest.mocked(isSameSmartEqLayer).mockReset();
});

describe('the running mode', () => {
  it('runs only while switched on, in a running mode, heard, and alone', async () => {
    const { runner, taps, state } = setUp({
      settings: { ...DEFAULT_SMART_EQ_SETTINGS, mode: 'detail' },
    });
    runner.follow();
    expect(taps).toHaveLength(0);
    state.settings = { ...state.settings, continuous: true, mode: 'smart' };
    runner.follow();
    expect(taps).toHaveLength(0);
    state.bypassed = true;
    state.settings = { ...state.settings, mode: 'balance' };
    runner.follow();
    expect(taps).toHaveLength(0);
    // POSITIVE CONTROL: all four true, and it listens.
    state.bypassed = false;
    runner.follow();
    expect(taps).toHaveLength(1);
    expect(runner.state().listeningFor).toBe('eq.smart.status.listening');
    // The chip switched off stops it, and the tap closes.
    state.bypassed = true;
    runner.follow();
    await flush();
    expect(taps[0].isClosed).toBe(true);
    expect(runner.state().listeningFor).toBe('');
  });

  it('starts again on a different tap, and not on a different mode', async () => {
    const { runner, taps, state } = setUp();
    runner.follow();
    state.settings = { ...state.settings, mode: 'target' };
    runner.follow();
    expect(taps).toHaveLength(1);
    runner.nowPlaying({ songKey: 'a', isPlaying: true, source: 'host' });
    await flush();
    expect(taps).toHaveLength(2);
    expect(taps[0].isClosed).toBe(true);
    expect(taps[1].kind).toBe('host');
  });

  it('measures one song at a time, and forgets slowly where no song is named', () => {
    const { runner, measured } = setUp();
    runner.follow();
    expect(measured[0].options.halfLifeMs).toBe(CONTINUOUS_HALF_LIFE_MS);
    runner.nowPlaying({ songKey: 'a', isPlaying: true, source: 'process' });
    expect(measured[0].restart).toHaveBeenLastCalledWith(undefined);
    expect(measured[0].setSilent).toHaveBeenLastCalledWith(false);
    runner.nowPlaying({ songKey: 'a', isPlaying: false, source: 'process' });
    expect(measured[0].restart).toHaveBeenCalledTimes(1);
    expect(measured[0].setSilent).toHaveBeenLastCalledWith(true);
    runner.nowPlaying({
      songKey: undefined,
      isPlaying: true,
      source: 'process',
    });
    expect(measured[0].restart).toHaveBeenLastCalledWith(
      CONTINUOUS_HALF_LIFE_MS,
    );
  });

  it('writes a settled answer once at a time, and tells the window after it lands', async () => {
    const { runner, measured, told, write, onRefined } = setUp();
    runner.follow();
    jest.mocked(planSmartEqRewrite).mockReturnValue({
      layer: LAYER,
      gains: {},
      moved: [],
    });
    measured[0].options.onReport?.(REPORT);
    measured[0].options.onReport?.(REPORT);
    expect(write).toHaveBeenCalledTimes(1);
    expect(onRefined).toHaveBeenCalledWith(LAYER);
    expect(told.wrote).toHaveLength(0);
    await flush();
    expect(told.wrote).toEqual([
      { kind: 'refined', layer: LAYER, from: undefined, moved: [] },
    ]);
    // The write is over: the next settled answer is written.
    measured[0].options.onReport?.(REPORT);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('writes nothing for an answer that is not due, and says nothing of a write that failed', async () => {
    const { runner, measured, told, write } = setUp({ writes: false });
    runner.follow();
    measured[0].options.onReport?.(REPORT);
    expect(write).not.toHaveBeenCalled();
    jest.mocked(planSmartEqRewrite).mockReturnValue({
      layer: LAYER,
      gains: {},
      moved: [],
    });
    measured[0].options.onReport?.(REPORT);
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(told.wrote).toHaveLength(0);
  });

  it('says so when the tap goes away, and stops', async () => {
    const { runner, taps, told } = setUp();
    runner.follow();
    await flush();
    taps[0].lose('eq.smart.error.noSource');
    expect(told.remarks).toContain('eq.smart.error.noSource');
    expect(taps[0].isClosed).toBe(true);
    expect(runner.state().listeningFor).toBe('');
  });
});

describe('the one-shot', () => {
  const runToResult = async (setup: ReturnType<typeof setUp>) => {
    setup.runner.run();
    const once = setup.measured[setup.measured.length - 1];
    once.options.onResult?.(RESULT);
    await flush();
  };

  it('stands the running mode down while it runs, and gives it back after', async () => {
    const setup = setUp();
    const { runner, taps, told } = setup;
    runner.follow();
    runner.run();
    await flush();
    expect(taps[0].isClosed).toBe(true);
    expect(taps).toHaveLength(2);
    expect(told.states).toContainEqual({ isRunning: true, listeningFor: '' });
    // A change of settings or song meanwhile does not bring it back early.
    runner.follow();
    runner.nowPlaying({ songKey: 'b', isPlaying: true, source: 'host' });
    await flush();
    expect(taps).toHaveLength(2);
    jest.mocked(solveSmartEq).mockReturnValue(undefined);
    setup.measured[1].options.onResult?.(RESULT);
    await flush();
    expect(runner.state().isRunning).toBe(false);
    expect(taps).toHaveLength(3);
    expect(taps[2].isClosed).toBe(false);
  });

  it('writes its answer once and tells the window to reveal it', async () => {
    const setup = setUp({ settings: DEFAULT_SMART_EQ_SETTINGS });
    jest.mocked(solveSmartEq).mockReturnValue({ a: 1 });
    jest.mocked(smartEqLayerOf).mockReturnValue(LAYER);
    jest.mocked(isSameSmartEqLayer).mockReturnValue(false);
    await runToResult(setup);
    expect(setup.write).toHaveBeenCalledWith(LAYER);
    expect(setup.told.wrote).toEqual([
      { kind: 'measured', layer: LAYER, from: undefined, moved: [] },
    ]);
    expect(setup.told.remarks).toContain('eq.smart.status.applying');
    expect(setup.runner.state().isRunning).toBe(false);
  });

  it('writes nothing where the answer is already applied or cannot be had', async () => {
    const setup = setUp({ settings: DEFAULT_SMART_EQ_SETTINGS });
    jest.mocked(solveSmartEq).mockReturnValue({ a: 1 });
    jest.mocked(smartEqLayerOf).mockReturnValue(LAYER);
    jest.mocked(isSameSmartEqLayer).mockReturnValue(true);
    await runToResult(setup);
    expect(setup.told.remarks).toContain('eq.smart.status.alreadyBalanced');
    jest.mocked(solveSmartEq).mockReturnValue(undefined);
    await runToResult(setup);
    expect(setup.told.remarks).toContain('eq.smart.status.notEnoughRange');
    expect(setup.write).not.toHaveBeenCalled();
    expect(setup.told.wrote).toHaveLength(0);
  });

  it('is cancelled by a second press, and says so', async () => {
    const setup = setUp({ settings: DEFAULT_SMART_EQ_SETTINGS });
    setup.runner.run();
    await flush();
    setup.runner.run();
    await flush();
    expect(setup.taps[0].isClosed).toBe(true);
    expect(setup.told.remarks).toContain('eq.smart.status.cancelled');
    expect(setup.runner.state().isRunning).toBe(false);
    expect(setup.write).not.toHaveBeenCalled();
  });

  it('says why when there is nothing to hear', async () => {
    const setup = setUp({
      settings: DEFAULT_SMART_EQ_SETTINGS,
      failOpen: true,
    });
    setup.runner.run();
    await flush();
    expect(setup.told.remarks).toContain('eq.smart.error.noSource');
    expect(setup.runner.state().isRunning).toBe(false);
  });

  it('says a measurement failed when something nobody planned for goes wrong', async () => {
    const setup = setUp({ settings: DEFAULT_SMART_EQ_SETTINGS });
    jest.mocked(solveSmartEq).mockImplementation(() => {
      throw new Error('boom');
    });
    await runToResult(setup);
    expect(setup.told.remarks).toContain('eq.smart.status.failed');
    expect(setup.runner.state().isRunning).toBe(false);
  });

  it('measures in silence as the transport says', () => {
    const setup = setUp({ settings: DEFAULT_SMART_EQ_SETTINGS });
    setup.runner.nowPlaying({
      songKey: undefined,
      isPlaying: false,
      source: 'process',
    });
    setup.runner.run();
    expect(setup.measured[0].setSilent).toHaveBeenLastCalledWith(true);
    setup.runner.nowPlaying({
      songKey: undefined,
      isPlaying: true,
      source: 'process',
    });
    expect(setup.measured[0].setSilent).toHaveBeenLastCalledWith(false);
  });
});

it('closes every tap when the app closes, and starts nothing after', async () => {
  const setup = setUp();
  setup.runner.follow();
  await flush();
  setup.runner.close();
  setup.runner.follow();
  await flush();
  expect(setup.taps).toHaveLength(1);
  expect(setup.taps[0].isClosed).toBe(true);
});
