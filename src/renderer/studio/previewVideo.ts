import {
  MAX_PREVIEW_BYTES,
  PREVIEW_DURATION_MS,
  SCENE_PREVIEW_CODEC,
  SCENE_PREVIEW_MP4_CODEC,
} from 'common/scenePreviewMedia';
import finishPreviewWebm from './previewWebm';

export {
  MAX_PREVIEW_BYTES,
  PREVIEW_DURATION_MS,
} from 'common/scenePreviewMedia';
const MAX_WIDTH = 960;
const MAX_HEIGHT = 540;
const FRAME_MS = 1000 / 30;

export interface IPreviewVideo {
  blob: Blob;
  durationMs: number;
  width: number;
  height: number;
}

export type TPreviewVideoProgress =
  | { phase: 'preparing' | 'encoding' | 'checking' }
  | { phase: 'recording'; elapsedMs: number };

export interface IPreviewVideoRecorder {
  /** Called only after the scene's renderer has produced a real frame. */
  frame(canvas: HTMLCanvasElement, at: number): void;
  result: Promise<IPreviewVideo>;
  cancel(): void;
}

const abortError = () => new DOMException('Recording cancelled', 'AbortError');

/** Decode an actual frame, as well as reading metadata. A supported MIME type
 * alone says nothing about whether this encoder produced a playable file. */
