/* FluidEQ — GPL-3.0-or-later */
import createRemoteAudioLevels from '../remoteAudioLevels';
import type { ILanAudioLease } from '../lanAudioHelper';
import type { ILanLinkBook, IRemoteAudioLan } from '../remoteAudioLanTypes';
import {
  type IAudioGroupLink,
  MAX_AUDIO_GROUP_COMPUTERS,
  MAX_AUDIO_REVOKED_COMPUTERS,
} from '../../common/remoteAudioGroup';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import type { TAudioEvent, TAudioRequest, TAudioResponse } from './protocol';
import { createAudioTelemetry } from './telemetry';
import { createAudioLeasePool } from './leasePool';
import { createRemoteAudioPreview } from '../../common/remoteAudioPreview';

const SYSTEM_WORD = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const systemWord = (word: unknown): string | undefined =>
  typeof word === 'string' && SYSTEM_WORD.test(word) ? word : undefined;

/**
 * What a failure may say on its way out of the Share Audio service: the
 * system's code for it and the call that raised it (EADDRINUSE, listen),
 * never its message, which pairing and auth parsing can fill with secrets.
 *
 * The code is not only for the log. Main falls back to a fresh port when the
 * saved one is taken (`startRemoteAudioHostSession`, on EADDRINUSE), and
 * once the link moved into this service every failure arrived as "operation
 * failed" with no code: a taken port stopped the link from starting at all
 * (Ivan, 2026-10-28, twice in a row on the Share Audio page).
 */
export const failureCode = (
  error: unknown,
): { code?: string; syscall?: string } => {
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const { code, syscall } = error as { code?: unknown; syscall?: unknown };
  return {
    ...(systemWord(code) ? { code: systemWord(code) } : {}),
    ...(systemWord(syscall) ? { syscall: systemWord(syscall) } : {}),
  };
};

export interface IAudioRuntimeDeps {
  post(message: TAudioResponse): void;
  createLan: typeof import('../remoteAudioLan').default;
  startCapture: typeof import('../remoteAudioCapture').startNetworkCapture;
  startPlayback: typeof import('../nativeRemoteAudioPlayback').startNativeRemoteAudioPlayback;
  leaseHelper: typeof import('../lanAudioHelper').leaseLanAudioHelper;
  helperPid: typeof import('../lanAudioHelper').lanAudioHelperPid;
  now?: () => number;
  onFatal?: () => void;
  scheduling?: boolean;
}

