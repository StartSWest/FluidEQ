import { createMomentRecorder } from '../../../renderer/studio/momentRecorder';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';

const frame = (timeSeconds: number, deltaMs: number = 10): ISceneFrame => ({
  timeSeconds,
  deltaMs,
  level: 0.7,
  beat: 1,
  bands: [0.2, 0.4, 0.6],
  accent: [0.1, 0.3, 0.5],
  fade: 0.8,
  spectrumRect: [0, 0, 1, 1],
  spectrum: new Uint8Array([10, 20]),
  waveform: new Uint8Array([30, 40]),
  params: { speed: 0.5 },
});

describe('recording the moment for a picture', () => {
  it('starts empty and copies reusable measured buffers at record time', () => {
    const recorder = createMomentRecorder();
    expect(recorder.moment()).toEqual([]);
    const heard = frame(1);
    recorder.record(heard);
    heard.spectrum.fill(255);
    heard.waveform.fill(0);
    expect(recorder.moment()).toEqual([frame(1)]);
  });

  it('returns independent texture copies that survive ring reuse and caller edits', () => {
    const recorder = createMomentRecorder();
    recorder.record(frame(0, 0));
    const captured = recorder.moment();
    captured[0].spectrum.fill(77);
    captured[0].waveform.fill(88);
    expect(recorder.moment()[0]).toEqual(frame(0, 0));
    for (let index = 1; index <= 721; index += 1) {
      recorder.record({
        ...frame(index, 0),
        level: 0.1,
        spectrum: new Uint8Array([1, 2]),
      });
    }
    expect(captured[0].timeSeconds).toBe(0);
    expect(captured[0].level).toBe(0.7);
    expect(captured[0].spectrum).toEqual(new Uint8Array([77, 77]));
    expect(captured[0].waveform).toEqual(new Uint8Array([88, 88]));
  });

  it('keeps the most recent three seconds oldest first, including the selected frame', () => {
    const recorder = createMomentRecorder();
    for (let index = 0; index < 40; index += 1) {
      recorder.record(frame(index / 10, 100));
    }
    const captured = recorder.moment();
    expect(captured).toHaveLength(30);
    expect(captured.map((item) => item.timeSeconds)).toEqual(
      Array.from({ length: 30 }, (_, index) => (index + 10) / 10),
    );
  });

  it.each([0, undefined])(
    'caps history at 720 frames when elapsed time is %s',
    (deltaMs) => {
      const recorder = createMomentRecorder();
      for (let index = 0; index < 750; index += 1) {
        recorder.record({ ...frame(index), deltaMs });
      }
      expect(recorder.moment().map((item) => item.timeSeconds)).toEqual(
        Array.from({ length: 720 }, (_, index) => index + 30),
      );
    },
  );

  it('uses the runner clock cap after a pause instead of discarding the warm-up history', () => {
    const recorder = createMomentRecorder();
    for (let index = 0; index < 40; index += 1) {
      recorder.record(frame(index, 100));
    }
    recorder.record(frame(100, 60_000));
    expect(recorder.moment()).toHaveLength(30);
    expect(recorder.moment()[0].timeSeconds).toBe(1.1 * 10);
    expect(recorder.moment()[29].timeSeconds).toBe(100);
  });

  it('accepts different texture sizes when a ring slot is reused', () => {
    const recorder = createMomentRecorder();
    for (let index = 0; index < 720; index += 1) {
      recorder.record(frame(index, 0));
    }
    const resized = {
      ...frame(720, 0),
      spectrum: new Uint8Array([1, 2, 3]),
      waveform: new Uint8Array([4]),
    };
    recorder.record(resized);
    expect(recorder.moment()[719]).toEqual(resized);
    resized.spectrum.fill(0);
    expect(recorder.moment()[719].spectrum).toEqual(new Uint8Array([1, 2, 3]));
  });
});
