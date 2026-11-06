/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import type { ISourceAnalysisUpdate } from '../../../common/dsp/sourceAnalysis';
import type { IEngineHealth } from '../../../common/engineHealth';
import {
  createSourceAnalysisPublisher,
  formatSourceAnalysis,
} from '../../../main/sourceAnalysis';
import { copySourceAnalysisUpdate } from '../../../common/dsp/sourceAnalysis';

// No voice model downloaded: the publication says voice is unavailable.
jest.mock('../../../main/denoiseModel', () => ({
  denoiseModelPath: () => 'C:/test-data/denoise-models/voice.onnx',
  isPinnedDenoiseModel: () => false,
  readPinnedDenoiseModel: async () => undefined,
}));

const deferred = () => {
  let complete: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const source = (
  epoch = 1,
  trackId = 'song',
  level = -10,
): ISourceAnalysisUpdate => ({
  version: 1,
  epoch,
  trackId,
  libraryAudible: true,
  analysis: { version: 2, integratedLufs: level, truePeakDbtp: -1 },
});

it('publishes foreground facts without changing the integrated Master measurement', async () => {
  const t = setup();
  const update = source();
  update.analysis = {
    version: 3,
    integratedLufs: -20,
    maxShortTermLufs: -16,
    truePeakDbtp: -3,
  };
  await t.publisher.prepare(update);
  expect(t.text()).toContain('version=2');
  expect(t.text()).toContain('level=-20');
  expect(t.text()).toContain('reference=-16');
  expect(
    copySourceAnalysisUpdate({
      ...update,
      analysis: {
        ...update.analysis,
        maxShortTermLufs: Number.NaN,
      },
    }),
  ).toBeUndefined();
  await t.publisher.publish(source());
  expect(t.text()).toContain('version=1');
  expect(t.text()).not.toContain('reference=');
});
it('keeps host fallback and Live release readable by an older engine', () => {
  const update = source();
  update.analysis = {
    version: 3,
    integratedLufs: -20,
    maxShortTermLufs: -16,
    truePeakDbtp: -3,
  };
  const publication = {
    endpoint: '{AAAAAAAA-1111-2222-3333-444455556666}',
    epoch: 1,
    revision: 2,
    library: true,
    owner: 'host' as const,
    updateKey: '',
  };
  const host = formatSourceAnalysis(update, publication, undefined);
  expect(host).toContain('version=1');
  expect(host).toContain('owner=host');
  expect(host).not.toContain('reference=');
  const released = formatSourceAnalysis(
    update,
    { ...publication, library: false, owner: 'engine' },
    undefined,
  );
  expect(released).toContain('version=1');
  expect(released).toContain('kind=live');
  expect(released).not.toContain('reference=');
});
const setup = () => {
  let text = '';
  let ready = true;
  const raw = jest.fn(async (_enabled: boolean) => undefined);
  const prepareEngine = jest.fn(async () => undefined);
  const health = (): IEngineHealth => {
    const fields = Object.fromEntries(
      text.split(/\r?\n/).map((line) => line.split('=')),
    );
    return {
      outputs: [
        {
          endpoint: fields.endpoint,
          locked: true,
          processing: true,
          owner: true,
          problems: [],
          sourceAnalysis: {
            version: 2,
            kind: fields.kind,
            owner: fields.owner,
            epoch: Number(fields.epoch),
            revision: Number(fields.revision),
            ready,
            voiceReady: true,
          },
        },
      ],
    };
  };
  const readHealth = jest.fn(async () => health());
  const publisher = createSourceAnalysisPublisher({
    resolveConfigDir: async () => 'C:/test-config',
    resolveSourceEndpoint: async () => '{01234567-89ab-cdef-0123-456789abcdef}',
    write: async (_file, contents) => {
      text = contents;
    },
    readHealth,
    setRawLibrary: raw,
    prepareEngine,
  });
  const holdPreparation = () => {
    const entered = deferred();
    const release = deferred();
    prepareEngine.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });
    return { entered: entered.promise, release: release.resolve };
  };
  return {
    publisher,
    raw,
    prepareEngine,
    holdPreparation,
    readHealth,
    health,
    text: () => text,
    setReady: (value: boolean) => {
      ready = value;
    },
  };
};

it('refuses an old start when a newer track is published during rack preparation', async () => {
  const t = setup();
  const hold = t.holdPreparation();
  const preparing = t.publisher.prepare(source(1, 'old'));
  await hold.entered;
  await t.publisher.publish(source(2, 'new', -25));
  hold.release();
  expect(await preparing).toBe(false);
  expect(t.text()).toContain('epoch=2');
  expect(t.text()).toContain('level=-25');
  expect(t.raw).not.toHaveBeenCalledWith(true);
});

it('keeps the latest measurements of the same source while preparing its start', async () => {
  const t = setup();
  const hold = t.holdPreparation();
  const preparing = t.publisher.prepare(source());
  await hold.entered;
  await t.publisher.publish(source(1, 'song', -25));
  hold.release();
  expect(await preparing).toBe(true);
  expect(t.text()).toContain('level=-25');
  expect(t.raw).toHaveBeenCalledWith(true);
});

it.each(['prepare', 'fallback'] as const)(
  'an invalid %s cannot cancel a valid pending start',
  async (action) => {
    const t = setup();
    const hold = t.holdPreparation();
    const preparing = t.publisher.prepare(source());
    await hold.entered;
    await expect(
      t.publisher[action]({ version: 1, epoch: -1, libraryAudible: true }),
    ).rejects.toThrow('Invalid Library source analysis');
    hold.release();
    expect(await preparing).toBe(true);
    expect(t.prepareEngine).toHaveBeenCalledTimes(1);
    expect(t.raw.mock.calls).toEqual([[true]]);
  },
);

it('does not let a late source-ready reply after release enable raw playback', async () => {
  const t = setup();
  const hold = t.holdPreparation();
  const preparing = t.publisher.prepare(source());
  await hold.entered;
  await t.publisher.release();
  hold.release();
  expect(await preparing).toBe(false);
  expect(t.raw.mock.calls).toEqual([[false]]);
  expect(t.text()).toContain('kind=live');
});

it('waits for the newest source revision instead of accepting an old ready status', async () => {
  const t = setup();
  t.setReady(false);
  const read = deferred();
  t.readHealth.mockImplementation(async () => {
    read.resolve();
    return t.health();
  });
  const preparing = t.publisher.prepare(source());
  await read.promise;
  await t.publisher.reflush();
  t.setReady(true);
  const obsoleteReady = t.health();
  t.setReady(false);
  await t.publisher.publish(source(1, 'song', -25));
  t.publisher.onHealth(obsoleteReady);
  await t.publisher.reflush();
  expect(t.raw).not.toHaveBeenCalled();
  t.setReady(true);
  t.publisher.onHealth(t.health());
  expect(await preparing).toBe(true);
  expect(t.text()).toContain('level=-25');
  expect(t.raw.mock.calls).toEqual([[true]]);
});
