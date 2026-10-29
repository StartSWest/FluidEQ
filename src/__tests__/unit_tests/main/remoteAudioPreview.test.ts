/* FluidEQ — GPL-3.0-or-later */
import {
  createRemoteAudioPreview,
  REMOTE_AUDIO_ANALYSIS_FRAMES,
} from '../../../common/remoteAudioPreview';
import { createSenderSpectrum } from '../../../renderer/remoteAudio/senderSpectrum';
import type { ILanRemoteAudioChunk } from '../../../common/remoteAudio';

const chunk = (sequence: number, frames = 240): ILanRemoteAudioChunk => {
  const pcm = new Float32Array(frames * 2);
  for (let frame = 0; frame < frames; frame += 1) {
    pcm[frame * 2] =
      Math.sin(((sequence * frames + frame) * 2 * Math.PI * 997) / 48000) *
      0.25;
    pcm[frame * 2 + 1] = -pcm[frame * 2];
  }
  return {
    peerId: '',
    sampleRate: 48000,
    channels: 2,
    sequence,
    frames,
    pcm: pcm.buffer,
  };
};

it('preserves the exact contiguous spectrum, waveform and channel peaks when UI frames are sparse', () => {
  const full = createSenderSpectrum();
  const displayed = createSenderSpectrum();
  const preview = createRemoteAudioPreview();
  const snapshots: {
    frames: number;
    actual: ReturnType<typeof full.read>;
    expected: ReturnType<typeof full.read>;
  }[] = [];
  for (let sequence = 0; sequence < 100; sequence += 1) {
    const source = chunk(sequence);
    preview.push(source);
    full.push(source);
    if (sequence % 7 === 0) {
      const frame = preview.read();
      if (frame) {
        displayed.push(frame);
        snapshots.push({
          frames: frame.frames,
          actual: displayed.read(),
          expected: full.read(),
        });
      }
    }
  }
  expect(displayed.read()).toBeDefined();
  expect(snapshots.length).toBeGreaterThan(0);
  snapshots.forEach((snapshot) => {
    expect(snapshot.frames).toBe(REMOTE_AUDIO_ANALYSIS_FRAMES);
    expect(snapshot.actual).toEqual(snapshot.expected);
  });
});

it('starts again on a real source gap instead of combining stale and new audio', () => {
  const preview = createRemoteAudioPreview();
  for (let sequence = 0; sequence < 10; sequence += 1) {
    preview.push(chunk(sequence));
  }
  expect(preview.read()).toBeDefined();
  preview.push(chunk(20));
  expect(preview.read()).toBeUndefined();
  for (let sequence = 21; sequence < 30; sequence += 1) {
    preview.push(chunk(sequence));
  }
  expect(preview.read()).toBeDefined();
});

it('keeps contiguous PCM through sequence rollover and resets on a format change', () => {
  const preview = createRemoteAudioPreview();
  preview.push(chunk(0xffff_ffff, 1200));
  preview.push(chunk(0, 1200));
  expect(preview.read()).toBeDefined();
  preview.push({ ...chunk(1), sampleRate: 96000 });
  expect(preview.read()).toBeUndefined();
});
