/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  IKaraokeRestoredFileBytes,
  IKaraokeRestoredSession,
  IKaraokeSessionSnapshot,
} from '../common/karaoke/sessionPersistence';
import type {
  IKaraokeMakerExportRequest,
  IKaraokeMakerExportResult,
} from '../common/karaoke/makerPersistence';
import type { IKaraokeMakerProject } from '../common/karaoke/makerProject';

/**
 * The Karaoke tab's calls: the session kept between launches, the Maker's
 * drafts and exports, and the separation and pitch models, with their
 * progress.
 */

const saveKaraokeSession = (snapshot: IKaraokeSessionSnapshot) =>
  ipcRenderer.invoke('karaoke-session-save', snapshot) as Promise<void>;

const restoreKaraokeSession = () =>
  ipcRenderer.invoke('karaoke-session-restore') as Promise<
    IKaraokeRestoredSession | undefined
  >;

const readKaraokeSessionFile = (token: string) =>
  ipcRenderer.invoke('karaoke-session-read-file', token) as Promise<
    IKaraokeRestoredFileBytes | undefined
  >;

const clearKaraokeSession = () =>
  ipcRenderer.invoke('karaoke-session-clear') as Promise<void>;

const saveKaraokeMakerDraft = (project: IKaraokeMakerProject) =>
  ipcRenderer.invoke('karaoke-maker-draft-save', project) as Promise<void>;

const loadKaraokeMakerDraft = (projectId: string) =>
  ipcRenderer.invoke('karaoke-maker-draft-load', projectId) as Promise<
    IKaraokeMakerProject | undefined
  >;

const deleteKaraokeMakerDraft = (projectId: string) =>
  ipcRenderer.invoke('karaoke-maker-draft-delete', projectId) as Promise<void>;

const exportKaraokeMakerFile = (request: IKaraokeMakerExportRequest) =>
  ipcRenderer.invoke(
    'karaoke-maker-export',
    request,
  ) as Promise<IKaraokeMakerExportResult>;

/**
 * Split a decoded song into a vocal and an instrumental stem.
 *
 * Inference runs in the main process on the native ONNX runtime — the
 * renderer decodes and draws, main computes. Four channels of Float32 samples
 * cross this boundary each way; progress arrives separately through
 * {@link onKaraokeSeparationProgress} because `invoke` has exactly one reply.
 */
const separateKaraokeVocals = (left: Float32Array, right: Float32Array) =>
  ipcRenderer.invoke('karaoke-separate', { left, right }) as Promise<{
    vocalsLeft: Float32Array;
    vocalsRight: Float32Array;
    musicLeft: Float32Array;
    musicRight: Float32Array;
    backend: string;
  }>;

const getKaraokeModelStatus = () =>
  ipcRenderer.invoke('karaoke-models-status') as Promise<{
    separation: { loaded: boolean; bytes: number };
    pitch: { loaded: boolean; bytes: number; downloadedBytes: number };
  }>;

const releaseKaraokePitchModel = () =>
  ipcRenderer.send('karaoke-pitch-release', []);

const detectKaraokePitch = (samples: Float32Array) =>
  ipcRenderer.invoke('karaoke-pitch-f0', samples) as Promise<{
    pitchHz: Float32Array;
    confidence: Float32Array;
    hopSeconds: number;
    /** What counts as a voiced frame differs per model; main says which. */
    voicedThreshold: number;
    model: 'rmvpe' | 'swift-f0';
    /** The bundled model completed the run after the optional fetch failed. */
    rmvpeDownloadFailed?: boolean;
  }>;

const onKaraokePitchProgress = (
  listener: (progress: {
    stage: string;
    fraction: number;
    /** Present only while downloading; see karaokePitch.ts. */
    loadedBytes?: number;
    totalBytes?: number;
    file?: string;
  }) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    progress: { stage: string; fraction: number },
  ) => listener(progress);
  ipcRenderer.on('karaoke-pitch-progress', wrapped);
  return () => {
    ipcRenderer.removeListener('karaoke-pitch-progress', wrapped);
  };
};

const saveKaraokeStems = (
  key: string,
  vocals: ArrayBuffer,
  instrumental: ArrayBuffer,
) =>
  ipcRenderer.invoke('karaoke-stems-save', {
    key,
    vocals,
    instrumental,
  }) as Promise<void>;

const loadKaraokeStems = (key: string) =>
  ipcRenderer.invoke('karaoke-stems-load', key) as Promise<{
    vocals: Uint8Array;
    instrumental: Uint8Array;
  } | null>;

const releaseKaraokeSeparationModel = () =>
  ipcRenderer.send('karaoke-separate-release', []);

const cancelKaraokeSeparation = () =>
  ipcRenderer.send('karaoke-separate-cancel', []);

const onKaraokeSeparationProgress = (
  listener: (progress: { stage: string; fraction: number }) => void,
) => {
  const wrapped = (
    _event: IpcRendererEvent,
    progress: { stage: string; fraction: number },
  ) => listener(progress);
  ipcRenderer.on('karaoke-separate-progress', wrapped);
  return () => {
    ipcRenderer.removeListener('karaoke-separate-progress', wrapped);
  };
};

const karaokeBridge = {
  saveKaraokeSession,
  restoreKaraokeSession,
  readKaraokeSessionFile,
  clearKaraokeSession,
  saveKaraokeMakerDraft,
  loadKaraokeMakerDraft,
  deleteKaraokeMakerDraft,
  exportKaraokeMakerFile,
  separateKaraokeVocals,
  getKaraokeModelStatus,
  releaseKaraokePitchModel,
  detectKaraokePitch,
  onKaraokePitchProgress,
  saveKaraokeStems,
  loadKaraokeStems,
  releaseKaraokeSeparationModel,
  cancelKaraokeSeparation,
  onKaraokeSeparationProgress,
};

export default karaokeBridge;