export const checkPreviewVideo = (
  blob: Blob,
  signal: AbortSignal,
): Promise<{ durationMs: number; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(blob);
    const clean = () => {
      signal.removeEventListener('abort', abort);
      video.onloadeddata = null;
      video.onended = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = (error: Error) => {
      clean();
      reject(error);
    };
    const abort = () => fail(abortError());
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => fail(new Error('Preview decoding failed'));
    video.onloadeddata = () => {
      const durationMs = video.duration * 1000;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (
        !Number.isFinite(durationMs) ||
        durationMs < PREVIEW_DURATION_MS - 250 ||
        durationMs > PREVIEW_DURATION_MS + 500 ||
        width < 2 ||
        height < 2 ||
        width > MAX_WIDTH ||
        height > MAX_HEIGHT
      ) {
        fail(new Error('Preview metadata outside bounds'));
        return;
      }
      video.onloadeddata = null;
      // Native decoding must reach the actual end, including later GOPs.
      // Accelerated silent playback keeps this verification short; readiness
      // still follows ended/error/abort rather than a guessed wait.
      video.playbackRate = 16;
      video.onended = () => {
        if (video.currentTime * 1000 < durationMs - 250) {
          fail(
            new Error('Preview playback ended before its declared duration'),
          );
          return;
        }
        clean();
        resolve({ durationMs, width, height });
      };
      video.play().catch(() => fail(new Error('Preview playback failed')));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    video.src = url;
    video.load();
  });

const mimeTypeOf = (): string => {
  const video = document.createElement('video');
  const type = [SCENE_PREVIEW_CODEC, SCENE_PREVIEW_MP4_CODEC].find(
    (candidate) =>
      MediaRecorder.isTypeSupported(candidate) && video.canPlayType(candidate),
  );
  if (!type) {
    throw new Error('No supported preview codec');
  }
  return type;
};

/** Only raster pixels from the scene enter this canvas. captureStream creates
 * one video track and requests neither media devices nor desktop permission. */
export const createPreviewVideoRecorder = (
  watermark: string,
  progress: (state: TPreviewVideoProgress) => void,
): IPreviewVideoRecorder => {
  const controller = new AbortController();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let track: CanvasCaptureMediaStreamTrack | undefined;
  let firstAt: number | undefined;
  let lastAt: number | undefined;
  let elapsedMs = 0;
  let finishing = false;
  let settled = false;
  let size = 0;
  const chunks: Blob[] = [];
  let complete: (video: IPreviewVideo) => void = () => undefined;
  let rejectResult: (error: Error) => void = () => undefined;
  const result = new Promise<IPreviewVideo>((resolve, reject) => {
    complete = resolve;
    rejectResult = reject;
  });
  const clean = () => {
    document.removeEventListener('visibilitychange', visibility);
    if (recorder) {
      recorder.onstart = null;
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }
    stream?.getTracks().forEach((item) => {
      item.onended = null;
      item.stop();
    });
    chunks.length = 0;
    canvas.width = 0;
    canvas.height = 0;
  };
  const fail = (error: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    controller.abort();
    clean();
    rejectResult(error);
  };
  // A hidden view stops the scene's renderer. Counting that gap would turn
  // ten seconds of elapsed wall time into a clip with missing scene frames.
  const visibility = () => {
    if (document.hidden && !finishing) {
      fail(new Error('Preview view hidden'));
    }
  };
  document.addEventListener('visibilitychange', visibility);
  progress({ phase: 'preparing' });

  const initialize = (source: HTMLCanvasElement) => {
    if (!context || typeof MediaRecorder === 'undefined') {
      throw new Error('Recording unavailable');
    }
    const scale = Math.min(
      1,
      MAX_WIDTH / source.width,
      MAX_HEIGHT / source.height,
    );
    canvas.width = Math.max(2, Math.floor((source.width * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.floor((source.height * scale) / 2) * 2);
    stream = canvas.captureStream(0);
    const [videoTrack] = stream.getVideoTracks();
    if (!videoTrack || !('requestFrame' in videoTrack)) {
      throw new Error('Manual canvas capture unavailable');
    }
    track = videoTrack as CanvasCaptureMediaStreamTrack;
    track.onended = () => {
      if (!finishing) {
        fail(new Error('Preview track ended'));
      }
    };
    recorder = new MediaRecorder(stream, {
      mimeType: mimeTypeOf(),
      videoBitsPerSecond: 1800000,
    });
    recorder.onerror = () => fail(new Error('Preview encoder failed'));
    recorder.ondataavailable = (event) => {
      size += event.data.size;
      if (size > MAX_PREVIEW_BYTES) {
        fail(new Error('Preview too large'));
        return;
      }
      if (event.data.size) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      if (settled) {
        return;
      }
      if (!finishing || !size) {
        fail(new Error('Preview stopped before completion'));
        return;
      }
      const blob = new Blob(chunks, { type: recorder?.mimeType });
      stream?.getTracks().forEach((item) => {
        item.onended = null;
        item.stop();
      });
      Promise.resolve(
        blob.type.startsWith('video/webm')
          ? finishPreviewWebm(blob, elapsedMs)
          : blob,
      )
        .then(async (finished) => {
          if (controller.signal.aborted) {
            throw abortError();
          }
          if (finished.size > MAX_PREVIEW_BYTES) {
            throw new Error('Preview too large');
          }
          progress({ phase: 'checking' });
          const metadata = await checkPreviewVideo(finished, controller.signal);
          if (controller.signal.aborted) {
            throw abortError();
          }
          settled = true;
          clean();
          complete({ blob: finished, ...metadata });
          return undefined;
        })
        .catch(fail);
    };
    recorder.start();
  };

  return {
    result,
    cancel: () => fail(abortError()),
    frame: (source, at) => {
      if (settled || finishing || source.width < 2 || source.height < 2) {
        return;
      }
      try {
        if (!recorder) {
          initialize(source);
        }
        // Chromium emits start only after capture supplies a frame. Waiting
        // for that event before requesting the first frame deadlocks a
        // manually driven canvas stream; start() sets recording synchronously.
        if (!context || !track || recorder?.state !== 'recording') {
          return;
        }
        if (lastAt !== undefined && at - lastAt < FRAME_MS) {
          return;
        }
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const fontSize = Math.max(11, Math.round(canvas.height / 32));
        context.font = `${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
        const padding = Math.round(fontSize * 0.7);
        const textWidth = context.measureText(watermark).width;
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(
          canvas.width - textWidth - padding * 3,
          canvas.height - fontSize - padding * 3,
          textWidth + padding * 2,
          fontSize + padding * 2,
        );
        context.fillStyle = '#fff';
        context.textBaseline = 'bottom';
        context.fillText(
          watermark,
          canvas.width - textWidth - padding * 2,
          canvas.height - padding * 2,
        );
        track.requestFrame();
        firstAt ??= at;
        lastAt = at;
        elapsedMs = at - firstAt;
        progress({
          phase: 'recording',
          elapsedMs: Math.min(PREVIEW_DURATION_MS, elapsedMs),
        });
        if (elapsedMs >= PREVIEW_DURATION_MS) {
          finishing = true;
          progress({ phase: 'encoding' });
          // stop flushes dataavailable followed by stop. Readiness is decided
          // by that lifecycle and successful decoding, never the countdown.
          recorder.stop();
        }
      } catch (error) {
        fail(
          error instanceof Error ? error : new Error('Preview capture failed'),
        );
      }
    },
  };
};
