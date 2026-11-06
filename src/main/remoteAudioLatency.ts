/* FluidEQ — GPL-3.0-or-later */
import type WebSocket from 'ws';
import { setImmediate } from 'timers';
import {
  PACKET_SIGNAL,
  openPacket,
  sealPacket,
} from './remoteAudioLanProtocol';

const MAGIC = 0x314c5146;
const PAYLOAD_BYTES = 28;
const REPORT_MS = 1_000;
const FRESH_MS = 3_000;

/** Display telemetry only. No PCM, rescheduling, extra reservoir or timers.
 * A WebSocket control-frame echo measures RTT without comparing PC clocks.
 * Half RTT is an estimate: asymmetric routes and unreported device/capture
 * buffering cannot be turned into an exact acoustic measurement. */
const createRemoteAudioLatency = (
  socket: WebSocket,
  key: Buffer,
  now: () => number = () => performance.now(),
) => {
  let live = true;
  let scheduled = false;
  let lastProbe = -Infinity;
  let pending: Buffer | undefined;
  let sentAt = 0;
  let roundTrip: { ms: number; at: number } | undefined;
  let local: { ms: number; at: number } | undefined;
  let remote: { ms: number; at: number } | undefined;

  const fresh = (sample: { ms: number; at: number } | undefined, at: number) =>
    sample && at - sample.at <= FRESH_MS ? sample.ms : undefined;

  const receive = (packet: Buffer) => {
    try {
      const { kind, clear } = openPacket(packet, key);
      if (
        kind !== PACKET_SIGNAL ||
        clear.length !== PAYLOAD_BYTES ||
        clear.readUInt32LE(0) !== MAGIC
      ) {
        return;
      }
      const ms = clear.readDoubleLE(12);
      remote =
        Number.isFinite(ms) && ms >= 0 && ms <= 60_000
          ? { ms, at: now() }
          : undefined;
    } catch {
      // Optional telemetry cannot close or stall an otherwise valid audio link.
    }
  };
  const pong = (packet: Buffer) => {
    if (!pending || !pending.equals(packet)) {
      return;
    }
    const at = now();
    const elapsed = at - sentAt;
    pending = undefined;
    roundTrip =
      elapsed >= 0 && elapsed <= FRESH_MS ? { ms: elapsed, at } : undefined;
  };
  socket.on('ping', receive);
  socket.on('pong', pong);

  return {
    playback: (ms: number) => {
      if (Number.isFinite(ms) && ms >= 0 && ms <= 60_000) {
        local = { ms, at: now() };
      }
    },
    /** Called by the EXISTING quarter-second network report. The actual
     * optional write runs after audio delivery and is skipped under pressure. */
    sample: () => {
      const at = now();
      if (live && !scheduled && at - lastProbe >= REPORT_MS) {
        scheduled = true;
        setImmediate(() => {
          scheduled = false;
          if (!live || socket.readyState !== 1 || socket.bufferedAmount > 0) {
            return;
          }
          lastProbe = now();
          const clear = Buffer.alloc(PAYLOAD_BYTES);
          clear.writeUInt32LE(MAGIC, 0);
          clear.writeDoubleLE(lastProbe, 4);
          clear.writeDoubleLE(fresh(local, lastProbe) ?? -1, 12);
          // Reserved for versioned telemetry; the entire payload is authenticated.
          clear.writeDoubleLE(0, 20);
          try {
            pending = sealPacket(PACKET_SIGNAL, clear, key);
            sentAt = lastProbe;
            socket.ping(pending, undefined, () => undefined);
          } catch {
            pending = undefined;
          }
        });
      }
      const rtt = fresh(roundTrip, at);
      const incoming = fresh(local, at);
      const outgoing = fresh(remote, at);
      return {
        incomingLagMs:
          rtt !== undefined && incoming !== undefined
            ? incoming + rtt / 2
            : undefined,
        outgoingLagMs:
          rtt !== undefined && outgoing !== undefined
            ? outgoing + rtt / 2
            : undefined,
      };
    },
    close: () => {
      live = false;
      pending = undefined;
      socket.removeListener('ping', receive);
      socket.removeListener('pong', pong);
    },
  };
};

export default createRemoteAudioLatency;
