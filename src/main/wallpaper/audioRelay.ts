import type { WebContents } from 'electron';
import {
  WALLPAPER,
  isWallpaperAudio,
  type IWallpaperAudio,
} from '../../common/wallpaper';

/** One outstanding read, so a stalled renderer cannot build a queue of frames. */
const createWallpaperAudioRelay = () => {
  let sequence = 0;
  let pending:
    | {
        id: number;
        promise: Promise<IWallpaperAudio | undefined>;
        resolve: (value: IWallpaperAudio | undefined) => void;
      }
    | undefined;

  const cancel = () => {
    const old = pending;
    pending = undefined;
    old?.resolve(undefined);
  };

  return {
    cancel,
    request: (owner: WebContents): Promise<IWallpaperAudio | undefined> => {
      if (pending) {
        return pending.promise;
      }
      if (owner.isDestroyed()) {
        return Promise.resolve(undefined);
      }
      sequence += 1;
      const id = sequence;
      let answer: (value: IWallpaperAudio | undefined) => void = () =>
        undefined;
      const promise = new Promise<IWallpaperAudio | undefined>((resolve) => {
        answer = resolve;
      });
      pending = { id, promise, resolve: answer };
      try {
        owner.send(WALLPAPER.readAudio, id);
      } catch {
        cancel();
      }
      return promise;
    },
    accept: (raw: unknown) => {
      if (!pending || !raw || typeof raw !== 'object') {
        return;
      }
      const { requestId, frame } = raw as {
        requestId?: unknown;
        frame?: unknown;
      };
      if (requestId !== pending.id) {
        return;
      }
      const { resolve } = pending;
      pending = undefined;
      resolve(isWallpaperAudio(frame) ? frame : undefined);
    },
  };
};

export default createWallpaperAudioRelay;
