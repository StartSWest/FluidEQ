/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/** Small control messages; the lossless PCM stream travels separately. */
export type TRemoteAudioSignal =
  | { kind: 'peer-ready'; deviceName: string; address?: string }
  | { kind: 'stop' };

export interface ILanPairingOption {
  address: string;
  code: string;
  deviceName: string;
}

export interface ILanHostDetails {
  deviceName: string;
  options: ILanPairingOption[];
}

export interface ILanRemoteComputer {
  address: string;
  deviceName: string;
  peerId: string;
}

export type TLanSavedRole = 'listener' | 'sender';

export type TLanRestoreResult =
  | { role: 'listener'; details: ILanHostDetails }
  | { role: 'sender'; listener: ILanRemoteComputer };

/** One sender's control message, routed by the listening computer. */
export interface ILanRemoteAudioSignal {
  peerId: string;
  signal: TRemoteAudioSignal;
}

/**
 * Losslessly compressed samples from one sender.
 *
 * `pcm` contains the restored interleaved IEEE-754 Float32 samples. Zstandard
 * compression and AES-GCM encryption preserve every captured bit; no lossy
 * media codec is involved.
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
  isRecord(value) &&
  (value.kind === 'stop' ||
    (value.kind === 'peer-ready' &&
      typeof value.deviceName === 'string' &&
      value.deviceName.trim().length > 0 &&
      value.deviceName.length <= 128 &&
      (value.address === undefined ||
        (typeof value.address === 'string' && value.address.length <= 64))));
