/* FluidEQ — GPL-3.0-or-later */

/**
 * Share Audio's link in C++ (`FluidEQ-Share.exe`) against the TypeScript
 * link every other FluidEQ runs (`remoteAudioLan.ts`), live, on this
 * machine's own private address: what one says, the other has to read.
 *
 * The C++ side is driven exactly as main drives it (`host.ts` over
 * `shareServiceProcess.ts`); the TypeScript computers are three links in
 * this process. They pair both ways (each listening and each joining),
 * exchange control messages, send sound both ways — the C++ side's player
 * is a stand-in helper that answers each chunk with its first sample, so
 * nothing is played — introduce two computers to each other through the
 * C++ one, unlink, reconnect, and stop.
 *
 * Opens no audio device and sends nothing past this machine. Every wait is
 * on an event; a step that never comes is the run failing.
 */
import assert from 'assert/strict';
import { spawn } from 'child_process';
import path from 'path';
import createRemoteAudioLan from '../../src/main/remoteAudioLan';
import { computerIdOf } from '../../src/main/remoteAudioLanProtocol';
import { lanAddresses } from '../../src/main/remoteAudioLanAddresses';
import { createAudioWorkerHost } from '../../src/main/shareAudio/host';
import {
  createShareServiceProcess,
  type IShareServiceChild,
} from '../../src/main/shareAudio/shareServiceProcess';
import type { TAudioEvent } from '../../src/main/shareAudio/protocol';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../src/common/remoteAudio';
import type { IAudioGroupLink } from '../../src/common/remoteAudioGroup';
import type {
  ILanLinkBook,
  IRemoteAudioLan,
} from '../../src/main/remoteAudioLanTypes';

const service = path.resolve(
  process.argv[2] ?? 'native/.build/bin/FluidEQ-Share.exe',
);
const helper = path.resolve(
  process.argv[3] ?? 'native/.build/share-fake-playback-helper.exe',
);

/** A list that resolves a wait the moment something matching joins it. */
const createLog = <T>() => {
  const items: T[] = [];
  const waits: { test(item: T): boolean; resolve(item: T): void }[] = [];
  return {
    items,
    push(item: T) {
      items.push(item);
      waits
        .filter((wait) => wait.test(item))
        .forEach((wait) => {
          waits.splice(waits.indexOf(wait), 1);
          wait.resolve(item);
        });
    },
    next(test: (item: T) => boolean, after = 0): Promise<T> {
      const found = items.slice(after).find(test);
      if (found) {
        return Promise.resolve(found);
      }
      return new Promise((resolve) => {
        waits.push({ test, resolve });
      });
    },
  };
};

/** A TypeScript computer: its link, what it hears, its book. */
const createComputer = () => {
  const signals = createLog<ILanRemoteAudioSignal>();
  const audio = createLog<ILanRemoteAudioChunk>();
  const links: IAudioGroupLink[] = [];
  const revoked = new Set<string>();
  const book: ILanLinkBook = {
    groupLinks: () => links,
    saveGroupLink: (link) => {
      const at = links.findIndex((kept) => kept.computerId === link.computerId);
      if (at >= 0) {
        links.splice(at, 1);
      }
      links.push(link);
    },
    isRevoked: (id) => revoked.has(id),
    revoke: (id) => revoked.add(id),
    unrevoke: (id) => revoked.delete(id),
    forgetJoin: (id) => {
      const at = links.findIndex((kept) => kept.computerId === id);
      if (at >= 0) {
        links.splice(at, 1);
      }
    },
  };
  const lan: IRemoteAudioLan = createRemoteAudioLan(
    (message) => signals.push(message),
    (chunk) => audio.push(chunk),
    () => undefined,
    () => undefined,
    book,
  );
  return { lan, signals, audio, links, revoked };
};

const readyFrom = (computerId: string) => (message: ILanRemoteAudioSignal) =>
  message.signal.kind === 'peer-ready' &&
  message.signal.computerId === computerId;

