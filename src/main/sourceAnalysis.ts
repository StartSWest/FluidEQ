/* FluidEQ — GPL-3.0-or-later */
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
} from '../common/engineHealth';
import {
  copySourceAnalysisUpdate,
  parseEngineSourceAnalysis,
  SOURCE_ANALYSIS_FILE,
  type ISourceAnalysisUpdate,
} from '../common/dsp/sourceAnalysis';
import { encodeNoiseProfile } from '../common/dsp/noiseProfile';
import { denoiseModelPath, isDenoiseModelPresent } from './denoiseModel';

export interface ISourceVoicePaths {
  model: string;
}
export interface ISourceAnalysisDeps {
  resolveConfigDir: () => Promise<string | undefined>;
  resolveSourceEndpoint: () => Promise<string | undefined>;
  write: (filePath: string, contents: string) => Promise<void>;
  readHealth: () => Promise<IEngineHealth>;
  setRawLibrary: (raw: boolean) => Promise<void>;
  /** Persist current rack ownership for every active output before its source. */
  prepareEngine: () => Promise<void>;
}

interface IPublishedSource {
  endpoint: string;
  epoch: number;
  revision: number;
  library: boolean;
  owner: 'host' | 'engine';
  updateKey: string;
}

const safePath = (value: string): boolean =>
  path.isAbsolute(value) && !/[\r\n\0]/.test(value);

const voicePaths = async (
  directory: string,
): Promise<ISourceVoicePaths | undefined> => {
  if (!isDenoiseModelPresent()) {
    return undefined;
  }
  const origin = denoiseModelPath();
  if (!safePath(origin)) {
    return undefined;
  }
  const bytes = await fs.readFile(origin);
  // Validate these exact bytes too: the downloaded file could change between
  // the presence check and the copy. Native independently checks the data.
  const digest =
    '0b399f8a58dc4d70d8cd97541f5c39869406145193b957d00a03b66070944928';
  if (
    bytes.length !== 10_596_848 ||
    createHash('sha256').update(bytes).digest('hex') !== digest
  ) {
    return undefined;
  }
  const model = path.join(directory, 'fluideq-voice.onnx');
  const existingStat = await fs.stat(model).catch(() => undefined);
  const existing =
    existingStat?.size === bytes.length
      ? await fs.readFile(model).catch(() => undefined)
      : undefined;
  if (
    !existing ||
    createHash('sha256').update(existing).digest('hex') !== digest
  ) {
    const temporary = `${model}.${process.pid}.tmp`;
    try {
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, model);
    } catch (error) {
      // The player has this model even if the service copy failed. Keep that
      // fact: native will refuse readiness instead of silently dropping Voice.
      log.warn('Could not prepare the output voice model.', error);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  }
  return { model };
};

/** The audio service must independently trust installed model/runtime paths.
 * These paths describe availability; they are not permission to load a DLL. */
export const formatSourceAnalysis = (
  update: ISourceAnalysisUpdate,
  publication: IPublishedSource,
  voice: ISourceVoicePaths | undefined,
): string =>
  [
    '# FluidEQ source analysis v1',
    'version=1',
    `kind=${publication.library ? 'library' : 'live'}`,
    `owner=${publication.owner}`,
    `source=${update.trackId ? createHash('sha256').update(update.trackId).digest('hex').slice(0, 16) : '0000000000000000'}`,
    `epoch=${publication.epoch}`,
    `revision=${publication.revision}`,
    `endpoint=${publication.endpoint}`,
    ...(publication.library && update.analysis
      ? [
          `level=${update.analysis.integratedLufs}`,
          `peak=${update.analysis.truePeakDbtp}`,
          ...(update.analysis.noise
            ? [`noise=${encodeNoiseProfile(update.analysis.noise).join(' ')}`]
            : []),
        ]
      : []),
    `voice=${voice ? 'available' : 'unavailable'}`,
    ...(voice ? [`voiceModel=${voice.model}`] : []),
    '',
  ].join('\r\n');

