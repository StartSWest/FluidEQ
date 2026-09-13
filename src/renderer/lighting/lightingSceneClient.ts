/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import type {
  ILightingSceneFrame,
  TLightingWorkerReply,
  TLightingWorkerRequest,
} from './lightingSceneMessages';

type TGridReply = Extract<TLightingWorkerReply, { kind: 'grid' }>;

export interface ILightingScene {
  load(pack: IScenePack): void;
  /**
   * Draw one frame for the lamps. A frame that arrives while the last is
   * still being drawn is dropped, not queued: the next tick is newer, and a
   * queue behind a slow GPU would light the desk a second late.
   */
  draw(frame: ILightingSceneFrame): void;
  close(): void;
}

/** The lighting scene worker, from the window. */
export const createLightingScene = (
  onGrid: (grid: TGridReply) => void,
  onFailed: (packId: string) => void,
): ILightingScene => {
  const worker = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './lighting-scene.js'
        : '/lighting-scene.dev.js',
      window.location.href,
    ),
  );
  let drawing = false;
  let ready = false;
  const post = (request: TLightingWorkerRequest) => worker.postMessage(request);

  worker.onmessage = ({ data }: MessageEvent<TLightingWorkerReply>) => {
    if (data.kind === 'grid') {
      drawing = false;
      onGrid(data);
    } else if (data.kind === 'loaded') {
      ready = true;
    } else {
      ready = false;
      drawing = false;
      onFailed(data.packId);
    }
  };
  worker.onerror = (event) => {
    // The worker script itself failed to load or threw at the top level:
    // there is no scene to draw with, and saying so is all that is left.
    console.error('Dynamic lighting scene worker failed:', event.message);
    ready = false;
    drawing = false;
    onFailed('');
  };

  return {
    load: (pack) => {
      ready = false;
      drawing = false;
      post({ kind: 'load', pack });
    },
    draw: (frame) => {
      if (!ready || drawing) {
        return;
      }
      drawing = true;
      post({ kind: 'frame', frame });
    },
    close: () => {
      worker.terminate();
    },
  };
};