export const createAudioRuntime = ({
  post,
  createLan,
  startCapture,
  startPlayback,
  leaseHelper,
  helperPid,
  now = () => performance.now(),
  onFatal,
  scheduling = false,
}: IAudioRuntimeDeps) => {
  const telemetry = createAudioTelemetry(post, onFatal);
  const event = (value: TAudioEvent) => telemetry.sendReliable(value);
  const levels = createRemoteAudioLevels();
  const receive = new Map<string, number>();
  const remoteSends = new Map<string, boolean>();
  const remotePlays = new Map<string, boolean>();
  const streaming = new Set<string>();
  const leases = new Map<number, ILanAudioLease>();
  const aliases = new Map<number, Map<number, number>>();
  const revoked = new Set<string>();
  let links: readonly IAudioGroupLink[] = [];
  let targets: readonly string[] = [];
  let nextId = 0;
  let playing = 0;
  let lan: IRemoteAudioLan | undefined;
  let savedBookLoaded = false;
  const captures = createAudioLeasePool(
    async (ids) => {
      let lastMeterAt = 0;
      const preview = createRemoteAudioPreview();
      return startCapture(
        (chunk) => {
          const active = ids();
          if (active.length === 0) {
            return;
          }
          targets.forEach((peerId) => {
            if (remotePlays.get(peerId) === false) {
              return;
            }
            try {
              lan?.sendAudio({ ...chunk, peerId });
            } catch {
              /* Its close signal removes a link that has just gone. */
            }
          });
          preview.push(chunk);
          const at = now();
          // Feed analysis faster than its 33 ms display pulls. At 35 ms a
          // healthy stream could otherwise be mistaken for stopped audio.
          if (at - lastMeterAt >= 16) {
            const frame = preview.read();
            if (frame) {
              lastMeterAt = at;
              active.forEach((id) =>
                telemetry.send(`capture:${id}`, {
                  type: 'capture',
                  id,
                  chunk: frame,
                }),
              );
            }
          }
        },
        () => failCapture(ids()),
      );
    },
    (capture) => capture.close(),
  );
  const failCapture = (ids: readonly number[]) => {
    ids.forEach((id) => {
      event({ type: 'capture-failed', id });
      telemetry.forget(`capture:${id}`);
      captures.release(id).catch(() => undefined);
    });
  };
  const failPlayer = (ids: readonly number[]) => {
    ids.forEach((id) => {
      event({ type: 'playback-failed', id });
      players.release(id).catch(() => undefined);
      if (playing === id) {
        playing = 0;
      }
    });
  };
  const players = createAudioLeasePool(
    (ids) =>
      startPlayback(
        (meter) =>
          ids().forEach((id) =>
            telemetry.send(`meter:${id}:${meter.sourceId}`, {
              type: 'meter',
              id,
              meter,
            }),
          ),
        () => failPlayer(ids()),
      ),
    (player) => player.close(),
  );
  const removeFromPlayer = (peerId: string) => {
    if (playing === 0) {
      return;
    }
    try {
      players.get(playing).remove(peerId);
    } catch {
      failPlayer([playing]);
    }
  };
  const book: ILanLinkBook = {
    groupLinks: () => links,
    saveGroupLink: (link) => {
      links = [
        ...links.filter((kept) => kept.computerId !== link.computerId),
        link,
      ].slice(-MAX_AUDIO_GROUP_COMPUTERS);
      event({ type: 'book-link', link });
    },
    isRevoked: (id) => revoked.has(id),
    revoke: (id) => {
      revoked.delete(id);
      revoked.add(id);
      const oldest = revoked.values().next().value;
      if (revoked.size > MAX_AUDIO_REVOKED_COMPUTERS && oldest !== undefined) {
        revoked.delete(oldest);
      }
      event({ type: 'book', operation: 'revoke', value: id });
    },
    unrevoke: (id) => {
      revoked.delete(id);
      event({ type: 'book', operation: 'unrevoke', value: id });
    },
    forgetJoin: (id) => {
      links = links.filter((link) => link.computerId !== id);
      event({ type: 'book', operation: 'forget', value: id });
    },
  };
  const arriving = (chunk: ILanRemoteAudioChunk) => {
    const volume = receive.get(chunk.peerId);
    if (
      volume === undefined ||
      playing === 0 ||
      remoteSends.get(chunk.peerId) === false
    ) {
      return;
    }
    try {
      const player = players.get(playing);
      player.push(levels.apply(chunk, volume));
      if (!streaming.has(chunk.peerId)) {
        streaming.add(chunk.peerId);
        event({ type: 'streaming', peerId: chunk.peerId });
      }
    } catch {
      failPlayer([playing]);
    }
  };
  const network = () => {
    lan ??= createLan(
      (message) => {
        const { peerId, signal } = message;
        if (signal.kind === 'stop') {
          remoteSends.delete(peerId);
          remotePlays.delete(peerId);
        } else if (signal.kind === 'stream-mode' && signal.duplex) {
          remoteSends.set(peerId, signal.duplex.sends);
          remotePlays.set(peerId, signal.duplex.plays);
        }
        if (
          signal.kind === 'stop' ||
          (signal.kind === 'stream-mode' && signal.duplex?.plays === false)
        ) {
          targets = targets.filter((id) => id !== peerId);
        }
        if (
          signal.kind === 'stop' ||
          (signal.kind === 'stream-mode' && signal.duplex?.sends === false)
        ) {
          receive.delete(peerId);
          streaming.delete(peerId);
          levels.forget(peerId);
          removeFromPlayer(peerId);
        }
        event({ type: 'signal', message });
      },
      arriving,
      () => event({ type: 'lan-failed' }),
      (stats) =>
        telemetry.send(`network:${stats.direction}:${stats.peerId}`, {
          type: 'network',
          stats,
        }),
      book,
    );
    return lan;
  };
  const execute = async (request: TAudioRequest): Promise<unknown> => {
    switch (request.method) {
      case 'status':
        return { scheduling };
      case 'lan.start': {
        const [credentials, saved] = request.args;
        // Opening the page again asks for today's addresses. Its main-side
        // snapshot can precede a queued pairing write, so only the first
        // start may seed this owner's current link/revocation state.
        if (!savedBookLoaded) {
          saved.revoked
            .slice(-MAX_AUDIO_REVOKED_COMPUTERS)
            .forEach((id) => revoked.add(id));
          links = saved.links.slice(-MAX_AUDIO_GROUP_COMPUTERS);
          savedBookLoaded = true;
        }
        return network().start(credentials);
      }
      case 'lan.join':
        network().join(...request.args);
        return undefined;
      case 'lan.unlink':
        network().unlink(...request.args);
        return undefined;
      case 'lan.signal':
        network().sendSignal(...request.args);
        return undefined;
      case 'lan.audio':
        network().sendAudio(...request.args);
        return undefined;
      case 'lan.retry':
        lan?.retry();
        return undefined;
      case 'streams.replay':
        streaming.clear();
        return undefined;
      case 'lan.stop':
        lan?.stop();
        lan = undefined;
        return undefined;
      case 'routing': {
        const [routing] = request.args;
        targets = routing.targets;
        const before = [...receive.keys()];
        receive.clear();
        routing.receive.forEach(({ peerId, volume }) =>
          receive.set(peerId, volume),
        );
        before
          .filter((peerId) => !receive.has(peerId))
          .forEach((peerId) => {
            streaming.delete(peerId);
            removeFromPlayer(peerId);
          });
        return undefined;
      }
      case 'capture.start': {
        nextId += 1;
        const id = nextId;
        await captures.acquire(id);
        event({ type: 'helper-pid', pid: helperPid() });
        return id;
      }
      case 'capture.close': {
        const [id] = request.args;
        await captures.release(id);
        event({ type: 'helper-pid', pid: helperPid() });
        telemetry.forget(`capture:${id}`);
        return undefined;
      }
      case 'playback.start': {
        nextId += 1;
        const id = nextId;
        await players.acquire(id);
        event({ type: 'helper-pid', pid: helperPid() });
        playing = id;
        return id;
      }
      case 'playback.push': {
        const [id, chunk] = request.args;
        players.get(id).push(chunk);
        return undefined;
      }
      case 'playback.remove': {
        const [id, peerId] = request.args;
        players.get(id).remove(peerId);
        return undefined;
      }
      case 'playback.reset':
        players.get(request.args[0]).reset();
        streaming.clear();
        return undefined;
      case 'playback.volume': {
        const [id, volume] = request.args;
        players.get(id).setVolume(volume);
        return undefined;
      }
      case 'playback.output': {
        const [id, output] = request.args;
        return players.get(id).setOutput(output);
      }
      case 'playback.close': {
        const [id] = request.args;
        if (playing === id) {
          playing = 0;
          streaming.clear();
        }
        await players.release(id);
        event({ type: 'helper-pid', pid: helperPid() });
        return undefined;
      }
      case 'helper.lease': {
        if (leases.size >= 16 || aliases.size >= 16) {
          throw new Error('Share Audio helper lease limit reached.');
        }
        nextId += 1;
        const id = nextId;
        const requests = new Map<number, number>();
        aliases.set(id, requests);
        const lease = await leaseHelper({
          reply: (reply) => {
            const alias = reply.kind === 9 ? requests.get(reply.id) : undefined;
            // Child exits are broadcast by the native helper. Only the lease
            // that started that child can translate its native id back to main.
            if (reply.kind === 9 && alias === undefined) {
              return;
            }
            if (reply.kind === 9) {
              requests.delete(reply.id);
            }
            const message: TAudioEvent = {
              type: 'helper-reply',
              id,
              reply: { ...reply, id: alias ?? reply.id },
            };
            if (reply.kind === 5) {
              telemetry.send(`helper:${id}:${reply.id}`, message);
            } else {
              event(message);
            }
          },
          stopped: () => {
            leases.delete(id);
            aliases.delete(id);
            event({ type: 'helper-stopped', id });
          },
        }).catch((error: unknown) => {
          aliases.delete(id);
          throw error;
        });
        leases.set(id, lease);
        event({ type: 'helper-pid', pid: helperPid() });
        return { id, pid: helperPid() };
      }
      case 'helper.request': {
        const [id, alias, kind, payload] = request.args;
        const lease = leases.get(id);
        if (!lease) {
          throw new Error('The LAN audio helper stopped.');
        }
        const requests = aliases.get(id);
        if (kind === 8 && (requests?.size ?? 0) >= 16) {
          throw new Error('Share Audio capture request limit reached.');
        }
        const sent = lease.request(
          kind,
          payload ? Buffer.from(payload) : undefined,
        );
        if (kind === 8) {
          requests?.set(sent.id, alias);
        }
        try {
          await sent.answered;
        } catch (error) {
          requests?.delete(sent.id);
          throw error;
        }
        return undefined;
      }
      case 'helper.send': {
        const [id, packet] = request.args;
        const lease = leases.get(id);
        if (!lease) {
          throw new Error('The LAN audio helper stopped.');
        }
        lease.send(Buffer.from(packet));
        return undefined;
      }
      case 'helper.release': {
        const [id] = request.args;
        leases.get(id)?.release();
        leases.delete(id);
        aliases.delete(id);
        event({ type: 'helper-pid', pid: helperPid() });
        return undefined;
      }
      default:
        throw new Error('Invalid Share Audio command.');
    }
  };
  return (message: TAudioRequest | { type: 'credit'; key: string }) => {
    if (message.type === 'credit') {
      telemetry.credit(message.key);
    } else {
      execute(message).then(
        (value) => post({ type: 'answer', id: message.id, value }),
        // Never forward arbitrary exceptions: pair/auth parsing can contain
        // secrets. The system's code for the failure is not one.
        (error: unknown) =>
          post({
            type: 'answer',
            id: message.id,
            error: 'Share Audio operation failed.',
            ...failureCode(error),
          }),
      );
    }
  };
};
