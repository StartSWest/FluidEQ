/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * What the sending computer's transport bar is showing, as sent to the
 * listener.
 *
 * The listener plays sound it did not start and cannot see the source of, so
 * its own bar said "Nothing playing" while a whole song came through the
 * wire. This is the sender's bar description — a library track, a karaoke
 * session, a browser tab Windows reported — reduced to the fields another
 * machine can honestly draw. No artwork: the cover is a file or a blob URL on
 * the sender, and the bar generates a tile from the title anyway.
 */
export interface IRemoteNowPlaying {
  title: string;
  /** The line under the title: the artist, or the app where there is none. */
  subtitle?: string;
  /** The artist alone, for identifying the song. Absent where the subtitle
   * is an app name rather than an artist. */
  artist?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

/** The one transport command that reaches every player on the sender. */
export type TRemoteTransportCommand = 'toggle';

/** Small control messages; the lossless PCM stream travels separately. */
export type TRemoteAudioSignal =
  | { kind: 'peer-ready'; deviceName: string; address?: string }
  | { kind: 'stream-mode'; mode: TRemoteAudioStreamMode }
  /** Sender → listener. Absent `playing` means the sender's bar is empty. */
  | { kind: 'now-playing'; playing?: IRemoteNowPlaying }
  /** Listener → sender: a press on the listener's bar, carried out there. */
  | { kind: 'transport'; command: TRemoteTransportCommand }
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

export interface ILanRemoteAudioNetworkStats {
  bytesPerSecond: number;
  direction: 'receive' | 'send';
  peerId: string;
  queuedBytes: number;
  queuedMilliseconds: number;
}

export type TLanSavedRole = 'listener' | 'sender';
export type TRemoteAudioStopMode = 'keep-active' | 'pause' | 'forget';
export type TRemoteAudioStreamMode = 'music' | 'video';

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
 * `pcm` contains the restored interleaved IEEE-754 Float32 samples. Music mode
 * uses Zstandard and Video mode bypasses compression; AES-GCM and either wire
 * form preserve every captured bit, with no lossy media codec involved.
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

/** A count of milliseconds a peer could have measured: finite, not negative. */
const isMilliseconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Bounded the way `peer-ready` bounds its name: a peer holds the key, but a
 * peer is not trusted to size the listener's memory or its bar.
 */
export const isRemoteNowPlaying = (
  value: unknown,
): value is IRemoteNowPlaying =>
  isRecord(value) &&
  typeof value.title === 'string' &&
  value.title.trim().length > 0 &&
  value.title.length <= 256 &&
  (value.subtitle === undefined ||
    (typeof value.subtitle === 'string' && value.subtitle.length <= 256)) &&
  (value.artist === undefined ||
    (typeof value.artist === 'string' && value.artist.length <= 256)) &&
  typeof value.isPlaying === 'boolean' &&
  isMilliseconds(value.positionMs) &&
  isMilliseconds(value.durationMs);

export const isRemoteAudioSignal = (
  value: unknown,
): value is TRemoteAudioSignal =>
  isRecord(value) &&
  (value.kind === 'stop' ||
    (value.kind === 'now-playing' &&
      (value.playing === undefined || isRemoteNowPlaying(value.playing))) ||
    (value.kind === 'transport' && value.command === 'toggle') ||
    (value.kind === 'stream-mode' &&
      (value.mode === 'music' || value.mode === 'video')) ||
    (value.kind === 'peer-ready' &&
      typeof value.deviceName === 'string' &&
      value.deviceName.trim().length > 0 &&
      value.deviceName.length <= 128 &&
      (value.address === undefined ||
        (typeof value.address === 'string' && value.address.length <= 64))));