export const createSourceAnalysisPublisher = (deps: ISourceAnalysisDeps) => {
  let latest: ISourceAnalysisUpdate = {
    version: 1,
    epoch: 0,
    libraryAudible: false,
  };
  let revision = Date.now();
  let voice: ISourceVoicePaths | undefined;
  let voiceChecked = false;
  let voiceDirectory: string | undefined;
  let fingerprint = '';
  let published: IPublishedSource | undefined;
  let health: IEngineHealth = { outputs: [] };
  let serial = Promise.resolve();
  let pending: { epoch: number; settle: (ready: boolean) => void } | undefined;
  let ownershipGeneration = 0;
  let ownership: 'host' | 'preparing' | 'native' = 'host';
  let rawSerial = Promise.resolve();
  const changeRaw = (raw: boolean) => {
    const next = rawSerial.then(() => deps.setRawLibrary(raw));
    rawSerial = next.catch(() => undefined);
    return next;
  };

  const sourceOutput = () =>
    health.outputs.find((output) => output.endpoint === published?.endpoint);
  const settlePending = () => {
    if (!pending || !published) {
      return;
    }
    if (published.updateKey !== JSON.stringify(latest)) {
      // A newer measurement is already queued. An older graph's readiness
      // cannot release a start before those source facts have been adopted.
      return;
    }
    const output = sourceOutput();
    if (!output?.locked || !output.owner || pending.epoch !== latest.epoch) {
      pending.settle(false);
      pending = undefined;
      return;
    }
    const status = parseEngineSourceAnalysis(
      (output as typeof output & { sourceAnalysis?: unknown }).sourceAnalysis,
    );
    if (
      status?.kind === 'library' &&
      status.owner === published.owner &&
      status.epoch === published.epoch &&
      status.revision === published.revision &&
      // A prepared graph reports pending until the audio callback adopts it.
      // Only a real refusal may send this stopped start back to the host.
      (status.ready || output.problems.includes('source-analysis'))
    ) {
      pending.settle(status.ready);
      pending = undefined;
    }
  };
  const flush = async () => {
    const update = latest;
    const [directory, resolvedEndpoint] = await Promise.all([
      deps.resolveConfigDir(),
      deps.resolveSourceEndpoint(),
    ]);
    const endpoint =
      resolvedEndpoint ??
      (!update.libraryAudible
        ? '{00000000-0000-0000-0000-000000000000}'
        : undefined);
    if (update !== latest) {
      return;
    }
    if (!directory || !endpoint) {
      // An old Fluid status cannot acknowledge a new start after the engine
      // changed or its source output disappeared.
      published = undefined;
      pending?.settle(false);
      pending = undefined;
      return;
    }
    if (!voiceChecked || voiceDirectory !== directory) {
      voice = await voicePaths(directory);
      voiceChecked = true;
      voiceDirectory = directory;
    }
    if (update !== latest) {
      return;
    }
    const normalized = normaliseEndpointGuid(endpoint);
    const owner =
      ownership === 'host' && !update.sendingRawAudio ? 'host' : 'engine';
    const nextFingerprint = JSON.stringify([update, normalized, voice, owner]);
    if (nextFingerprint !== fingerprint) {
      revision += 1;
      fingerprint = nextFingerprint;
    }
    const next: IPublishedSource = {
      endpoint: normalized,
      epoch: update.epoch,
      revision,
      library:
        update.libraryAudible &&
        !!update.trackId &&
        !(update.sendingRawAudio && ownership === 'host'),
      owner,
      updateKey: JSON.stringify(update),
    };
    await deps.write(
      path.join(directory, SOURCE_ANALYSIS_FILE),
      formatSourceAnalysis(update, next, voice),
    );
    if (update !== latest) {
      return;
    }
    published = next;
    health = await deps.readHealth();
    settlePending();
  };
  const reflush = () => {
    const next = serial.then(flush);
    serial = next.catch(() => undefined);
    return next;
  };
  const publish = (value: unknown) => {
    const next = copySourceAnalysisUpdate(value);
    if (!next) {
      return Promise.reject(new Error('Invalid Library source analysis.'));
    }
    const changesPlacement =
      latest.libraryAudible !== next.libraryAudible ||
      latest.sendingRawAudio !== next.sendingRawAudio;
    latest = next;
    if (pending && pending.epoch !== next.epoch) {
      pending.settle(false);
      pending = undefined;
    }
    return changesPlacement && ownership !== 'preparing'
      ? deps.prepareEngine().then(reflush)
      : reflush();
  };
  const capable = async () => {
    await reflush();
    const output = sourceOutput();
    return (
      !!output?.locked &&
      output.owner &&
      !!parseEngineSourceAnalysis(
        (output as typeof output & { sourceAnalysis?: unknown }).sourceAnalysis,
      )
    );
  };
  const waitForSource = () => {
    pending?.settle(false);
    return new Promise<boolean>((resolve) => {
      pending = { epoch: latest.epoch, settle: resolve };
      settlePending();
    });
  };
  const fallback = async (value: unknown): Promise<boolean> => {
    const next = copySourceAnalysisUpdate(value);
    if (!next) {
      throw new Error('Invalid Library source analysis.');
    }
    ownershipGeneration += 1;
    const generation = ownershipGeneration;
    ownership = 'host';
    latest = next;
    await deps.prepareEngine();
    if (generation !== ownershipGeneration) {
      return false;
    }
    fingerprint = '';
    await reflush();
    if (published?.library && (await capable()) && !(await waitForSource())) {
      throw new Error(
        'The output did not acknowledge the Library player rack.',
      );
    }
    if (generation !== ownershipGeneration) {
      return false;
    }
    await changeRaw(false);
    return true;
  };
  return {
    publish,
    reflush,
    capable,
    fallback,
    hostOwnsSource: () =>
      latest.libraryAudible && !latest.sendingRawAudio && ownership === 'host',
    rackEnabledFor: (endpoint: string, from?: string) => {
      if (
        !latest.libraryAudible ||
        latest.sendingRawAudio ||
        ownership !== 'host'
      ) {
        return true;
      }
      const source = published?.endpoint;
      return (
        !source ||
        (normaliseEndpointGuid(endpoint) !== source &&
          (!from || normaliseEndpointGuid(from) !== source))
      );
    },
    onHealth: (next: IEngineHealth) => {
      health = next;
      settlePending();
    },
    refreshVoice: () => {
      voiceChecked = false;
      return reflush();
    },
    prepare: async (value: unknown): Promise<boolean> => {
      const requested = copySourceAnalysisUpdate(value);
      if (!requested) {
        throw new Error('Invalid Library source analysis.');
      }
      ownershipGeneration += 1;
      const generation = ownershipGeneration;
      ownership = 'preparing';
      latest = requested;
      const currentSource = () =>
        generation === ownershipGeneration &&
        latest.epoch === requested.epoch &&
        latest.trackId === requested.trackId &&
        latest.libraryAudible;
      await deps.prepareEngine();
      if (!currentSource()) {
        return false;
      }
      // A fresh revision must be adopted AFTER the ownership files above.
      // Reflush the latest measurements: a publish during preparation may
      // have updated this source, and a different source cancels this start.
      fingerprint = '';
      await reflush();
      if (!published?.library || !(await capable()) || !currentSource()) {
        return false;
      }
      const ready = await waitForSource();
      if (
        !ready ||
        !currentSource() ||
        published.updateKey !== JSON.stringify(latest)
      ) {
        return false;
      }
      await changeRaw(true);
      if (!currentSource()) {
        return false;
      }
      ownership = 'native';
      return true;
    },
    release: async () => {
      ownershipGeneration += 1;
      ownership = 'host';
      pending?.settle(false);
      pending = undefined;
      latest = { ...latest, libraryAudible: false };
      await changeRaw(false);
      await reflush();
      await deps.prepareEngine();
    },
  };
};

export type ISourceAnalysisPublisher = ReturnType<
  typeof createSourceAnalysisPublisher
>;
