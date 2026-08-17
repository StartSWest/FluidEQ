/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';

/**
 * Where the vocal separation weights come from, and on what terms.
 *
 * Both records matter and they are separate credits. The model was trained and
 * released by Kimberley Jensen, relicensed from GPL-3.0 to MIT in April 2026;
 * the ONNX conversion that lets it run without PyTorch is someone else's work
 * again. MIT asks for the copyright notice to travel with the artefact, which
 * is what these records are for — they surface in the Maker's licence list
 * beside the Whisper and Basic Pitch entries.
 *
 * Worth stating plainly for whoever revisits this: the obvious alternative,
 * Demucs, is *not* usable here. Its code is MIT but its pretrained weights
 * carry no licence statement at all, and an undocumented licence is not a
 * permissive one. FluidEQ is sold, so "probably fine" is not a standard it can
 * ship against.
 */
export const SEPARATION_MODEL_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: 'Mel-Band RoFormer vocal separation model',
  version: 'KimberleyJSN/melbandroformer (downloaded on demand)',
  license: 'MIT',
  sourceUrl: 'https://huggingface.co/KimberleyJSN/melbandroformer',
};

export const SEPARATION_RUNTIME_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: 'Mel-Band RoFormer ONNX export',
  version: 'silverdaw/mel-band-roformer-vocals-onnx',
  license: 'MIT',
  sourceUrl: 'https://huggingface.co/silverdaw/mel-band-roformer-vocals-onnx',
};

/** The graph, and the external tensor file it references by name. */
const SEPARATION_MODEL_BASE =
  'https://huggingface.co/silverdaw/mel-band-roformer-vocals-onnx/resolve/main';
export const SEPARATION_MODEL_FILE = 'syhft_core_folded_fp16_webgpu.onnx';
export const SEPARATION_MODEL_URL = `${SEPARATION_MODEL_BASE}/${SEPARATION_MODEL_FILE}`;
export const SEPARATION_WEIGHTS_URL = `${SEPARATION_MODEL_URL}.data`;

/**
 * Roughly what the user is being asked to download, for the consent prompt.
 *
 * Stated because it is large enough to matter: eighteen times the Whisper model
 * this app already fetches, and on a metered connection that is a decision
 * rather than a detail.
 */
export const SEPARATION_MODEL_BYTES = 746_498_840;

/** Cache name for the two model files, kept apart from the transformers cache. */
export const SEPARATION_CACHE = 'fluideq-separation-model-v1';

const SEPARATION_DOWNLOADED_KEY =
  'fluideq.karaoke.separationDownloaded.v1.melband-roformer';

export type TSeparationStatus =
  'unloaded' | 'downloading' | 'loading' | 'ready' | 'working' | 'error';

export interface ISeparationSessionSnapshot {
  status: TSeparationStatus;
  /** True once both model files are in the cache and usable offline. */
  downloaded: boolean;
  /** True while a session holds the weights in memory. */
  inMemory: boolean;
}

let snapshot: ISeparationSessionSnapshot = {
  status: 'unloaded',
  downloaded: false,
  inMemory: false,
};

const listeners = new Set<() => void>();

export const readSeparationSessionSnapshot = (): ISeparationSessionSnapshot =>
  snapshot;

export const subscribeToSeparationSession = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitSeparationSession = (
  patch: Partial<ISeparationSessionSnapshot>,
) => {
  const next = { ...snapshot, ...patch };
  if (
    next.status === snapshot.status &&
    next.downloaded === snapshot.downloaded &&
    next.inMemory === snapshot.inMemory
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const markSeparationDownloaded = () => {
  try {
    window.localStorage.setItem(SEPARATION_DOWNLOADED_KEY, 'true');
  } catch {
    // The session stays usable without the hint; it only saves a cache probe.
  }
  emitSeparationSession({ downloaded: true });
};

/**
 * Whether both model files are already cached.
 *
 * Checks the cache rather than trusting the stored flag alone, because the
 * flag survives a cache the browser has since evicted — and the difference
 * between "cached" and "about to download 700MB" is one the user should not
 * discover halfway through a wizard. Both files are required: the graph
 * without its external weights is a 5MB file that fails at session creation.
 */
export const refreshSeparationDownloaded = async (): Promise<boolean> => {
  if (typeof caches === 'undefined') {
    return false;
  }
  try {
    const cache = await caches.open(SEPARATION_CACHE);
    const [graph, weights] = await Promise.all([
      cache.match(SEPARATION_MODEL_URL),
      cache.match(SEPARATION_WEIGHTS_URL),
    ]);
    const complete = Boolean(graph && weights);
    if (complete) {
      markSeparationDownloaded();
      return true;
    }
    emitSeparationSession({ downloaded: false });
    return false;
  } catch {
    // Cache introspection is an optimisation, never the source of truth.
    return false;
  }
};

/**
 * Whether this machine can run the model at a speed anyone would wait for.
 *
 * Measured on an RTX 4080: 0.82 s per 11 s chunk on WebGPU against 11.5 s on
 * DirectML and 12.4 s on CPU — a 14x difference, because the export is built
 * for WebGPU and the other backends fall back for most of the graph. So this
 * is not a micro-optimisation to leave for later: with WebGPU a song takes
 * well under a minute, and without it the same song takes six. Both work, and
 * the caller is expected to say which one the user is about to get.
 */
export const separationHasGpu = async (): Promise<boolean> => {
  const { gpu } = navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown> };
  };
  if (!gpu) {
    return false;
  }
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
};
