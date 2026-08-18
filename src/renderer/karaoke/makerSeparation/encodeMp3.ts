/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * MP3 alongside the WAV a split produces.
 *
 * WHY A LIBRARY AT ALL. Chromium decodes MP3 and cannot encode it — there is
 * no encoder behind any web API, and `MediaRecorder` offers Opus in WebM,
 * which is not what somebody asking for an MP3 wants. LAME is the encoder
 * everything else uses; `@breezystack/lamejs` is its JavaScript port, LGPL-3.0,
 * which combines into this GPL-3.0 program without friction. The MP3 patents
 * expired in 2017, so there is nothing else to clear.
 *
 * WHY NOT INSTEAD OF THE WAV. The WAV is what the rest of the app reads: it is
 * lossless, it is what the detectors are fed, and it is what a DAW should be
 * given. The MP3 is for carrying around — a fifth of the size and playable on
 * anything. Neither replaces the other, so both are written.
 */

/**
 * 192 kbps joint stereo.
 *
 * These are backing tracks and isolated voices that have already been through
 * a separation model, so they carry artefacts a codec will happily spend bits
 * describing. 128 makes those artefacts audible as swirl on the cymbals; 320
 * doubles the file to encode noise more faithfully. 192 is where a stem stops
 * sounding worse than the split already made it.
 */
const MP3_KBPS = 192;

/**
 * The block size LAME wants, and it is not negotiable.
 *
 * An MP3 frame is 1152 samples. Handing `encodeBuffer` anything else still
 * works but makes it buffer internally across calls, which costs a copy per
 * block for no reason when the loop can simply walk in the right stride.
 */
const LAME_BLOCK = 1152;

/**
 * How many blocks to encode before letting the window breathe.
 *
 * A four-minute stereo stem is about nine thousand blocks and several seconds
 * of solid arithmetic. Run as one loop it freezes the renderer — no repaint,
 * no progress, a window Windows will offer to close for you. Yielding every
 * 64 blocks (~1.7 seconds of audio) keeps frames flowing at a cost far below
 * the encoding itself.
 */
const BLOCKS_PER_YIELD = 64;

const toInt16 = (samples: Float32Array): Int16Array => {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    // Clamped before scaling: a stem reconstructed from a mask can exceed
    // unity, and letting that wrap round is the difference between a loud
    // moment and a burst of white noise at the loudest point in the song.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    out[i] = Math.round(clamped * 32767);
  }
  return out;
};

/** Give the event loop a turn, so the window keeps painting mid-encode. */
const yieldToRenderer = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

export interface IEncodeMp3Options {
  /** 0..1, called as blocks complete, for a caller that shows progress. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Encode an already-decoded pair of channels as an MP3 file.
 *
 * Mono in, mono out: handing LAME a duplicated channel would double the
 * bitrate spent on a signal with no stereo information in it.
 */
export const encodeChannelsAsMp3 = async (
  left: Float32Array,
  right: Float32Array | undefined,
  sampleRate: number,
  name: string,
  { onProgress, signal }: IEncodeMp3Options = {},
): Promise<File> => {
  const isStereo = Boolean(right && right !== left);
  const encoder = new Mp3Encoder(isStereo ? 2 : 1, sampleRate, MP3_KBPS);
  const leftPcm = toInt16(left);
  const rightPcm = isStereo && right ? toInt16(right) : undefined;
  const chunks: Uint8Array[] = [];
  const totalBlocks = Math.ceil(leftPcm.length / LAME_BLOCK) || 1;

  for (let block = 0; block < totalBlocks; block += 1) {
    const start = block * LAME_BLOCK;
    const encoded = encoder.encodeBuffer(
      leftPcm.subarray(start, start + LAME_BLOCK),
      rightPcm?.subarray(start, start + LAME_BLOCK),
    );
    if (encoded.length > 0) {
      chunks.push(encoded);
    }
    if (block % BLOCKS_PER_YIELD === BLOCKS_PER_YIELD - 1) {
      onProgress?.(block / totalBlocks);
      // eslint-disable-next-line no-await-in-loop -- the yield is the point:
      // this loop is deliberately paced so the renderer can paint between
      // batches, which parallelising would defeat.
      await yieldToRenderer();
      if (signal?.aborted) {
        throw new DOMException('MP3 encoding cancelled.', 'AbortError');
      }
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) {
    chunks.push(tail);
  }
  onProgress?.(1);
  // Cast through a plain array of views: `BlobPart` does not accept a
  // `Uint8Array<ArrayBufferLike>` union directly under this TS lib target,
  // and every chunk here is a real ArrayBuffer-backed view.
  return new File(chunks as BlobPart[], name, { type: 'audio/mpeg' });
};

/**
 * Decode any audio file this build can read, then encode it as MP3.
 *
 * Decoded rather than transcoded from the WAV bytes on purpose: the caller may
 * hand this a stem the user loaded themselves, in whatever format they had, and
 * `decodeAudioData` is the one path that copes with all of them. It also means
 * the MP3 keeps the source's own sample rate instead of being pinned to the
 * separation model's.
 */
export const encodeFileAsMp3 = async (
  file: File,
  name: string,
  options: IEncodeMp3Options = {},
): Promise<File> => {
  // Length and rate are placeholders: `decodeAudioData` reports the file's own
  // and ignores what the context was constructed with.
  const context = new OfflineAudioContext(2, 1, 44_100);
  const decoded = await context.decodeAudioData(await file.arrayBuffer());
  const left = decoded.getChannelData(0);
  const right =
    decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : undefined;
  return encodeChannelsAsMp3(left, right, decoded.sampleRate, name, options);
};
