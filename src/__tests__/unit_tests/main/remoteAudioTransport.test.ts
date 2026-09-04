/* FluidEQ — GPL-3.0-or-later */

/** @jest-environment node */

import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import createRemoteAudioTransport from '../../../main/remoteAudioTransport';
import {
  PACKET_AUDIO,
  keyFromSecret,
  openPacket,
  sealAuthChallenge,
  sealPacket,
} from '../../../main/remoteAudioLanProtocol';

class FakeSocket extends EventEmitter {
  bufferedAmount = 0;

  close = jest.fn((code?: number, reason?: string) => {
    this.readyState = 2;
    this.emit('close', code, reason);
  });

  readyState = 1;

  sent: Buffer[] = [];

  send = jest.fn((packet: Buffer) => {
    this.sent.push(packet);
  });
}

const audioChunk = (peerId: string, sequence: number) => ({
  channels: 2,
  frames: 480,
  pcm: new Float32Array(960).buffer,
  peerId,
  sampleRate: 48_000,
  sequence,
});

const createTransport = () => {
  const emitAudio = jest.fn();
  const emitNetwork = jest.fn();
  const emitSignal = jest.fn();
  return {
    emitAudio,
    emitNetwork,
    emitSignal,
    transport: createRemoteAudioTransport({
      emitAudio,
      emitNetwork,
      emitSignal,
    }),
  };
};

describe('LAN audio transport boundaries', () => {
  it('encrypts each peer with its authenticated session key', () => {
    const { transport } = createTransport();
    const socket = new FakeSocket();
    const key = keyFromSecret('session-one');
    transport.attach('peer-one', socket as unknown as WebSocket, key);

    transport.sendSignal({
      peerId: 'peer-one',
      signal: { kind: 'stream-mode', mode: 'video' },
    });

    expect(openPacket(socket.sent[0], key).kind).toBe(1);
    expect(() =>
      openPacket(socket.sent[0], keyFromSecret('different-session')),
    ).toThrow();
    transport.closeAll();
  });

  it('rejects handshake packets after authentication', () => {
    const { transport } = createTransport();
    const socket = new FakeSocket();
    const key = keyFromSecret('session-two');
    transport.attach('peer-two', socket as unknown as WebSocket, key);

    socket.emit('message', sealAuthChallenge('a'.repeat(43), key));

    expect(socket.close).toHaveBeenCalledWith(1008, 'Invalid encrypted packet');
  });

  it('rejects audio captured under a previous session key', () => {
    const { emitAudio, transport } = createTransport();
    const socket = new FakeSocket();
    const oldKey = keyFromSecret('old-session');
    const newKey = keyFromSecret('new-session');
    transport.attach('peer-three', socket as unknown as WebSocket, newKey);
    const captured = sealPacket(PACKET_AUDIO, Buffer.alloc(12), oldKey);

    socket.emit('message', captured);

    expect(socket.close).toHaveBeenCalledWith(1008, 'Invalid encrypted packet');
    expect(emitAudio).not.toHaveBeenCalled();
  });

  it('sends a video capture burst without inventing encoder overload', () => {
    const { transport } = createTransport();
    const socket = new FakeSocket();
    transport.attach(
      'video-peer',
      socket as unknown as WebSocket,
      keyFromSecret('video-session'),
    );
    transport.setStreamMode('video-peer', 'video');

    for (let sequence = 0; sequence < 16; sequence += 1) {
      transport.sendAudio(audioChunk('video-peer', sequence));
    }

    expect(socket.close).not.toHaveBeenCalled();
    expect(socket.sent).toHaveLength(16);
    expect(
      socket.sent.map((packet) =>
        openPacket(packet, keyFromSecret('video-session')).clear.readUInt32LE(
          0,
        ),
      ),
    ).toEqual(Array.from({ length: 16 }, (_, index) => index));
    transport.closeAll();
  });

  it('still rejects a genuinely congested video socket', () => {
    const { transport } = createTransport();
    const socket = new FakeSocket();
    transport.attach(
      'video-peer',
      socket as unknown as WebSocket,
      keyFromSecret('video-session'),
    );
    transport.setStreamMode('video-peer', 'video');
    socket.bufferedAmount = 256 * 1024 + 1;

    transport.sendAudio(audioChunk('video-peer', 0));

    expect(socket.close).toHaveBeenCalledWith(
      1013,
      'Network send buffer is overloaded',
    );
    expect(socket.sent).toHaveLength(0);
    transport.closeAll();
  });
});
