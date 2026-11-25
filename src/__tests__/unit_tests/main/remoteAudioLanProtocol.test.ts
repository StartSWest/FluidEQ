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
  decodeAudioAsync,
  computerIdOf,
  decodePairingCode,
  deriveSessionKey,
  encodeAudioAsync,
  encodePairingCode,
  isPrivateIpv4,
  keyFromSecret,
  normalizeAudioChunk,
  openAuthAccepted,
  openAuthChallenge,
  openAuthReady,
  openPacket,
  PACKET_AUTH_ACCEPTED,
  PACKET_AUTH_CHALLENGE,
  PACKET_AUTH_READY,
  PACKET_AUDIO,
  PACKET_SIGNAL,
  openSignal,
  sealAuthAccepted,
  sealAuthChallenge,
  sealAuthReady,
  sealPacket,
  sealSignal,
} from '../../../main/remoteAudioLanProtocol';
import { isRemoteAudioSignal } from '../../../common/remoteAudio';

describe('encrypted LAN audio protocol', () => {
  it('accepts only known per-sender stream modes', () => {
    expect(isRemoteAudioSignal({ kind: 'stream-mode', mode: 'video' })).toBe(
      true,
    );
    expect(isRemoteAudioSignal({ kind: 'stream-mode', mode: 'music' })).toBe(
      true,
    );
    expect(isRemoteAudioSignal({ kind: 'stream-mode', mode: 'lossy' })).toBe(
      false,
    );
  });

  it("accepts a sender's bar description and bounds every field", () => {
    const playing = {
      title: 'Song',
      subtitle: 'Artist',
      artist: 'Artist',
      isPlaying: true,
      positionMs: 12_000,
      durationMs: 180_000,
      canNext: true,
      canPrevious: false,
      canStep: true,
      canStop: false,
    };
    expect(isRemoteAudioSignal({ kind: 'now-playing', playing })).toBe(true);
    // An empty bar on the sender is a message too, not a missing field.
    expect(isRemoteAudioSignal({ kind: 'now-playing' })).toBe(true);
    expect(
      isRemoteAudioSignal({
        kind: 'now-playing',
        playing: { ...playing, title: ' ' },
      }),
    ).toBe(false);
    expect(
      isRemoteAudioSignal({
        kind: 'now-playing',
        playing: { ...playing, title: 'x'.repeat(257) },
      }),
    ).toBe(false);
    expect(
      isRemoteAudioSignal({
        kind: 'now-playing',
        playing: { ...playing, positionMs: Number.NaN },
      }),
    ).toBe(false);
    expect(
      isRemoteAudioSignal({
        kind: 'now-playing',
        playing: { ...playing, durationMs: -1 },
      }),
    ).toBe(false);
    expect(
      isRemoteAudioSignal({
        kind: 'now-playing',
        playing: { ...playing, canStop: 'yes' },
      }),
    ).toBe(false);
  });

  describe("a Library song's album tags (2.6)", () => {
    const playing = {
      title: 'Blue in Green',
      subtitle: 'Miles Davis',
      artist: 'Miles Davis',
      isPlaying: true,
      positionMs: 12_000,
      durationMs: 180_000,
      canNext: true,
      canPrevious: true,
      canStep: true,
      canStop: false,
    };
    const tagged = {
      ...playing,
      library: { album: 'Kind of Blue', albumArtist: 'Miles Davis' },
    };

    /**
     * What a FluidEQ 2.5.2 accepts as a now-playing description, copied
     * from that release (`git show v2.5.2:src/common/remoteAudio.ts`) and
     * frozen here: a computer still on 2.5 refuses a packet its validator
     * refuses, and closes the link with it.
     */
    const acceptedBy252 = (value: Record<string, unknown>): boolean =>
      typeof value.title === 'string' &&
      value.title.trim().length > 0 &&
      value.title.length <= 256 &&
      (value.subtitle === undefined ||
        (typeof value.subtitle === 'string' && value.subtitle.length <= 256)) &&
      (value.artist === undefined ||
        (typeof value.artist === 'string' && value.artist.length <= 256)) &&
      typeof value.isPlaying === 'boolean' &&
      typeof value.positionMs === 'number' &&
      Number.isFinite(value.positionMs) &&
      value.positionMs >= 0 &&
      typeof value.durationMs === 'number' &&
      Number.isFinite(value.durationMs) &&
      value.durationMs >= 0 &&
      typeof value.canNext === 'boolean' &&
      typeof value.canPrevious === 'boolean' &&
      typeof value.canStep === 'boolean' &&
      typeof value.canStop === 'boolean';

    it('travels sealed and opens whole on a 2.6 listener', () => {
      const key = keyFromSecret('test-secret');
      const message = {
        peerId: 'peer',
        signal: { kind: 'now-playing' as const, playing: tagged },
      };
      const opened = openPacket(sealSignal(message, key), key);
      expect(opened.kind).toBe(PACKET_SIGNAL);
      expect(openSignal(opened.clear)).toEqual(message);
    });

    it('is accepted by a listener still on 2.5.2, which reads past it', () => {
      expect(acceptedBy252(tagged)).toBe(true);
      // Control: the frozen copy does refuse what 2.5.2 refuses.
      expect(acceptedBy252({ ...tagged, canStop: 'no' })).toBe(false);
    });

    it('is optional, so a 2.5 sender’s description still opens on 2.6', () => {
      expect(isRemoteAudioSignal({ kind: 'now-playing', playing })).toBe(true);
      expect(
        isRemoteAudioSignal({
          kind: 'now-playing',
          playing: { ...playing, library: {} },
        }),
      ).toBe(true);
    });

    it('is bounded like every other field a peer sends', () => {
      const refused = [
        { ...playing, library: 'Kind of Blue' },
        { ...playing, library: null },
        { ...playing, library: ['Kind of Blue'] },
        { ...playing, library: { album: 7 } },
        { ...playing, library: { album: 'x'.repeat(257) } },
        { ...playing, library: { albumArtist: 'x'.repeat(257) } },
      ];
      refused.forEach((value) => {
        expect(
          isRemoteAudioSignal({ kind: 'now-playing', playing: value }),
        ).toBe(false);
      });
      expect(
        isRemoteAudioSignal({
          kind: 'now-playing',
          playing: {
            ...playing,
            library: { album: 'x'.repeat(256), albumArtist: 'y'.repeat(256) },
          },
        }),
      ).toBe(true);
    });
  });

  it("accepts the listener's bar presses and bounds the step", () => {
    ['toggle', 'pause', 'stop', 'next', 'previous'].forEach((command) => {
      expect(isRemoteAudioSignal({ kind: 'transport', command })).toBe(true);
    });
    expect(isRemoteAudioSignal({ kind: 'transport', command: 'seek' })).toBe(
      false,
    );
    expect(
      isRemoteAudioSignal({
        kind: 'transport',
        command: 'nudge',
        deltaMs: -5000,
      }),
    ).toBe(true);
    expect(
      isRemoteAudioSignal({
        kind: 'transport',
        command: 'nudge',
        deltaMs: 60_001,
      }),
    ).toBe(false);
    expect(
      isRemoteAudioSignal({
        kind: 'transport',
        command: 'nudge',
        deltaMs: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false);
    expect(isRemoteAudioSignal({ kind: 'transport', command: 'nudge' })).toBe(
      false,
    );
  });

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
    expect(isPrivateIpv4('172.016.0.1')).toBe(false);
    expect(isPrivateIpv4('192.168.01.1')).toBe(false);
    expect(isPrivateIpv4('10.0.0.010')).toBe(false);
    expect(isPrivateIpv4('+10.0.0.1')).toBe(false);
  });

  it('round-trips a reusable private-network pairing code', () => {
    const secret = 'a'.repeat(43);
    const code = encodePairingCode('192.168.1.24', 48_351, secret, 'STUDIO-PC');

    expect(decodePairingCode(code)).toEqual({
      address: '192.168.1.24',
      addresses: ['192.168.1.24'],
      deviceName: 'STUDIO-PC',
      port: 48_351,
      secret,
    });
  });

  it('carries every address in one code, the first where an older FluidEQ reads it', () => {
    const secret = 'b'.repeat(43);
    const code = encodePairingCode(
      ['192.168.1.30', '10.0.0.4', '8.8.8.8'],
      48_351,
      secret,
      'SERVER',
    );
    const raw = JSON.parse(
      Buffer.from(code.slice('FLUIDEQ-LAN-2.'.length), 'base64url').toString(
        'utf8',
      ),
    ) as { address: string };

    expect(raw.address).toBe('192.168.1.30');
    expect(decodePairingCode(code).addresses).toEqual([
      '192.168.1.30',
      '10.0.0.4',
    ]);
  });

  it('still reads a code made before one code per computer', () => {
    const secret = 'c'.repeat(43);
    const old = `FLUIDEQ-LAN-2.${Buffer.from(
      JSON.stringify({
        address: '10.1.2.3',
        deviceName: 'OLD',
        port: 4_000,
        secret,
      }),
      'utf8',
    ).toString('base64url')}`;

    expect(decodePairingCode(old)).toEqual({
      address: '10.1.2.3',
      addresses: ['10.1.2.3'],
      deviceName: 'OLD',
      port: 4_000,
      secret,
    });
  });

  it('names a computer by a hash of its secret, never the secret', () => {
    const secret = 'd'.repeat(43);

    expect(computerIdOf(secret)).toBe(computerIdOf(secret));
    expect(computerIdOf(secret)).not.toBe(computerIdOf('e'.repeat(43)));
    expect(computerIdOf(secret)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(computerIdOf(secret)).not.toContain('ddd');
  });

  it('refuses a pairing code that points outside the local network', () => {
    const code = encodePairingCode(
      '8.8.8.8',
      48_351,
      'a'.repeat(43),
      'STUDIO-PC',
    );

    expect(() => decodePairingCode(code)).toThrow(
      'Invalid FluidEQ LAN pairing code.',
    );
  });

  it('preserves every Float32 PCM bit through encryption and framing', async () => {
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

    const encrypted = sealPacket(
      PACKET_AUDIO,
      await encodeAudioAsync(normalized),
      key,
    );
    const opened = openPacket(encrypted, key);
    const decoded = await decodeAudioAsync('source-pc', opened.clear);

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

  it('compresses repetitive PCM without changing the restored samples', async () => {
    const pcm = Buffer.alloc(8_192 * 2 * 4);
    const normalized = normalizeAudioChunk({
      channels: 2,
      frames: 8_192,
      pcm,
      peerId: 'quiet-pc',
      sampleRate: 48_000,
      sequence: 4,
    });
    const compressed = await encodeAudioAsync(normalized);

    expect(compressed.byteLength).toBeLessThan(pcm.byteLength);
    expect(
      Buffer.from((await decodeAudioAsync('quiet-pc', compressed)).pcm),
    ).toEqual(pcm);
  });

  it('preserves every PCM bit through the asynchronous transport codec', async () => {
    const pcm = Buffer.from(new Float32Array([0.125, -0.25, 0.5, -1]).buffer);
    const normalized = normalizeAudioChunk({
      channels: 2,
      frames: 2,
      pcm,
      peerId: 'video-pc',
      sampleRate: 48_000,
      sequence: 9,
    });
    let settled = false;
    const encodedPromise = encodeAudioAsync(normalized).then((encoded) => {
      settled = true;
      return encoded;
    });

    expect(settled).toBe(false);
    const encoded = await encodedPromise;
    const decoded = await decodeAudioAsync('video-pc', encoded);
    expect(Buffer.from(decoded.pcm)).toEqual(pcm);
  });

  it('lets video mode bypass compression without changing one PCM bit', async () => {
    const pcm = Buffer.from(new Float32Array([0.125, -0.25, 0.5, -1]).buffer);
    const normalized = normalizeAudioChunk({
      channels: 2,
      frames: 2,
      pcm,
      peerId: 'video-pc',
      sampleRate: 48_000,
      sequence: 10,
    });

    const raw = await encodeAudioAsync(normalized, false);
    const decoded = await decodeAudioAsync('video-pc', raw);

    expect(raw.byteLength).toBe(pcm.byteLength + 12);
    expect(Buffer.from(decoded.pcm)).toEqual(pcm);
  });

  it('rejects an encrypted packet changed in transit', () => {
    const key = keyFromSecret('authenticated-lan-audio-secret');
    const encrypted = sealPacket(PACKET_AUDIO, Buffer.from('pcm'), key);
    const tampered = Buffer.from(encrypted);
    const lastByte = tampered.length - 1;
    tampered[lastByte] = (tampered[lastByte] + 1) % 256;

    expect(() => openPacket(tampered, key)).toThrow();
  });

  it('authenticates a peer with a fresh challenge and session key', () => {
    const pairingKey = keyFromSecret('durable-pairing-secret');
    const challenge = 'a'.repeat(43);
    const peerId = 'sender-pc';
    const openedChallenge = openPacket(
      sealAuthChallenge(challenge, pairingKey),
      pairingKey,
    );
    expect(openedChallenge.kind).toBe(PACKET_AUTH_CHALLENGE);
    expect(openAuthChallenge(openedChallenge.clear)).toEqual({ challenge });

    const openedReady = openPacket(
      sealAuthReady({ challenge, deviceName: 'SOURCE-PC', peerId }, pairingKey),
      pairingKey,
    );
    expect(openedReady.kind).toBe(PACKET_AUTH_READY);
    expect(openAuthReady(openedReady.clear)).toEqual({
      challenge,
      deviceName: 'SOURCE-PC',
      peerId,
    });

    const openedAccepted = openPacket(
      sealAuthAccepted({ challenge, peerId }, pairingKey),
      pairingKey,
    );
    expect(openedAccepted.kind).toBe(PACKET_AUTH_ACCEPTED);
    expect(openAuthAccepted(openedAccepted.clear)).toEqual({
      challenge,
      peerId,
    });
  });

  it('makes captured audio unusable after reconnecting', () => {
    const pairingKey = keyFromSecret('durable-pairing-secret');
    const peerId = 'sender-pc';
    const firstSession = deriveSessionKey(pairingKey, 'a'.repeat(43), peerId);
    const nextSession = deriveSessionKey(pairingKey, 'b'.repeat(43), peerId);
    const captured = sealPacket(
      PACKET_AUDIO,
      Buffer.from('captured audio'),
      firstSession,
    );

    expect(nextSession).not.toEqual(firstSession);
    expect(() => openPacket(captured, nextSession)).toThrow();
  });
});
