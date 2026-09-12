import fs from 'fs/promises';
import path from 'path';
import ChannelEnum from 'common/channels';
import { getDefaultState } from 'common/constants';
import { IAudioEngineStatus } from 'common/audioEngine';
import { ErrorCode } from 'common/errors';
import {
  CURVE_COMPARISON_FILENAME,
  EQ_PHASE_FILENAME,
  supportsCurveComparison,
} from 'common/curveComparison';
import {
  registerCurveComparisonIpc,
  ICurveComparisonDeps,
} from 'main/ipc/curveComparison';
import { scheduleWrite } from 'main/asyncWriter';

type Handler = (event: { reply: jest.Mock }, args?: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
}));
jest.mock('fs/promises', () => ({ readFile: jest.fn() }));
jest.mock('main/asyncWriter', () => ({ scheduleWrite: jest.fn() }));

const config = path.join('C:', 'fluid-config');
let status: IAudioEngineStatus;
let deps: ICurveComparisonDeps;
const fire = async (channel: ChannelEnum, args?: unknown) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing handler: ${channel}`);
  }
  const reply = jest.fn();
  await handler({ reply }, args);
  expect(reply).toHaveBeenCalledTimes(1);
  expect(reply.mock.calls[0][0]).toBe(channel);
  return reply.mock.calls[0][1];
};

beforeEach(() => {
  jest.resetAllMocks();
  status = {
    engine: 'fluid',
    apo: { installed: false },
    fluid: { installed: true, dllVersion: '1.6.0.0', endpoints: [] },
    fluidSupported: true,
    fluidUpdateReady: false,
  };
  deps = {
    state: getDefaultState(),
    getStatus: jest.fn(async () => status),
    getConfigPath: jest.fn(async () => config),
    getEngine: jest.fn(() => status.engine),
    isSwitching: jest.fn(() => false),
  };
  jest
    .mocked(fs.readFile)
    .mockRejectedValue(Object.assign(new Error('absent'), { code: 'ENOENT' }));
  jest.mocked(scheduleWrite).mockResolvedValue(undefined);
  registerCurveComparisonIpc(deps);
});

it('defaults both missing phase files to Minimum without a sampled curve requirement', async () => {
  const reply = await fire(ChannelEnum.GET_CURVE_COMPARISON);
  expect(reply.result).toMatchObject({
    variant: 'B',
    eqVariant: 'B',
    supported: true,
    eqSupported: true,
    active: true,
    hasSampledCurves: false,
  });
  expect(jest.mocked(fs.readFile).mock.calls.map(([file]) => file)).toEqual([
    path.join(config, CURVE_COMPARISON_FILENAME),
    path.join(config, EQ_PHASE_FILENAME),
  ]);
  expect(CURVE_COMPARISON_FILENAME).toBe('fluideq-curve-phase.txt');
  expect(EQ_PHASE_FILENAME).toBe('fluideq-eq-phase.txt');
});

it('preserves explicit Linear independently and ignores malformed saved values', async () => {
  jest
    .mocked(fs.readFile)
    .mockResolvedValueOnce(' A\r\n')
    .mockResolvedValueOnce('invalid');
  expect((await fire(ChannelEnum.GET_CURVE_COMPARISON)).result).toMatchObject({
    variant: 'A',
    eqVariant: 'B',
  });
});

it.each(['eq', 'curves'] as const)(
  'writes only %s and leaves all source filters untouched',
  async (scope) => {
    const before = JSON.stringify(deps.state);
    const reply = await fire(ChannelEnum.SET_CURVE_COMPARISON, ['A', scope]);
    expect(scheduleWrite).toHaveBeenCalledTimes(1);
    expect(scheduleWrite).toHaveBeenCalledWith(
      path.join(
        config,
        scope === 'eq' ? EQ_PHASE_FILENAME : CURVE_COMPARISON_FILENAME,
      ),
      'A\r\n',
    );
    expect(reply.result).toMatchObject({
      variant: scope === 'curves' ? 'A' : 'B',
      eqVariant: scope === 'eq' ? 'A' : 'B',
    });
    expect(JSON.stringify(deps.state)).toBe(before);
  },
);

it.each(['apo', 'missing', 'old', 'switching', 'unselected'])(
  'refuses %s engine writes',
  async (condition) => {
    if (condition === 'apo') {
      status.engine = 'apo';
    }
    if (condition === 'unselected') {
      status.engine = null;
    }
    if (condition === 'missing') {
      status.fluid.installed = false;
    }
    if (condition === 'old') {
      status.fluid.dllVersion = '1.5.0.0';
    }
    if (condition === 'switching') {
      jest.mocked(deps.isSwitching).mockReturnValue(true);
    }
    await fire(ChannelEnum.SET_CURVE_COMPARISON, ['A', 'eq']);
    await fire(ChannelEnum.SET_CURVE_COMPARISON, ['A', 'curves']);
    expect(scheduleWrite).not.toHaveBeenCalled();
    expect(fs.readFile).toHaveBeenCalledTimes(condition === 'old' ? 4 : 0);
  },
);

it('rechecks the engine after resolving the destination to avoid touching APO', async () => {
  jest.mocked(deps.getConfigPath).mockImplementation(async () => {
    if (jest.mocked(deps.getConfigPath).mock.calls.length === 3) {
      status.engine = 'apo';
    }
    return config;
  });
  expect(
    (await fire(ChannelEnum.SET_CURVE_COMPARISON, ['A', 'eq'])).result.active,
  ).toBe(false);
  expect(scheduleWrite).not.toHaveBeenCalled();
});

it.each([undefined, null, {}, [], ['C'], ['A', 'dsp'], ['B', 5]])(
  'rejects invalid phase payload %p',
  async (args) => {
    expect(await fire(ChannelEnum.SET_CURVE_COMPARISON, args)).toEqual({
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
    expect(scheduleWrite).not.toHaveBeenCalled();
  },
);

it('reports read and write failures rather than displaying false success', async () => {
  jest.mocked(fs.readFile).mockRejectedValueOnce(new Error('denied'));
  expect(await fire(ChannelEnum.GET_CURVE_COMPARISON)).toEqual({
    errorCode: ErrorCode.FAILURE,
  });
  jest.mocked(scheduleWrite).mockRejectedValueOnce(new Error('denied'));
  expect(await fire(ChannelEnum.SET_CURVE_COMPARISON, ['A', 'eq'])).toEqual({
    errorCode: ErrorCode.FAILURE,
  });
});

it('requires the first official phase engine but accepts future versions', () => {
  [undefined, '', 'invalid', '1.5.9.0'].forEach((version) =>
    expect(supportsCurveComparison(version)).toBe(false),
  );
  ['1.6.0.0', '1.7.0.0', '2.0.0.0'].forEach((version) =>
    expect(supportsCurveComparison(version)).toBe(true),
  );
});
