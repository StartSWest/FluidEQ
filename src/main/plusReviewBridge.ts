/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ISceneReviewState,
  TMySubmissionsOutcome,
} from './ipc/plusReview';

/**
 * The window's side of scenes under review: a maker's list of what they
 * sent, the picture that waits with one, and the corner notice. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line. Scenes are named by
 * author and scene id, never by a path; the server decides who may do what.
 */
export const plusReviewBridge = {
  /** The picture sent with the submission the hash names. */
  reviewPicture: (
    authorId: string,
    sceneId: string,
    sha256: string,
  ): Promise<string | undefined> =>
    ipcRenderer.invoke('plus-review-picture', authorId, sceneId, sha256),
  mySceneSubmissions: (): Promise<TMySubmissionsOutcome> =>
    ipcRenderer.invoke('plus-my-submissions'),
  getSceneReviewNotice: (): Promise<ISceneReviewState> =>
    ipcRenderer.invoke('scene-review-notice'),
  /** Names the keys the notice showed, so only those are recorded. */
  sceneReviewNoticeSeen: (keys: string[]): Promise<ISceneReviewState> =>
    ipcRenderer.invoke('scene-review-notice-seen', keys),
  onSceneReviewNotice: (listener: (state: ISceneReviewState) => void) => {
    const receive = (_event: IpcRendererEvent, state: ISceneReviewState) =>
      listener(state);
    ipcRenderer.on('scene-review-notice-changed', receive);
    return () => {
      ipcRenderer.removeListener('scene-review-notice-changed', receive);
    };
  },
};
