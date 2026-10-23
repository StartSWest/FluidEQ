/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import { constants, zstdCompress, zstdDecompress } from 'zlib';
import type { RawData } from 'ws';
import {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  isLanRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  MAX_CODE_ADDRESSES,
  isPrivateIpv4,
  lanAddresses,
} from './remoteAudioLanAddresses';

const PAIRING_PREFIX = 'FLUIDEQ-LAN-2.';
const PACKET_AAD = Buffer.from('FluidEQ encrypted LAN audio v2', 'utf8');
export const PACKET_SIGNAL = 1;
export const PACKET_AUDIO = 2;
export const PACKET_AUTH_CHALLENGE = 3;
export const PACKET_AUTH_READY = 4;
export const PACKET_AUTH_ACCEPTED = 5;
const SEALED_HEADER_BYTES = 1 + 12 + 16;
const AUDIO_HEADER_BYTES = 4 + 4 + 1 + 2 + 1;
const AUDIO_RAW = 0;
const AUDIO_ZSTD = 1;
export const MAX_PACKET_BYTES = 512 * 1024;

export interface ILanPairingPayload {
  /** The first of `addresses`. */
  address: string;
  /** Every address the code names, best first; tried all at once. */
  addresses: string[];
  deviceName: string;
  port: number;
  secret: string;
}

export interface INormalizedAudioChunk {
  peerId: string;
  sequence: number;
  sampleRate: number;
  channels: number;
  frames: number;
  pcm: Buffer;
}

export interface IOpenedPacket {
  kind: number;
  clear: Buffer;
}

export interface ILanAuthChallenge {
  challenge: string;
}

export interface ILanAuthReady extends ILanAuthChallenge {
  deviceName: string;
  peerId: string;
  /**
   * The joining computer's own id (`computerIdOf`). Absent from a FluidEQ
   * from before all to all, which is linked as it always was.
   */
  computerId?: string;
  /** The first connection after somebody pasted the code by hand: a
   * computer unlinked earlier is let back in only on this. */
  fresh?: boolean;
}

export interface ILanAuthAccepted extends ILanAuthChallenge {
  peerId: string;
}

export { isPrivateIpv4, lanAddresses };

/**
 * A computer's identity on the network, from its own pairing secret.
 *
 * Every computer keeps one secret for good and the code that carries it, and
 * any number of computers link with it by pasting that one code (all to all:
 * each computer listens, and each joins the ones whose codes it was given).
 * The id lets two computers that each pasted the other's code tell that they
 * are one pair, and lets an unlinked computer be refused by name. It is a
 * hash: knowing it does not let anybody into a link.
 */
export const computerIdOf = (secret: string): string =>
  crypto
    .createHash('sha256')
    .update(`FluidEQ LAN computer\0${secret}`, 'utf8')
    .digest('base64url')
    .slice(0, 32);

const COMPUTER_ID = /^[A-Za-z0-9_-]{32}$/;

export const isComputerId = (value: unknown): value is string =>
  typeof value === 'string' && COMPUTER_ID.test(value);

/**
 * `address` stays the first of `addresses` so a FluidEQ from before one code
 * per computer still reads the code: it ignores the list and dials the first.
 */
export const encodePairingCode = (
  addresses: readonly string[] | string,
  port: number,
  secret: string,
  deviceName: string,
): string => {
  const list = (typeof addresses === 'string' ? [addresses] : [...addresses])
    .filter(isPrivateIpv4)
    .slice(0, MAX_CODE_ADDRESSES);
  return `${PAIRING_PREFIX}${Buffer.from(
    JSON.stringify({
      address: list[0] ?? '0.0.0.0',
      addresses: list,
      deviceName,
      port,
      secret,
    }),
    'utf8',
  ).toString('base64url')}`;
};

const invalidCode = () => new Error('Invalid FluidEQ LAN pairing code.');

export const decodePairingCode = (code: unknown): ILanPairingPayload => {
  if (
    typeof code !== 'string' ||
    code.length > 1_024 ||
    !code.startsWith(PAIRING_PREFIX)
  ) {
    throw invalidCode();
  }
  let value: unknown;
  try {
    value = JSON.parse(
      Buffer.from(code.slice(PAIRING_PREFIX.length), 'base64url').toString(
        'utf8',
      ),
    );
  } catch {
    throw invalidCode();
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidCode();
  }
  const payload = value as Record<string, unknown>;
  const listed = Array.isArray(payload.addresses) ? payload.addresses : [];
  const addresses = [
    ...new Set(
      [payload.address, ...listed].filter(
        (address): address is string =>
          typeof address === 'string' && isPrivateIpv4(address),
      ),
    ),
  ].slice(0, MAX_CODE_ADDRESSES);
  const { deviceName, port, secret } = payload;
  if (
    addresses.length === 0 ||
    listed.length > MAX_CODE_ADDRESSES ||
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    typeof secret !== 'string' ||
    secret.length < 40 ||
    secret.length > 64 ||
    (deviceName !== undefined &&
      (typeof deviceName !== 'string' ||
        deviceName.trim().length === 0 ||
        deviceName.length > 128))
  ) {
    throw invalidCode();
  }
  return {
    address: addresses[0],
    addresses,
    deviceName:
      (typeof deviceName === 'string' && deviceName.trim()) || addresses[0],
    port,
    secret,
  };
};

