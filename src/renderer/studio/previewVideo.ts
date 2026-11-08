import {
  MAX_PREVIEW_BYTES,
  PREVIEW_DURATION_MS,
  PREVIEW_MAX_HEIGHT as MAX_HEIGHT,
  PREVIEW_MAX_WIDTH as MAX_WIDTH,
  SCENE_PREVIEW_MP4_CODEC,
  SCENE_PREVIEW_VP8_CODEC,
  SCENE_PREVIEW_VP9_CODEC,
} from 'common/scenePreviewMedia';
import finishPreviewWebm from './previewWebm';

export {
  MAX_PREVIEW_BYTES,
  PREVIEW_DURATION_MS,
} from 'common/scenePreviewMedia';
const FRAME_MS = 1000 / 30;

export interface IPreviewVideo {
  blob: Blob;
  durationMs: number;
  width: number;
  height: number;
}

export type TPreviewVideoProgress =
  | { phase: 'preparing' | 'encoding' | 'checking' }
  | { phase: 'recording' | 'paused'; elapsedMs: number };

export interface IPreviewVideoRecorder {
  /** Called only after the scene's renderer has produced a real frame. */
  frame(canvas: HTMLCanvasElement, at: number): void;
  /**
   * Holds the take while nothing is heard and carries it on from the same
   * second when sound comes back (Ivan, 2026-11-07: a take that started
   * again at every quiet moment pushed the dialog down and up and could
   * never finish over speech or a song with pauses).
   */
  pause(): void;
  resume(): void;
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

interface IRecordingFormat {
  type: string;
  width: number;
  height: number;
  bitsPerSecond: number;
}

/** What a clip is recorded as, best first (Ivan, 2026-11-07: "the video
 * quality still low ... more res while keeping it low in capacity"). VP9 at
 * 1280x720: Chromium's recorder fits ten seconds of a busy 720p canvas at
 * 1.1 Mbit/s in 1.2 MB, so 1.05 Mbit/s keeps a busy scene a fifth under the
 * 1.5 MiB cap. VP8 and H.264 stay at the 854x480 and 950 kbit/s they were
 * tuned at (native 854x480 Alpine: ~1.0 MiB, foliage still clean): either
 * at 720p in the same bytes would be softer than VP9, not sharper. */
const FORMATS: readonly IRecordingFormat[] = [
  {
    type: SCENE_PREVIEW_VP9_CODEC,
    width: 1280,
    height: 720,
    bitsPerSecond: 1050000,
  },
  {
    type: SCENE_PREVIEW_VP8_CODEC,
    width: 854,
    height: 480,
    bitsPerSecond: 950000,
  },
  {
    type: SCENE_PREVIEW_MP4_CODEC,
    width: 854,
    height: 480,
    bitsPerSecond: 950000,
  },
];

const formatOf = (): IRecordingFormat => {
  const video = document.createElement('video');
  const format = FORMATS.find(
    ({ type }) =>
      MediaRecorder.isTypeSupported(type) && video.canPlayType(type) !== '',
  );
  if (!format) {
    throw new Error('No supported preview codec');
  }
  return format;
};

/** The size the scene is drawn at for its clip: the format's own, so every
 * pixel recorded was rendered and none is enlarged. With no format to record
 * in, the stage still needs a size; the recording then fails on its own. */
export const previewCaptureSize = (): { width: number; height: number } => {
  if (typeof MediaRecorder === 'undefined') {
    return { width: FORMATS[1].width, height: FORMATS[1].height };
  }
  try {
    const { width, height } = formatOf();
    return { width, height };
  } catch {
    return { width: FORMATS[1].width, height: FORMATS[1].height };
  }
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
  // The take's own clock: `at` less every second it was held, so a pause
  // leaves no gap in the clip and the countdown carries on where it stopped.
  let origin: number | undefined;
  let lastAt: number | undefined;
  let lastSlot = -1;
  let elapsedMs = 0;
  let paused = false;
  let resuming = false;
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
    const format = formatOf();
    const scale = Math.min(
      1,
      format.width / source.width,
      format.height / source.height,
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
      mimeType: format.type,
      videoBitsPerSecond: format.bitsPerSecond,
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
    pause: () => {
      if (settled || finishing || paused) {
        return;
      }
      paused = true;
      // The encoder's own pause leaves the held time out of the clip's
      // timeline; frames simply stop being requested while it lasts.
      if (recorder?.state === 'recording') {
        recorder.pause();
      }
      progress({ phase: 'paused', elapsedMs });
    },
    resume: () => {
      if (settled || finishing || !paused) {
        return;
      }
      paused = false;
      resuming = lastAt !== undefined;
      if (recorder?.state === 'paused') {
        recorder.resume();
      }
      progress(
        lastAt === undefined
          ? { phase: 'preparing' }
          : { phase: 'recording', elapsedMs },
      );
    },
    frame: (source, at) => {
      if (
        settled ||
        finishing ||
        paused ||
        source.width < 2 ||
        source.height < 2
      ) {
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
        if (resuming && origin !== undefined && lastAt !== undefined) {
          // The first frame after a pause is one frame after the last kept.
          origin += at - lastAt - FRAME_MS;
          resuming = false;
        }
        const slot = Math.floor((at - (origin ?? at)) / FRAME_MS);
        if (lastAt !== undefined && slot === lastSlot) {
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
        origin ??= at;
        lastAt = at;
        lastSlot = slot;
        elapsedMs = at - origin;
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
