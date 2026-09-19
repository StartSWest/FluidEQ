/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TReviewAnswer } from '../common/plusReview';
import type {
  ISceneReviewState,
  TMySubmissionsOutcome,
  TReviewAnswerOutcome,
  TReviewQueueOutcome,
  TReviewSceneOutcome,
} from './ipc/plusReview';

/**
 * The window's side of scenes under review: the admin's queue and answers, a
 * maker's list of what they sent, and the corner notice. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line. Scenes are named by
 * author and scene id, never by a path; the server decides who may do what.
 */
export const plusReviewBridge = {
  listReviewQueue: (): Promise<TReviewQueueOutcome> =>
    ipcRenderer.invoke('plus-review-queue'),
  /** The waiting scene itself, verified, when its bytes are the ones named. */
  reviewScene: (
    authorId: string,
    sceneId: string,
    sha256: string,
  ): Promise<TReviewSceneOutcome> =>
    ipcRenderer.invoke('plus-review-scene', authorId, sceneId, sha256),
  /** The picture sent with the submission the hash names. */
  reviewPicture: (
    authorId: string,
    sceneId: string,
    sha256: string,
  ): Promise<string | undefined> =>
    ipcRenderer.invoke('plus-review-picture', authorId, sceneId, sha256),
  answerReview: (
    authorId: string,
    sceneId: string,
    version: number,
    sha256: string,
    answer: TReviewAnswer,
  ): Promise<TReviewAnswerOutcome> =>
    ipcRenderer.invoke(
      'plus-review-answer',
      authorId,
      sceneId,
      version,
      sha256,
      answer,
    ),
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
