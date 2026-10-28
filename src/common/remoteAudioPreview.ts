/* FluidEQ — GPL-3.0-or-later */
import type { ILanRemoteAudioChunk } from './remoteAudio';

export const REMOTE_AUDIO_ANALYSIS_FRAMES = 2048;

/** Send a complete contiguous analysis window, rather than decimated 5 ms
 * fragments that never fill an FFT. This is a UI copy, never playback PCM. */
export const createRemoteAudioPreview = () => {
  let ring = new Float32Array(0);
  let rate = 0;
  let channels = 0;
  let cursor = 0;
  let filled = 0;
  let sequence = 0;
  let expected: number | undefined;
  return {
    push(chunk: ILanRemoteAudioChunk) {
      if (
        rate !== chunk.sampleRate ||
        channels !== chunk.channels ||
        expected !== chunk.sequence
      ) {
        rate = chunk.sampleRate;
        channels = chunk.channels;
        ring = new Float32Array(REMOTE_AUDIO_ANALYSIS_FRAMES * channels);
        cursor = 0;
        filled = 0;
      }
      expected = chunk.sequence === 0xffff_ffff ? 0 : chunk.sequence + 1;
      const samples = new Float32Array(chunk.pcm);
      if (samples.length >= ring.length) {
        ring.set(samples.subarray(samples.length - ring.length));
        cursor = 0;
        filled = ring.length;
      } else {
        const first = Math.min(samples.length, ring.length - cursor);
        ring.set(samples.subarray(0, first), cursor);
        ring.set(samples.subarray(first));
        cursor = (cursor + samples.length) % ring.length;
        filled = Math.min(ring.length, filled + samples.length);
      }
    },
    read(): ILanRemoteAudioChunk | undefined {
      if (filled === 0 || filled < ring.length) {
        return undefined;
      }
      const pcm = new Float32Array(ring.length);
      pcm.set(ring.subarray(cursor));
      pcm.set(ring.subarray(0, cursor), ring.length - cursor);
      const frame = {
        peerId: '',
        sampleRate: rate,
        channels,
        frames: REMOTE_AUDIO_ANALYSIS_FRAMES,
        sequence,
        pcm: pcm.buffer,
      };
      sequence = sequence === 0xffff_ffff ? 0 : sequence + 1;
      return frame;
    },
  };
};
