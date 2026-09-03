/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/** Small control messages; the lossless PCM stream travels separately. */
export type TRemoteAudioSignal = { kind: 'peer-ready' } | { kind: 'stop' };

export interface ILanPairingOption {
  address: string;
  code: string;
}

export interface ILanHostDetails {
  options: ILanPairingOption[];
}

/** One sender's control message, routed by the listening computer. */
export interface ILanRemoteAudioSignal {
  peerId: string;
  signal: TRemoteAudioSignal;
}

/**
 * Uncompressed samples from one sender.
 *
 * `pcm` contains interleaved IEEE-754 Float32 samples. The byte-for-byte
 * capture values are encrypted and transferred without a codec or a lossy
 * conversion.
 */
export interface ILanRemoteAudioChunk {
  peerId: string;
  sequence: number;
  sampleRate: number;
  channels: number;
  frames: number;
  pcm: ArrayBuffer;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isLanRemoteAudioSignal = (
  value: unknown,
): value is ILanRemoteAudioSignal =>
  isRecord(value) &&
  typeof value.peerId === 'string' &&
  value.peerId.length > 0 &&
  value.peerId.length <= 128 &&
  isRemoteAudioSignal(value.signal);

export const isRemoteAudioSignal = (
  value: unknown,
): value is TRemoteAudioSignal =>
  isRecord(value) && (value.kind === 'peer-ready' || value.kind === 'stop');
