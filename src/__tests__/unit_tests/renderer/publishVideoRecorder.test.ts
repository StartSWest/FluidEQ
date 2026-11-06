import {
  createPreviewVideoRecorder,
  MAX_PREVIEW_BYTES,
  PREVIEW_DURATION_MS,
} from '../../../renderer/studio/previewVideo';

class Recorder {
  static isTypeSupported = () => true;

  static instances: Recorder[] = [];

  state: RecordingState = 'inactive';

  mimeType = 'video/mp4';

  onstart: (() => void) | null = null;

  onstop: (() => void) | null = null;

  onerror: (() => void) | null = null;

  ondataavailable: ((event: Pick<BlobEvent, 'data'>) => void) | null = null;

  start = jest.fn(() => {
    this.state = 'recording';
  });

  stop = jest.fn(() => {
    this.state = 'inactive';
  });

  options: MediaRecorderOptions | undefined;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.options = options;
    Recorder.instances.push(this);
  }

  finish(data = new Blob(['video'], { type: 'video/mp4' })) {
    this.ondataavailable?.({ data });
    this.onstop?.();
  }
}

const stopTrack = jest.fn();
const requestFrame = jest.fn();
const track = { stop: stopTrack, requestFrame, onended: null };
const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
const context = {
  drawImage: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  measureText: () => ({ width: 150 }),
  font: '',
  fillStyle: '',
  textBaseline: '',
};
const originalRecorder = globalThis.MediaRecorder;
const createUrl = jest.fn(() => 'blob:decoded-preview');
const revokeUrl = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Recorder.instances = [];
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: Recorder,
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeUrl,
  });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
    configurable: true,
    value: jest.fn(() => stream),
  });
  jest
    .spyOn(HTMLMediaElement.prototype, 'canPlayType')
    .mockReturnValue('probably');
  jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(function play(this: HTMLMediaElement) {
      this.currentTime = 10;
      queueMicrotask(() => this.dispatchEvent(new Event('ended')));
      return Promise.resolve();
    });
  jest
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(function load(this: HTMLMediaElement) {
      if (!this.getAttribute('src')) {
        return;
      }
      Object.defineProperties(this, {
        duration: { configurable: true, value: 10 },
        videoWidth: { configurable: true, value: 640 },
        videoHeight: { configurable: true, value: 360 },
      });
      queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')));
    });
});

// A recording a test leaves open keeps its visibility listener on the shared
// document, and a later test's visibilitychange fails it with nobody waiting:
// an unhandled rejection that ends the run instead of reporting the
// assertion that left it open.
const open: ReturnType<typeof createPreviewVideoRecorder>[] = [];
const record = (
  ...args: Parameters<typeof createPreviewVideoRecorder>
): ReturnType<typeof createPreviewVideoRecorder> => {
  const recording = createPreviewVideoRecorder(...args);
  open.push(recording);
  return recording;
};

afterEach(() => {
  open.splice(0).forEach((recording) => {
    recording.result.catch(() => undefined);
    recording.cancel();
  });
  jest.restoreAllMocks();
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: originalRecorder,
  });
});

const source = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
};

it('starts on a real canvas frame without waiting for the recorder start event', async () => {
  const progress = jest.fn();
  const recording = record('FluidEQ Plus · Preview', progress);
  expect(Recorder.instances).toHaveLength(0);
  recording.frame(source(), 2000);
  expect(requestFrame).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith({
    phase: 'recording',
    elapsedMs: 0,
  });
  // A 1920x1080 stage fits 854x480 at most, the width kept even: 852x480.
  expect(context.drawImage).toHaveBeenCalledWith(
    expect.any(HTMLCanvasElement),
    0,
    0,
    852,
    480,
  );
  // About 0.6 MB a clip, which one clip per published scene is sized for.
  expect(Recorder.instances[0].options).toMatchObject({
    videoBitsPerSecond: 700000,
  });
  expect(context.fillText).toHaveBeenCalledWith(
    'FluidEQ Plus · Preview',
    expect.any(Number),
    expect.any(Number),
  );
  recording.cancel();
  await expect(recording.result).rejects.toMatchObject({ name: 'AbortError' });
});

it('finishes after ten seconds of captured frames, then waits for stop and decoding', async () => {
  const progress = jest.fn();
  const recording = record('Preview', progress);
  const canvas = source();
  recording.frame(canvas, 5000);
  recording.frame(canvas, 5000 + PREVIEW_DURATION_MS - 1);
  const [encoder] = Recorder.instances;
  expect(encoder.stop).not.toHaveBeenCalled();
  recording.frame(canvas, 5000 + PREVIEW_DURATION_MS + 40);
  expect(encoder.stop).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith({ phase: 'encoding' });
  let ready = false;
  recording.result.then(() => {
    ready = true;
    return undefined;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  encoder.finish();
  await expect(recording.result).resolves.toMatchObject({
    durationMs: 10000,
    width: 640,
    height: 360,
  });
  expect(stopTrack).toHaveBeenCalled();
  expect(revokeUrl).toHaveBeenCalledWith('blob:decoded-preview');
  expect(progress).toHaveBeenLastCalledWith({ phase: 'checking' });
});

it.each(['cancel', 'error', 'ended'] as const)(
  'stops tracks and rejects on %s',
  async (cause) => {
    const recording = record('Preview', jest.fn());
    recording.frame(source(), 1000);
    const [encoder] = Recorder.instances;
    if (cause === 'cancel') {
      recording.cancel();
    }
    if (cause === 'error') {
      encoder.onerror?.();
    }
    if (cause === 'ended') {
      const ended = track.onended as (() => void) | null;
      ended?.();
    }
    await expect(recording.result).rejects.toBeInstanceOf(Error);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(encoder.stop).toHaveBeenCalledTimes(1);
    const previous = requestFrame.mock.calls.length;
    recording.frame(source(), 20000);
    expect(requestFrame).toHaveBeenCalledTimes(previous);
  },
);

it('refuses oversized encoder output and releases every capture track', async () => {
  const recording = record('Preview', jest.fn());
  recording.frame(source(), 1000);
  recording.frame(source(), 11000);
  Recorder.instances[0].finish(
    new Blob([new Uint8Array(MAX_PREVIEW_BYTES + 1)]),
  );
  await expect(recording.result).rejects.toThrow('Preview too large');
  expect(stopTrack).toHaveBeenCalled();
});

it('refuses interruption by page visibility instead of counting unseen time', async () => {
  const recording = record('Preview', jest.fn());
  recording.frame(source(), 1000);
  const visibility = jest
    .spyOn(document, 'hidden', 'get')
    .mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  await expect(recording.result).rejects.toThrow('Preview view hidden');
  visibility.mockRestore();
  expect(stopTrack).toHaveBeenCalledTimes(1);
});