const smoke = async () => {
  if (process.platform !== 'win32') {
    process.stdout.write('Share Audio service: Windows only; skipped.\n');
    return;
  }
  if (lanAddresses().length === 0) {
    process.stdout.write(
      'Share Audio service: this machine has no private address; skipped.\n',
    );
    return;
  }
  const events = createLog<TAudioEvent>();
  const host = createAudioWorkerHost(service, (file) =>
    createShareServiceProcess(
      file,
      (program) =>
        spawn(program, ['--helper', helper], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        }) as unknown as IShareServiceChild,
    ),
  );
  host.listen((event) => events.push(event));
  const signalsHere = (test: (message: ILanRemoteAudioSignal) => boolean) =>
    events.next(
      (event) => event.type === 'signal' && test(event.message),
    ) as Promise<Extract<TAudioEvent, { type: 'signal' }>>;

  const status = await host.request('status');
  assert.equal(typeof status.scheduling, 'boolean');

  // The C++ computer listens; the first TypeScript one pastes its code.
  const here = await host.request('lan.start', undefined, {
    revoked: [],
    links: [],
  });
  assert.ok(here.details.code, 'the service makes a pairing code');
  const one = createComputer();
  const oneSession = await one.lan.start();
  const oneId = computerIdOf(oneSession.credentials.secret);
  one.lan.join(here.details.code, true);
  const [inbound, joined] = await Promise.all([
    signalsHere(readyFrom(oneId)),
    one.signals.next(readyFrom(here.details.computerId)),
  ]);
  const { peerId } = inbound.message;
  assert.equal(joined.peerId, peerId, 'both ends name the link alike');
  assert.equal(joined.signal.kind === 'peer-ready' && joined.signal.joined, true);
  // The group handshake: each side keeps the other's way back.
  await events.next(
    (event) => event.type === 'book-link' && event.link.computerId === oneId,
  );
  assert.ok(
    one.links.some((link) => link.computerId === here.details.computerId),
    'the TypeScript side saved the way back too',
  );
  process.stdout.write('  paired: TypeScript joined the C++ listener\n');

  // Control messages both ways.
  one.lan.sendSignal({
    peerId,
    signal: {
      kind: 'stream-mode',
      mode: 'music',
      duplex: { sends: true, plays: true },
    },
  });
  await signalsHere(
    (message) =>
      message.peerId === peerId &&
      message.signal.kind === 'stream-mode' &&
      message.signal.mode === 'music',
  );
  await host.request('lan.signal', {
    peerId,
    signal: {
      kind: 'stream-mode',
      mode: 'video',
      duplex: { sends: true, plays: false },
    },
  });
  await one.signals.next(
    (message) =>
      message.signal.kind === 'stream-mode' &&
      message.signal.duplex?.plays === false,
  );
  process.stdout.write('  control messages read both ways\n');

  // Sound from the C++ side, sample for sample.
  const samples = new Float32Array([0.5, -0.5, 0.25, -0.25, 1, -1, 0, 0.125]);
  await host.request('lan.audio', {
    peerId,
    sequence: 5,
    sampleRate: 48000,
    channels: 2,
    frames: 4,
    pcm: samples.slice().buffer,
  });
  const heard = await one.audio.next((chunk) => chunk.sequence === 5);
  assert.deepEqual([...new Float32Array(heard.pcm)], [...samples]);
  // Sound from the TypeScript side, through the C++ player at half volume.
  await host.request('routing', {
    targets: [],
    receive: [{ peerId, volume: 0.5 }],
    smooth: false,
  });
  await host.request('playback.start');
  one.lan.sendAudio({
    peerId,
    sequence: 9,
    sampleRate: 48000,
    channels: 2,
    frames: 4,
    pcm: samples.slice().buffer,
  });
  const meter = (await events.next(
    (event) => event.type === 'meter' && event.meter.bufferedMs === 9,
  )) as Extract<TAudioEvent, { type: 'meter' }>;
  assert.equal(meter.meter.sourceId, peerId);
  assert.equal(meter.meter.peak, 0.25, 'played at its own volume');
  await events.next(
    (event) => event.type === 'streaming' && event.peerId === peerId,
  );
  process.stdout.write('  sound read both ways, at its own volume\n');

  // A second TypeScript computer: the C++ one introduces the two.
  const two = createComputer();
  const twoSession = await two.lan.start();
  const twoId = computerIdOf(twoSession.credentials.secret);
  two.lan.join(here.details.code, true);
  await signalsHere(readyFrom(twoId));
  await Promise.all([
    one.signals.next(readyFrom(twoId)),
    two.signals.next(readyFrom(oneId)),
  ]);
  process.stdout.write('  introduced: two computers linked through it\n');

  // Unlinked here: the other side is told to forget this code.
  await host.request('lan.unlink', { computerId: twoId });
  await two.signals.next(
    (message) =>
      message.signal.kind === 'stop' &&
      two.revoked.has(here.details.computerId),
  );
  await events.next(
    (event) =>
      event.type === 'book' &&
      event.operation === 'revoke' &&
      event.value === twoId,
  );
  process.stdout.write('  unlinked: told to forget, and refused after\n');

  // Reconnected by hand: the joiner finds the listener again.
  const before = events.items.length;
  assert.equal(
    await host.request('lan.reconnect', { computerId: oneId }),
    true,
  );
  await events.next(
    (event) =>
      event.type === 'signal' &&
      event.message.signal.kind === 'peer-ready' &&
      event.message.signal.computerId === oneId,
    before,
  );
  process.stdout.write('  reconnected by hand\n');

  // The C++ computer joins a TypeScript listener.
  const three = createComputer();
  const threeSession = await three.lan.start();
  const threeId = computerIdOf(threeSession.credentials.secret);
  assert.ok(threeSession.details.code);
  await host.request('lan.join', threeSession.details.code, true);
  const [cppJoined] = await Promise.all([
    signalsHere(readyFrom(threeId)),
    three.signals.next(readyFrom(here.details.computerId)),
  ]);
  assert.equal(
    cppJoined.message.signal.kind === 'peer-ready' &&
      cppJoined.message.signal.joined,
    true,
  );
  process.stdout.write('  paired: the C++ side joined a TypeScript listener\n');

  // Stopped: every computer still linked hears it gone.
  const oneHeard = one.signals.items.length;
  const threeHeard = three.signals.items.length;
  await host.request('lan.stop');
  await Promise.all([
    one.signals.next((message) => message.signal.kind === 'stop', oneHeard),
    three.signals.next(
      (message) => message.signal.kind === 'stop',
      threeHeard,
    ),
  ]);
  [one, two, three].forEach((computer) => computer.lan.stop());
  host.stop();
  process.stdout.write(
    'Share Audio service: the C++ link and the TypeScript link read each other.\n',
  );
};

smoke().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
