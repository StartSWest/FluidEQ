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
  | { phase: 'waiting' }
  | { phase: 'ready'; video: IPublishPreview; url: string }
  | { phase: 'failed' | 'cancelled' };

interface ITake {
  armed: boolean;
  playing: boolean;
  capturing: boolean;
  recording?: IPreviewVideoRecorder;
  token?: object;
  request?: number;
  url?: string;
  start: () => IPreviewVideoRecorder;
}

/** A take is armed on opening/retry, but owns no recorder until real audio
 * and a fully drawn scene meet. Silence/pausing discards a partial take;
 * neither queued frames nor late encoders can revive a discarded recording. */
export default function usePublishVideo(
  source: string,
  watermark: string,
  onPreview: (video: IPublishPreview | undefined) => void,
) {
  const [state, setState] = useState<TPublishVideoState>({ phase: 'waiting' });
  const [take, setTake] = useState(0);
  const owner = useRef<ITake | undefined>(undefined);
  const changed = useRef(onPreview);
  changed.current = onPreview;
  const stop = useCallback((current: ITake) => {
    if (current.request !== undefined) {
      cancelAnimationFrame(current.request);
      current.request = undefined;
    }
    const { recording } = current;
    current.recording = undefined;
    current.token = undefined;
    recording?.cancel();
  }, []);

  useLayoutEffect(() => {
    const current: ITake = {
      armed: true,
      playing: false,
      capturing: true,
      start: () => {
        const token = {};
        current.token = token;
        const recording = createPreviewVideoRecorder(watermark, (next) => {
          if (owner.current === current && current.token === token) {
            current.capturing = ['preparing', 'recording'].includes(next.phase);
            setState(next);
          }
        });
        current.recording = recording;
        setState({ phase: 'preparing' });
        recording.result
          .then((video) => {
            if (owner.current !== current || current.recording !== recording) {
              return undefined;
            }
            current.armed = false;
            current.recording = undefined;
            current.url = URL.createObjectURL(video.blob);
            const preview = { ...video, source };
            setState({ phase: 'ready', video: preview, url: current.url });
            changed.current(preview);
            return undefined;
          })
          .catch((error: unknown) => {
            if (owner.current !== current || current.recording !== recording) {
              return;
            }
            stop(current);
            current.armed = false;
            reportError('Recording a scene preview', error);
            setState({ phase: 'failed' });
            changed.current(undefined);
          });
        return recording;
      },
    };
    owner.current = current;
    changed.current(undefined);
    setState({ phase: 'waiting' });
    return () => {
      owner.current = undefined;
      stop(current);
      if (current.url) {
        URL.revokeObjectURL(current.url);
      }
    };
  }, [source, watermark, take, stop]);

  const input = useCallback(
    (playing: boolean) => {
      const { current } = owner;
      if (!current) {
        return;
      }
      current.playing = playing;
      if (!playing && current.armed && current.recording && current.capturing) {
        stop(current);
        setState({ phase: 'waiting' });
        changed.current(undefined);
      }
    },
    [stop],
  );
  const frame = useCallback((canvas: HTMLCanvasElement) => {
    const { current } = owner;
    if (!current?.armed || !current.playing || current.request !== undefined) {
      return;
    }
    // Read OffscreenCanvas only after its worker's rendering commit. Recheck
    // audio and ownership at delivery: pause/source change may beat this paint.
    current.request = requestAnimationFrame((at) => {
      current.request = undefined;
      if (owner.current === current && current.armed && current.playing) {
        (current.recording ?? current.start()).frame(canvas, at);
      }
    });
  }, []);
  const cancel = useCallback(() => {
    const { current } = owner;
    if (current) {
      current.armed = false;
      stop(current);
    }
    changed.current(undefined);
    setState({ phase: 'cancelled' });
  }, [stop]);
  const fail = useCallback(() => {
    const { current } = owner;
    if (current) {
      current.armed = false;
      stop(current);
      if (current.url) {
        URL.revokeObjectURL(current.url);
        current.url = undefined;
      }
    }
    changed.current(undefined);
    setState({ phase: 'failed' });
  }, [stop]);
  const retry = useCallback(() => setTake((value) => value + 1), []);
  return { state, input, frame, cancel, retry, fail };
}
