/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from '../common/remoteAudio';

/**
 * Each linked computer's own volume, applied to its sound as it arrives and
 * before either player has it — the LAN audio helper on Windows, the window
 * elsewhere — so the one rule holds on both.
 *
 * At full volume a chunk passes through as it came, so what plays is still
 * the other computer's samples bit for bit. A change of volume never steps:
 * the chunk it lands on ramps from the level before to the new one across
 * its frames, as a fader does, because a gain that jumps between two samples
 * is a click.
 */
const createRemoteAudioLevels = () => {
  const playing = new Map<string, number>();
  return {
    apply(chunk: ILanRemoteAudioChunk, level: number): ILanRemoteAudioChunk {
      const from = playing.get(chunk.peerId) ?? level;
      playing.set(chunk.peerId, level);
      if (from === 1 && level === 1) {
        return chunk;
      }
      const input = new Float32Array(chunk.pcm);
      const output = new Float32Array(input.length);
      const { channels, frames } = chunk;
      const step = frames > 0 ? (level - from) / frames : 0;
      for (let frame = 0; frame < frames; frame += 1) {
        const gain = from + step * (frame + 1);
        for (let channel = 0; channel < channels; channel += 1) {
          const at = frame * channels + channel;
          output[at] = input[at] * gain;
        }
      }
      return { ...chunk, pcm: output.buffer };
    },
    /** A computer that left starts at its own level when it comes back. */
    forget(peerId: string): void {
      playing.delete(peerId);
    },
  };
};

export default createRemoteAudioLevels;
