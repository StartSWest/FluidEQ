/* FluidEQ — GPL-3.0-or-later */
import { ErrorCode } from '../../../common/errors';
import { SOURCE_ANALYSIS_CHANNEL } from '../../../common/dsp/sourceAnalysis';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';
import { createSourceAnalysisBridge } from '../../utils/sourceAnalysisBridge';

type TSourceAnalysis = typeof import('../../../renderer/dsp/sourceAnalysis');
let source: TSourceAnalysis;

beforeEach(() => {
  jest.isolateModules(() => {
    source = jest.requireActual('../../../renderer/dsp/sourceAnalysis');
    const { updateRackGate } = jest.requireActual(
      '../../../renderer/dsp/rackPlacement',
    );
    updateRackGate({
      engine: 'fluid',
      eqEnabled: true,
      eqLoaded: true,
      engineOff: false,
      libraryAudible: false,
    });
  });
});

const installSourceBridge = (
  options: Parameters<typeof createSourceAnalysisBridge>[0] = {},
) => {
  const bridge = createSourceAnalysisBridge(options);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    writable: true,
    value: { ipcRenderer: bridge },
  });
  return bridge;
};

it('settles correlated native preparation and release replies and removes their subscriptions', async () => {
  const bridge = installSourceBridge({ capable: true, prepare: true });
  const setOwner = jest.fn();
  source.publishDspSourceAnalysis({ trackId: 'first-track' });
  await source.prepareDspSourceStart(setOwner);

  expect(bridge.requests.map(({ action }) => action)).toEqual([
    'publish',
    'capable',
    'prepare',
  ]);
  expect(new Set(bridge.requests.map(({ requestId }) => requestId)).size).toBe(
    3,
  );
  expect(setOwner.mock.calls).toEqual([[true]]);
  expect(source.nativeOwnsDspSource()).toBe(true);
  expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);

  await expect(source.releaseDspSourcePlayback()).resolves.toBe(true);
  expect(bridge.requests[3].action).toBe('release');
  expect(source.nativeOwnsDspSource()).toBe(false);
  expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);
});

it('settles fallback before selecting host processing on an engine without source readiness', async () => {
  const bridge = installSourceBridge();
  const setOwner = jest.fn();
  source.publishDspSourceAnalysis({ trackId: 'first-track' });
  const preparing = source.prepareDspSourceStart(setOwner);
  expect(setOwner).not.toHaveBeenCalled();
  await preparing;

  expect(bridge.requests.map(({ action }) => action)).toEqual([
    'publish',
    'capable',
    'fallback',
  ]);
  expect(bridge.requests[2].update).toMatchObject({
    trackId: 'first-track',
    libraryAudible: true,
  });
  expect(setOwner.mock.calls).toEqual([[false]]);
  expect(source.nativeOwnsDspSource()).toBe(false);
  expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);
});

it('rejects a refused fallback without authorizing host playback', async () => {
  const bridge = installSourceBridge({ fallback: false });
  const setOwner = jest.fn();
  source.publishDspSourceAnalysis({ trackId: 'first-track' });
  await expect(source.prepareDspSourceStart(setOwner)).rejects.toThrow(
    'could not be prepared',
  );

  expect(bridge.requests.some(({ action }) => action === 'fallback')).toBe(
    true,
  );
  expect(setOwner).not.toHaveBeenCalled();
  expect(source.nativeOwnsDspSource()).toBe(false);
  expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);
});

it('does not restore native ownership when an old preparation acknowledges after release', async () => {
  const bridge = installFakeIpcRenderer();
  const setOwner = jest.fn();
  source.publishDspSourceAnalysis({ trackId: 'first-track' });
  bridge.answer(bridge.sent[0], { result: true });
  const preparing = source.prepareDspSourceStart(setOwner);
  expect(bridge.sent[1].args[0]).toBe('capable');
  bridge.answer(bridge.sent[1], { result: true });
  await Promise.resolve();
  const oldPrepare = bridge.sent[2];
  expect(oldPrepare.args[0]).toBe('prepare');
  expect(setOwner.mock.calls).toEqual([[true]]);

  const releasing = source.releaseDspSourcePlayback();
  await Promise.resolve();
  expect(bridge.sent[3].args[0]).toBe('release');
  bridge.answer(bridge.sent[3], { result: true });
  await expect(releasing).resolves.toBe(true);
  expect(source.nativeOwnsDspSource()).toBe(false);

  bridge.answer(oldPrepare, { result: true });
  await preparing;
  expect(source.nativeOwnsDspSource()).toBe(false);
  expect(setOwner.mock.calls).toEqual([[true]]);
  expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);
});

it.each([
  {
    reason: 'refused preparation',
    prepareReply: { result: false },
    accepted: true,
  },
  {
    reason: 'refused preparation',
    prepareReply: { result: false },
    accepted: false,
  },
  {
    reason: 'preparation error',
    prepareReply: { errorCode: ErrorCode.FAILURE },
    accepted: true,
  },
  {
    reason: 'preparation error',
    prepareReply: { errorCode: ErrorCode.FAILURE },
    accepted: false,
  },
])(
  'ignores an old fallback after $reason (accepted=$accepted) once a new track owns DSP',
  async ({ prepareReply, accepted }) => {
    const bridge = installFakeIpcRenderer();
    const oldOwner = jest.fn();
    source.publishDspSourceAnalysis({ trackId: 'old-track' });
    bridge.answer(bridge.sent[0], { result: true });
    const oldPreparing = source.prepareDspSourceStart(oldOwner);
    bridge.answer(bridge.sent[1], { result: true });
    await Promise.resolve();
    expect(bridge.sent[2].args[0]).toBe('prepare');
    bridge.answer(bridge.sent[2], prepareReply);
    await Promise.resolve();
    const oldFallback = bridge.sent[3];
    expect(oldFallback.args).toEqual([
      'fallback',
      expect.objectContaining({ trackId: 'old-track' }),
    ]);

    const newOwner = jest.fn();
    source.publishDspSourceAnalysis({ trackId: 'new-track' });
    bridge.answer(bridge.sent[4], { result: true });
    const newPreparing = source.prepareDspSourceStart(newOwner);
    expect(bridge.sent[5].args[0]).toBe('capable');
    bridge.answer(bridge.sent[5], { result: true });
    await Promise.resolve();
    expect(bridge.sent[6].args).toEqual([
      'prepare',
      expect.objectContaining({ trackId: 'new-track' }),
    ]);
    bridge.answer(bridge.sent[6], { result: true });
    await newPreparing;
    expect(source.nativeOwnsDspSource()).toBe(true);

    bridge.answer(oldFallback, { result: accepted });
    await expect(oldPreparing).resolves.toBeUndefined();
    expect(source.nativeOwnsDspSource()).toBe(true);
    expect(oldOwner.mock.calls).toEqual([[true]]);
    expect(newOwner.mock.calls).toEqual([[true]]);
    expect(bridge.listenerCount(SOURCE_ANALYSIS_CHANNEL)).toBe(0);
  },
);
