import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { reportError } from '../utils/logger';
import {
  createPreviewVideoRecorder,
  type IPreviewVideo,
  type IPreviewVideoRecorder,
  type TPreviewVideoProgress,
} from './previewVideo';

export interface IPublishPreview extends IPreviewVideo {
  /** Exact local publication inputs; never a scene/version-only cache key. */
  source: string;
}

export type TPublishVideoState =
  | TPreviewVideoProgress
  | { phase: 'ready'; video: IPublishPreview; url: string }
  | { phase: 'failed' | 'cancelled' };

/** One recording per exact source. Effect cleanup owns the recorder, frame
 * request and URL, including React's development remount and late encoding. */
export default function usePublishVideo(
  source: string,
  watermark: string,
  onPreview: (video: IPublishPreview | undefined) => void,
) {
  const [state, setState] = useState<TPublishVideoState>({
    phase: 'preparing',
  });
  const [take, setTake] = useState(0);
  const owner = useRef<IPreviewVideoRecorder | undefined>(undefined);
  const frameRequest = useRef<number | undefined>(undefined);
  const failed = useRef(false);
  const clipUrl = useRef<string | undefined>(undefined);
  const changed = useRef(onPreview);
  changed.current = onPreview;
  const stopFrames = useCallback(() => {
    if (frameRequest.current !== undefined) {
      cancelAnimationFrame(frameRequest.current);
    }
    frameRequest.current = undefined;
    owner.current = undefined;
  }, []);

  useLayoutEffect(() => {
    let current = true;
    failed.current = false;
    changed.current(undefined);
    setState({ phase: 'preparing' });
    const recording = createPreviewVideoRecorder(watermark, (next) => {
      if (current) {
        setState(next);
      }
    });
    owner.current = recording;
    recording.result
      .then((video) => {
        if (!current) {
          return undefined;
        }
        stopFrames();
        const url = URL.createObjectURL(video.blob);
        clipUrl.current = url;
        const preview = { ...video, source };
        setState({ phase: 'ready', video: preview, url });
        changed.current(preview);
        return undefined;
      })
      .catch((error: unknown) => {
        if (current) {
          stopFrames();
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            reportError('Recording a scene preview', error);
          }
          setState({
            phase:
              !failed.current &&
              error instanceof DOMException &&
              error.name === 'AbortError'
                ? 'cancelled'
                : 'failed',
          });
          changed.current(undefined);
        }
      });
    return () => {
      current = false;
      stopFrames();
      recording.cancel();
      if (frameRequest.current !== undefined) {
        cancelAnimationFrame(frameRequest.current);
      }
      frameRequest.current = undefined;
      if (clipUrl.current) {
        URL.revokeObjectURL(clipUrl.current);
      }
      clipUrl.current = undefined;
    };
  }, [source, watermark, take, stopFrames]);

  const frame = useCallback((canvas: HTMLCanvasElement) => {
    if (!owner.current || frameRequest.current !== undefined) {
      return;
    }
    // OffscreenCanvas commits its worker drawing at the rendering step. Read
    // the scene at the next paint, after its drawn acknowledgement arrived.
    frameRequest.current = requestAnimationFrame((at) => {
      frameRequest.current = undefined;
      owner.current?.frame(canvas, at);
    });
  }, []);

  const cancel = useCallback(() => {
    owner.current?.cancel();
    stopFrames();
  }, [stopFrames]);
  const fail = useCallback(() => {
    failed.current = true;
    owner.current?.cancel();
    stopFrames();
    if (clipUrl.current) {
      URL.revokeObjectURL(clipUrl.current);
    }
    clipUrl.current = undefined;
    changed.current(undefined);
    setState({ phase: 'failed' });
  }, [stopFrames]);
  const retry = useCallback(() => setTake((value) => value + 1), []);
  return { state, frame, cancel, retry, fail };
}