export const keyFromSecret = (secret: string): Buffer =>
  crypto.createHash('sha256').update(secret, 'utf8').digest();

export const createAuthChallenge = (): string =>
  crypto.randomBytes(32).toString('base64url');

export const deriveSessionKey = (
  pairingKey: Buffer,
  challenge: string,
  peerId: string,
): Buffer =>
  Buffer.from(
    crypto.hkdfSync(
      'sha256',
      pairingKey,
      Buffer.from(challenge, 'utf8'),
      Buffer.from(`FluidEQ LAN audio session ${peerId}`, 'utf8'),
      32,
    ),
  );

const asBuffer = (data: RawData): Buffer => {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
};

const packetAad = (kind: number): Buffer =>
  Buffer.concat([PACKET_AAD, Buffer.from([kind])]);

export const sealPacket = (
  kind: number,
  clear: Buffer,
  key: Buffer,
): Buffer => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(packetAad(kind));
  const ciphertext = Buffer.concat([cipher.update(clear), cipher.final()]);
  return Buffer.concat([
    Buffer.from([kind]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
};

export const openPacket = (data: RawData, key: Buffer): IOpenedPacket => {
  const packet = asBuffer(data);
  if (
    packet.byteLength < SEALED_HEADER_BYTES ||
    packet.byteLength > MAX_PACKET_BYTES
  ) {
    throw new Error('Invalid encrypted LAN packet size.');
  }
  const kind = packet[0];
  if (
    kind !== PACKET_SIGNAL &&
    kind !== PACKET_AUDIO &&
    kind !== PACKET_AUTH_CHALLENGE &&
    kind !== PACKET_AUTH_READY &&
    kind !== PACKET_AUTH_ACCEPTED
  ) {
    throw new Error('Invalid encrypted LAN packet type.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    packet.subarray(1, 13),
  );
  decipher.setAAD(packetAad(kind));
  decipher.setAuthTag(packet.subarray(13, SEALED_HEADER_BYTES));
  const clear = Buffer.concat([
    decipher.update(packet.subarray(SEALED_HEADER_BYTES)),
    decipher.final(),
  ]);
  return { kind, clear };
};

export const sealSignal = (
  message: ILanRemoteAudioSignal,
  key: Buffer,
): Buffer =>
  sealPacket(PACKET_SIGNAL, Buffer.from(JSON.stringify(message), 'utf8'), key);

export const openSignal = (clear: Buffer): ILanRemoteAudioSignal => {
  const message: unknown = JSON.parse(clear.toString('utf8'));
  if (!isLanRemoteAudioSignal(message)) {
    throw new Error('Invalid LAN control message.');
  }
  return message;
};

const authValue = (clear: Buffer): Record<string, unknown> => {
  const value: unknown = JSON.parse(clear.toString('utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid LAN authentication message.');
  }
  return value as Record<string, unknown>;
};

const validAuthToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

const sealAuthValue = (kind: number, value: object, key: Buffer): Buffer =>
  sealPacket(kind, Buffer.from(JSON.stringify(value), 'utf8'), key);

export const sealAuthChallenge = (challenge: string, key: Buffer): Buffer =>
  sealAuthValue(PACKET_AUTH_CHALLENGE, { challenge }, key);

export const openAuthChallenge = (clear: Buffer): ILanAuthChallenge => {
  const value = authValue(clear);
  if (!validAuthToken(value.challenge)) {
    throw new Error('Invalid LAN authentication challenge.');
  }
  return { challenge: value.challenge };
};

export const sealAuthReady = (ready: ILanAuthReady, key: Buffer): Buffer =>
  sealAuthValue(PACKET_AUTH_READY, ready, key);

export const openAuthReady = (clear: Buffer): ILanAuthReady => {
  const value = authValue(clear);
  if (
    !validAuthToken(value.challenge) ||
    typeof value.peerId !== 'string' ||
    value.peerId.length === 0 ||
    value.peerId.length > 128 ||
    typeof value.deviceName !== 'string' ||
    value.deviceName.trim().length === 0 ||
    value.deviceName.length > 128 ||
    (value.computerId !== undefined && !isComputerId(value.computerId)) ||
    (value.fresh !== undefined && typeof value.fresh !== 'boolean')
  ) {
    throw new Error('Invalid LAN authentication response.');
  }
  return {
    challenge: value.challenge,
    deviceName: value.deviceName.trim(),
    peerId: value.peerId,
    ...(isComputerId(value.computerId) ? { computerId: value.computerId } : {}),
    ...(value.fresh === true ? { fresh: true } : {}),
  };
};

export const sealAuthAccepted = (
  accepted: ILanAuthAccepted,
  key: Buffer,
): Buffer => sealAuthValue(PACKET_AUTH_ACCEPTED, accepted, key);

export const openAuthAccepted = (clear: Buffer): ILanAuthAccepted => {
  const value = authValue(clear);
  if (
    !validAuthToken(value.challenge) ||
    typeof value.peerId !== 'string' ||
    value.peerId.length === 0 ||
    value.peerId.length > 128
  ) {
    throw new Error('Invalid LAN authentication acknowledgement.');
  }
  return { challenge: value.challenge, peerId: value.peerId };
};

export const normalizeAudioChunk = (value: unknown): INormalizedAudioChunk => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid LAN audio chunk.');
  }
  const chunk = value as Partial<ILanRemoteAudioChunk>;
  const pcmValue = (value as Record<string, unknown>).pcm;
  let pcm: Buffer | undefined;
  if (pcmValue instanceof ArrayBuffer) {
    pcm = Buffer.from(pcmValue);
  } else if (ArrayBuffer.isView(pcmValue)) {
    pcm = Buffer.from(
      pcmValue.buffer,
      pcmValue.byteOffset,
      pcmValue.byteLength,
    );
  }
  if (
    typeof chunk.peerId !== 'string' ||
    chunk.peerId.length === 0 ||
    chunk.peerId.length > 128 ||
    !Number.isInteger(chunk.sequence) ||
    (chunk.sequence as number) < 0 ||
    (chunk.sequence as number) > 0xffff_ffff ||
    !Number.isInteger(chunk.sampleRate) ||
    (chunk.sampleRate as number) < 8_000 ||
    (chunk.sampleRate as number) > 384_000 ||
    !Number.isInteger(chunk.channels) ||
    (chunk.channels as number) < 1 ||
    (chunk.channels as number) > 8 ||
    !Number.isInteger(chunk.frames) ||
    (chunk.frames as number) < 1 ||
    (chunk.frames as number) > 8_192 ||
    !pcm ||
    pcm.byteLength !== (chunk.frames as number) * (chunk.channels as number) * 4
  ) {
    throw new Error('Invalid LAN audio chunk.');
  }
  return {
    peerId: chunk.peerId,
    sequence: chunk.sequence as number,
    sampleRate: chunk.sampleRate as number,
    channels: chunk.channels as number,
    frames: chunk.frames as number,
    pcm,
  };
};

/**
 * Zstandard runs in Node's worker pool so lossless transport cannot hold up
 * Electron's main event loop or the loopback-driven UI meters.
 */
const audioHeader = (chunk: INormalizedAudioChunk, compress: boolean) => {
  const header = Buffer.allocUnsafe(AUDIO_HEADER_BYTES);
  header.writeUInt32LE(chunk.sequence, 0);
  header.writeUInt32LE(chunk.sampleRate, 4);
  header.writeUInt8(chunk.channels, 8);
  header.writeUInt16LE(chunk.frames, 9);
  header.writeUInt8(compress ? AUDIO_ZSTD : AUDIO_RAW, 11);
  return header;
};

export const encodeAudioRaw = (chunk: INormalizedAudioChunk): Buffer =>
  Buffer.concat([audioHeader(chunk, false), chunk.pcm]);

export const encodeAudioAsync = async (
  chunk: INormalizedAudioChunk,
  compress = true,
): Promise<Buffer> => {
  if (!compress) {
    return encodeAudioRaw(chunk);
  }
  const compressed = await new Promise<Buffer>((resolve, reject) => {
    zstdCompress(
      chunk.pcm,
      { params: { [constants.ZSTD_c_compressionLevel]: 1 } },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
  return Buffer.concat([audioHeader(chunk, true), compressed]);
};

export const decodeAudioAsync = async (
  peerId: string,
  clear: Buffer,
): Promise<ILanRemoteAudioChunk> => {
  if (clear.byteLength < AUDIO_HEADER_BYTES) {
    throw new Error('Invalid LAN audio packet.');
  }
  const channels = clear.readUInt8(8);
  const frames = clear.readUInt16LE(9);
  if (channels < 1 || channels > 8 || frames < 1 || frames > 8_192) {
    throw new Error('Invalid LAN audio packet.');
  }
  const expectedPcmBytes = channels * frames * 4;
  const encoding = clear.readUInt8(11);
  const payload = clear.subarray(AUDIO_HEADER_BYTES);
  let pcm: Buffer;
  if (encoding === AUDIO_RAW && payload.byteLength === expectedPcmBytes) {
    pcm = payload;
  } else if (encoding === AUDIO_ZSTD) {
    try {
      pcm = await new Promise<Buffer>((resolve, reject) => {
        zstdDecompress(
          payload,
          { maxOutputLength: expectedPcmBytes },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
      });
    } catch {
      throw new Error('Invalid LAN audio packet.');
    }
  } else {
    throw new Error('Invalid LAN audio packet.');
  }
  const normalized = normalizeAudioChunk({
    peerId,
    sequence: clear.readUInt32LE(0),
    sampleRate: clear.readUInt32LE(4),
    channels,
    frames,
    pcm,
  });
  return {
    peerId,
    sequence: normalized.sequence,
    sampleRate: normalized.sampleRate,
    channels: normalized.channels,
    frames: normalized.frames,
    pcm: Uint8Array.from(normalized.pcm).buffer,
  };
};
