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
  | { phase: 'idle' | 'waiting' }
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

/** A take is armed only when the member sends the scene (`record`), never
 * on opening (Ivan, 2026-11-23: "when they click publish ... at that point,
 * we will be recording the video always using a demo data"): until then the
 * take is `idle`, and a new source — another hour, the scene rebuilt —
 * leaves it idle again. An armed take owns no recorder until real audio
 * and a fully drawn scene meet. Silence or a paused player holds a take and
 * sound carries it on from the same second (Ivan, 2026-11-07: discarding it
 * at every quiet moment made the panel jump and a take over speech or a song
 * with pauses never finished). Neither queued frames nor late encoders can
 * revive a cancelled recording. */
export default function usePublishVideo(
  source: string,
  watermark: string,
  onPreview: (video: IPublishPreview | undefined) => void,
) {
  const [state, setState] = useState<TPublishVideoState>({ phase: 'idle' });
  const [take, setTake] = useState(0);
  // Whether the next take is armed: set by `record` just before it asks for
  // the take, read once by the take it makes.
  const armNext = useRef(false);
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
    const armed = armNext.current;
    armNext.current = false;
    const current: ITake = {
      armed,
      playing: false,
      capturing: true,
      start: () => {
        const token = {};
        current.token = token;
        const recording = createPreviewVideoRecorder(watermark, (next) => {
          if (owner.current === current && current.token === token) {
            current.capturing = ['preparing', 'recording', 'paused'].includes(
              next.phase,
            );
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
    setState({ phase: armed ? 'waiting' : 'idle' });
    return () => {
      owner.current = undefined;
      stop(current);
      if (current.url) {
        URL.revokeObjectURL(current.url);
      }
    };
  }, [source, watermark, take, stop]);

  const input = useCallback((playing: boolean) => {
    const { current } = owner;
    if (!current) {
      return;
    }
    if (current.playing === playing) {
      return;
    }
    current.playing = playing;
    if (!current.armed || !current.recording || !current.capturing) {
      return;
    }
    if (playing) {
      current.recording.resume();
    } else {
      current.recording.pause();
    }
  }, []);
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
  const record = useCallback(() => {
    armNext.current = true;
    setTake((value) => value + 1);
  }, []);
  return { state, input, frame, cancel, record, fail };
}
