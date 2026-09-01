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

/*
 * THE DOWNLOAD LIVES IN MAIN, AND ITS URLS LIVE THERE WITH IT.
 *
 * There used to be a base URL, a model filename, a weights URL and a Cache
 * Storage name here, and they were the last of the onnxruntime-web attempt —
 * the renderer-worker version that `src/main/karaokeSeparation.ts` describes
 * itself as having replaced. Nothing had read them for some time.
 *
 * They were worse than unused, which is why this note replaces them rather than
 * a silent deletion. `karaokeSeparation.ts` holds its own `MODEL_FILE` and
 * `WEIGHTS_FILE`, so the model's name was written twice, in two processes, with
 * only one of the copies doing any downloading. A change to the pinned model
 * would have been made in one place and looked complete.
 *
 * The provenance records above stay: they are read by `useMakerSeparation` for
 * the licence panel, and they describe where the weights come from rather than
 * fetching them.
 */

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
