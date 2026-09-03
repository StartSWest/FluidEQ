/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

@jest-environment node
*/

import {
  decodeAudio,
  decodePairingCode,
  encodeAudio,
  encodePairingCode,
  isPrivateIpv4,
  keyFromSecret,
  normalizeAudioChunk,
  openPacket,
  PACKET_AUDIO,
  sealPacket,
} from '../../../main/remoteAudioLanProtocol';

describe('encrypted LAN audio protocol', () => {
  it('accepts private LAN addresses and rejects public or malformed ones', () => {
    expect(isPrivateIpv4('10.0.0.12')).toBe(true);
    expect(isPrivateIpv4('172.16.4.2')).toBe(true);
    expect(isPrivateIpv4('172.31.255.254')).toBe(true);
    expect(isPrivateIpv4('192.168.50.7')).toBe(true);
    expect(isPrivateIpv4('169.254.20.1')).toBe(true);

    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('172.32.0.1')).toBe(false);
    expect(isPrivateIpv4('127.0.0.1')).toBe(false);
    expect(isPrivateIpv4('192.168.1')).toBe(false);
  });

  it('round-trips a reusable private-network pairing code', () => {
    const secret = 'a'.repeat(43);
    const code = encodePairingCode('192.168.1.24', 48_351, secret);

    expect(decodePairingCode(code)).toEqual({
      address: '192.168.1.24',
      port: 48_351,
      secret,
    });
  });

  it('refuses a pairing code that points outside the local network', () => {
    const code = encodePairingCode('8.8.8.8', 48_351, 'a'.repeat(43));

    expect(() => decodePairingCode(code)).toThrow(
      'Invalid FluidEQ LAN pairing code.',
    );
  });

  it('preserves every Float32 PCM bit through encryption and framing', () => {
    const samples = new Float32Array([
      0,
      -0,
      0.25,
      -0.5,
      1,
      -1,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
    ]);
    const pcm = Buffer.from(
      samples.buffer,
      samples.byteOffset,
      samples.byteLength,
    );
    const normalized = normalizeAudioChunk({
      peerId: 'source-pc',
      sequence: 8_388_607,
      sampleRate: 192_000,
      channels: 2,
      frames: 4,
      pcm,
    });
    const key = keyFromSecret('lossless-lan-audio-secret');

    const encrypted = sealPacket(PACKET_AUDIO, encodeAudio(normalized), key);
    const opened = openPacket(encrypted, key);
    const decoded = decodeAudio('source-pc', opened.clear);

    expect(opened.kind).toBe(PACKET_AUDIO);
    expect(decoded).toMatchObject({
      peerId: 'source-pc',
      sequence: 8_388_607,
      sampleRate: 192_000,
      channels: 2,
      frames: 4,
    });
    expect(Buffer.from(decoded.pcm)).toEqual(Buffer.from(pcm));
  });

  it('rejects an encrypted packet changed in transit', () => {
    const key = keyFromSecret('authenticated-lan-audio-secret');
    const encrypted = sealPacket(PACKET_AUDIO, Buffer.from('pcm'), key);
    const tampered = Buffer.from(encrypted);
    const lastByte = tampered.length - 1;
    tampered[lastByte] = (tampered[lastByte] + 1) % 256;

    expect(() => openPacket(tampered, key)).toThrow();
  });
});
