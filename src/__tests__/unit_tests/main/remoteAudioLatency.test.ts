/* FluidEQ — GPL-3.0-or-later
 * @jest-environment node
 */
import { EventEmitter } from 'events';
import type WebSocket from 'ws';
import createRemoteAudioLatency from '../../../main/remoteAudioLatency';
import { keyFromSecret } from '../../../main/remoteAudioLanProtocol';

class Link extends EventEmitter {
  readyState = 1;

  bufferedAmount = 0;

  ping = jest.fn<void, [Buffer, unknown, () => void]>();
}
const tick = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
const key = keyFromSecret('latency-test-session');
const fixture = () => {
  const socket = new Link();
  let clock = 0;
  const meter = createRemoteAudioLatency(
    socket as unknown as WebSocket,
    key,
    () => clock,
  );
  return {
    socket,
    meter,
    at: (time: number) => {
      clock = time;
    },
  };
};

it('uses each receiving PC’s actual playback report, independent of PC clocks', async () => {
  const a = fixture();
  const b = fixture();
  a.at(10_000);
  b.at(500_000);
  a.meter.playback(80);
  b.meter.playback(300);
  expect(a.meter.sample().incomingLagMs).toBeUndefined();
  b.meter.sample();
  expect(a.socket.ping).not.toHaveBeenCalled();
  await tick();
  const aPacket = a.socket.ping.mock.calls[0][0];
  const bPacket = b.socket.ping.mock.calls[0][0];
  expect(aPacket.byteLength).toBeLessThanOrEqual(125);
  a.socket.emit('ping', bPacket);
  b.socket.emit('ping', aPacket);
  a.at(10_008);
  b.at(500_008);
  a.socket.emit('pong', aPacket);
  b.socket.emit('pong', bPacket);
  expect(a.meter.sample()).toEqual({ incomingLagMs: 84, outgoingLagMs: 304 });
  expect(b.meter.sample()).toEqual({ incomingLagMs: 304, outgoingLagMs: 84 });
  a.meter.close();
  b.meter.close();
});

it('never guesses the playback delay of an older peer that only echoes pings', async () => {
  const { meter, socket, at } = fixture();
  meter.playback(42);
  meter.sample();
  await tick();
  at(10);
  socket.emit('pong', socket.ping.mock.calls[0][0]);
  expect(meter.sample()).toEqual({
    incomingLagMs: 47,
    outgoingLagMs: undefined,
  });
  meter.close();
});

it('coalesces reports, caps probes at one a second and drops them under backpressure', async () => {
  const { meter, socket, at } = fixture();
  for (let i = 0; i < 1_000; i += 1) {
    meter.sample();
  }
  expect(socket.ping).not.toHaveBeenCalled();
  await tick();
  expect(socket.ping).toHaveBeenCalledTimes(1);
  at(999);
  meter.sample();
  await tick();
  expect(socket.ping).toHaveBeenCalledTimes(1);
  at(1_000);
  socket.bufferedAmount = 1;
  meter.sample();
  await tick();
  expect(socket.ping).toHaveBeenCalledTimes(1);
  socket.bufferedAmount = 0;
  meter.sample();
  await tick();
  expect(socket.ping).toHaveBeenCalledTimes(2);
  meter.close();
});

it('expires stale reports and ignores unauthenticated or unrelated replies', async () => {
  const { meter, socket, at } = fixture();
  meter.playback(40);
  meter.sample();
  await tick();
  at(4);
  socket.emit('pong', Buffer.from('unrelated'));
  socket.emit('ping', Buffer.alloc(60));
  expect(meter.sample().incomingLagMs).toBeUndefined();
  socket.emit('pong', socket.ping.mock.calls[0][0]);
  expect(meter.sample().incomingLagMs).toBe(42);
  at(3_005);
  expect(meter.sample()).toEqual({
    incomingLagMs: undefined,
    outgoingLagMs: undefined,
  });
  meter.close();
  await tick();
});

it('cancels optional queued writes and detaches its listeners on disconnect', async () => {
  const { meter, socket } = fixture();
  meter.sample();
  meter.close();
  await tick();
  expect(socket.ping).not.toHaveBeenCalled();
  expect(socket.listenerCount('ping')).toBe(0);
  expect(socket.listenerCount('pong')).toBe(0);
});

it('does not propagate a telemetry write failure into the audio connection', async () => {
  const { meter, socket } = fixture();
  socket.ping.mockImplementation(() => {
    throw new Error('telemetry failed');
  });
  meter.sample();
  await tick();
  expect(socket.readyState).toBe(1);
  expect(meter.sample().incomingLagMs).toBeUndefined();
  meter.close();
});
