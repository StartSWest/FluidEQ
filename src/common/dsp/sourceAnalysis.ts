/* FluidEQ — GPL-3.0-or-later */
import type { ILibraryNormalizationAnalysis } from '../library/types';
import { isNoiseProfile } from './noiseProfile';

export const SOURCE_ANALYSIS_CHANNEL = 'dsp-source-analysis';
export const SOURCE_ANALYSIS_FILE = 'fluideq-source-analysis.txt';
export const SOURCE_ANALYSIS_VERSION = 1;

/** Immutable source facts. Output settings and derived gains never cross it. */
export interface ISourceAnalysisUpdate {
  version: 1;
  epoch: number;
  libraryAudible: boolean;
  sendingRawAudio?: boolean;
  trackId?: string;
  analysis?: ILibraryNormalizationAnalysis;
}

export interface IEngineSourceAnalysis {
  version: 1;
  kind: 'library' | 'live';
  owner: 'host' | 'engine';
  epoch: number;
  revision: number;
  ready: boolean;
  voiceReady: boolean;
}

export const parseEngineSourceAnalysis = (
  value: unknown,
): IEngineSourceAnalysis | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const v = value as Record<string, unknown>;
  if (
    v.version !== SOURCE_ANALYSIS_VERSION ||
    (v.kind !== 'library' && v.kind !== 'live') ||
    (v.owner !== 'host' && v.owner !== 'engine') ||
    !Number.isSafeInteger(v.epoch) ||
    Number(v.epoch) < 0 ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    typeof v.ready !== 'boolean' ||
    typeof v.voiceReady !== 'boolean'
  ) {
    return undefined;
  }
  return {
    version: 1,
    kind: v.kind,
    owner: v.owner,
    epoch: Number(v.epoch),
    revision: Number(v.revision),
    ready: v.ready,
    voiceReady: v.voiceReady,
  };
};

const level = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= -120 &&
  value <= 24;

/** Validate at IPC and copy arrays so a later UI update cannot mutate a write. */
export const copySourceAnalysisUpdate = (
  value: unknown,
): ISourceAnalysisUpdate | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const v = value as Partial<ISourceAnalysisUpdate>;
  if (
    v.version !== 1 ||
    !Number.isSafeInteger(v.epoch) ||
    Number(v.epoch) < 0 ||
    typeof v.libraryAudible !== 'boolean' ||
    (v.sendingRawAudio !== undefined &&
      typeof v.sendingRawAudio !== 'boolean') ||
    (v.trackId !== undefined &&
      (typeof v.trackId !== 'string' || !v.trackId || v.trackId.length > 256))
  ) {
    return undefined;
  }
  const a = v.analysis;
  if (
    a !== undefined &&
    (typeof a !== 'object' ||
      a === null ||
      a.version !== 2 ||
      !level(a.integratedLufs) ||
      !level(a.truePeakDbtp) ||
      (a.noise !== undefined && !isNoiseProfile(a.noise)))
  ) {
    return undefined;
  }
  return {
    version: 1,
    epoch: Number(v.epoch),
    libraryAudible: v.libraryAudible,
    sendingRawAudio: v.sendingRawAudio === true,
    ...(v.trackId ? { trackId: v.trackId } : {}),
    ...(a
      ? {
          analysis: {
            version: 2,
            integratedLufs: a.integratedLufs,
            truePeakDbtp: a.truePeakDbtp,
            ...(a.noise
              ? {
                  noise: {
                    ...a.noise,
                    bandsDb: [...a.noise.bandsDb],
                    humPartials: a.noise.humPartials.map((partial) => ({
                      ...partial,
                    })),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
};
