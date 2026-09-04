/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import os from 'os';
import {
  constants,
  zstdCompress,
  zstdCompressSync,
  zstdDecompress,
  zstdDecompressSync,
} from 'zlib';
import type { RawData } from 'ws';
import {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  isLanRemoteAudioSignal,
} from '../common/remoteAudio';

const PAIRING_PREFIX = 'FLUIDEQ-LAN-2.';
const PACKET_AAD = Buffer.from('FluidEQ encrypted LAN audio v2', 'utf8');
export const PACKET_SIGNAL = 1;
export const PACKET_AUDIO = 2;
const SEALED_HEADER_BYTES = 1 + 12 + 16;
const AUDIO_HEADER_BYTES = 4 + 4 + 1 + 2 + 1;
const AUDIO_RAW = 0;
const AUDIO_ZSTD = 1;
export const MAX_PACKET_BYTES = 512 * 1024;

export interface ILanPairingPayload {
  address: string;
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

export const isPrivateIpv4 = (address: string): boolean => {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
};

export const lanAddresses = (): string[] => {
  const addresses = Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter(
      (entry) =>
        entry.family === 'IPv4' &&
        !entry.internal &&
        isPrivateIpv4(entry.address),
    )
    .map((entry) => entry.address);
  return [...new Set(addresses)].sort((left, right) => {
    const rank = (address: string) => {
      if (address.startsWith('192.168.')) {
        return 0;
      }
      if (address.startsWith('10.')) {
        return 1;
      }
      if (address.startsWith('172.')) {
        return 2;
      }
      return 3;
    };
    return rank(left) - rank(right) || left.localeCompare(right);
  });
};

export const encodePairingCode = (
  address: string,
  port: number,
  secret: string,
  deviceName: string,
): string =>
  `${PAIRING_PREFIX}${Buffer.from(
    JSON.stringify({ address, deviceName, port, secret }),
    'utf8',
  ).toString('base64url')}`;

export const decodePairingCode = (code: unknown): ILanPairingPayload => {
  if (
    typeof code !== 'string' ||
    code.length > 1_024 ||
    !code.startsWith(PAIRING_PREFIX)
  ) {
    throw new Error('Invalid FluidEQ LAN pairing code.');
  }
  let value: unknown;
  try {
    value = JSON.parse(
      Buffer.from(code.slice(PAIRING_PREFIX.length), 'base64url').toString(
        'utf8',
      ),
    );
  } catch {
    throw new Error('Invalid FluidEQ LAN pairing code.');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as ILanPairingPayload).address !== 'string' ||
    !isPrivateIpv4((value as ILanPairingPayload).address) ||
    !Number.isInteger((value as ILanPairingPayload).port) ||
    (value as ILanPairingPayload).port < 1 ||
    (value as ILanPairingPayload).port > 65_535 ||
    typeof (value as ILanPairingPayload).secret !== 'string' ||
    (value as ILanPairingPayload).secret.length < 40 ||
    (value as ILanPairingPayload).secret.length > 64 ||
    ((value as Partial<ILanPairingPayload>).deviceName !== undefined &&
      (typeof (value as ILanPairingPayload).deviceName !== 'string' ||
        (value as ILanPairingPayload).deviceName.trim().length === 0 ||
        (value as ILanPairingPayload).deviceName.length > 128))
  ) {
    throw new Error('Invalid FluidEQ LAN pairing code.');
  }
  const payload = value as Partial<ILanPairingPayload> &
    Pick<ILanPairingPayload, 'address' | 'port' | 'secret'>;
  return {
    address: payload.address,
    deviceName: payload.deviceName?.trim() || payload.address,
    port: payload.port,
    secret: payload.secret,
  };
};

export const keyFromSecret = (secret: string): Buffer =>
  crypto.createHash('sha256').update(secret, 'utf8').digest();

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
  if (kind !== PACKET_SIGNAL && kind !== PACKET_AUDIO) {
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

export const encodeAudio = (
  chunk: INormalizedAudioChunk,
  compress = true,
): Buffer => {
  const header = Buffer.allocUnsafe(AUDIO_HEADER_BYTES);
  header.writeUInt32LE(chunk.sequence, 0);
  header.writeUInt32LE(chunk.sampleRate, 4);
  header.writeUInt8(chunk.channels, 8);
  header.writeUInt16LE(chunk.frames, 9);
  header.writeUInt8(compress ? AUDIO_ZSTD : AUDIO_RAW, 11);
  if (!compress) {
    return Buffer.concat([header, chunk.pcm]);
  }
  const compressed = zstdCompressSync(chunk.pcm, {
    params: { [constants.ZSTD_c_compressionLevel]: 1 },
  });
  return Buffer.concat([header, compressed]);
};

/**
 * Zstandard runs in Node's worker pool so lossless transport cannot hold up
 * Electron's main event loop or the loopback-driven UI meters.
 */
export const encodeAudioAsync = async (
  chunk: INormalizedAudioChunk,
  compress = true,
): Promise<Buffer> => {
  const header = Buffer.allocUnsafe(AUDIO_HEADER_BYTES);
  header.writeUInt32LE(chunk.sequence, 0);
  header.writeUInt32LE(chunk.sampleRate, 4);
  header.writeUInt8(chunk.channels, 8);
  header.writeUInt16LE(chunk.frames, 9);
  header.writeUInt8(compress ? AUDIO_ZSTD : AUDIO_RAW, 11);
  if (!compress) {
    return Buffer.concat([header, chunk.pcm]);
  }
  const compressed = await new Promise<Buffer>((resolve, reject) => {
    zstdCompress(
      chunk.pcm,
      { params: { [constants.ZSTD_c_compressionLevel]: 1 } },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
  return Buffer.concat([header, compressed]);
};

export const decodeAudio = (
  peerId: string,
  clear: Buffer,
): ILanRemoteAudioChunk => {
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
      pcm = zstdDecompressSync(payload, {
        maxOutputLength: expectedPcmBytes,
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
