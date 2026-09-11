import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TPlusTermsNoticeState } from './ipc/plusTermsNotice';

/**
 * The renderer's side of the Plus terms notice: what to show, and that it
 * was put away. Its own module, like `outputMirrorBridge`, so `api.ts` gains
 * one line rather than three functions.
 */
export const plusTermsNoticeBridge = {
  getPlusTermsNotice: (): Promise<TPlusTermsNoticeState> =>
    ipcRenderer.invoke('plus-terms-notice'),
  /** Names the version the notice showed, so only that one is recorded. */
  plusTermsNoticeSeen: (version: number): Promise<TPlusTermsNoticeState> =>
    ipcRenderer.invoke('plus-terms-notice-seen', version),
  onPlusTermsNotice: (listener: (notice: TPlusTermsNoticeState) => void) => {
    const receive = (_event: IpcRendererEvent, notice: TPlusTermsNoticeState) =>
      listener(notice);
    ipcRenderer.on('plus-terms-notice-changed', receive);
    return () => {
      ipcRenderer.removeListener('plus-terms-notice-changed', receive);
    };
  },
};
