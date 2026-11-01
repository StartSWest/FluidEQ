/* FluidEQ — GPL-3.0-or-later */
// Only address policy and discovery routing are adapted to isolated loopback.
// Authentication, TCP/UDP sockets, encryption and PCM packets are production.
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { fork } = require('node:child_process');
const dgram = require('node:dgram');
const path = require('node:path');

if (process.argv[2] === 'peer') {
  require('ts-node/register/transpile-only');
  const log = require('electron-log/node');
  // Fixture diagnostics must never write into the installed app's log.
  log.transports.file.resolvePathFn = () =>
    path.resolve(
      __dirname,
      '../../outputs',
      `reconnect-peer-${process.pid}.log`,
    );
  log.transports.console.level = false;
  const Module = require('node:module');
  const originalLoad = Module._load;
  const realCreateSocket = dgram.createSocket.bind(dgram);
  const hub = Number(process.argv[3]);
  let holdFailure;
  let gated = false;
  let watchedSecret;
  let attemptCount = 0;
  Module._load = function load(request, parent, isMain) {
    const loaded = originalLoad.call(this, request, parent, isMain);
    if (
      request.endsWith('remoteAudioLanJoin') &&
      process.argv[4] === 'hold-first-failure'
    ) {
      // Keep the real ECONNREFUSED, but deliver its promise continuation after
      // the returning peer's authenticated UDP announcement. Only event order
      // is controlled: the bug discarded that announcement while still pending.
      return {
        ...loaded,
        joinAt: (options) => {
          attemptCount += 1;
          const attempt = loaded.joinAt(options);
          if (gated) return attempt;
          gated = true;
          return {
            ...attempt,
            joined: attempt.joined.catch(
              (error) =>
                new Promise((_resolve, reject) => {
                  holdFailure = () => reject(error);
                  process.send?.({ type: 'failedAttempt', code: error.code });
                }),
            ),
          };
        },
      };
    }
    if (request.endsWith('remoteAudioLanAddresses')) {
      return {
        ...loaded,
        lanAddresses: () => ['127.0.0.1'],
        discoveryTargets: () => ['255.255.255.255'],
        isPrivateIpv4: (address) => address === '127.0.0.1',
      };
    }
    if (request === 'dgram') {
      return {
        ...loaded,
        createSocket: (options) => {
          const socket = realCreateSocket(options);
          const bind = socket.bind.bind(socket);
          const send = socket.send.bind(socket);
          socket.bind = () => bind(0, '127.0.0.1');
          socket.send = (data, _port, _address, callback) =>
            send(data, hub, '127.0.0.1', callback);
          socket.once('listening', () =>
            process.send?.({ type: 'udp', port: socket.address().port }),
          );
          socket.on('message', (packet) => {
            if (!holdFailure || !watchedSecret) return;
            const {
              decodeDiscoveryAnnouncement,
            } = require('../../src/main/remoteAudioDiscovery');
            if (!decodeDiscoveryAnnouncement(packet, watchedSecret)) return;
            const release = holdFailure;
            holdFailure = undefined;
            queueMicrotask(() => {
              release();
              setImmediate(() =>
                process.send?.({ type: 'released', attempts: attemptCount }),
              );
            });
          });
          return socket;
        },
      };
    }
    return loaded;
  };
  const createLan = require('../../src/main/remoteAudioLan').default;
  let lan;
  let saved = new Map();
  let peers = new Map();
  const report = () =>
    process.send?.({
      type: 'state',
      peers: [...peers],
      saved: [...saved.values()],
    });
  process.on('message', async (command) => {
    try {
      if (command.type === 'start') {
        watchedSecret = command.codes?.[0]
          ? JSON.parse(Buffer.from(command.codes[0].split('.')[1], 'base64url'))
              .secret
          : undefined;
        saved = new Map(
          (command.saved ?? []).map((link) => [link.computerId, link]),
        );
        peers = new Map();
        lan = createLan(
          ({ peerId, signal }) => {
            if (signal.kind === 'peer-ready')
              peers.set(signal.computerId, peerId);
            if (signal.kind === 'stop')
              for (const [id, peer] of peers)
                if (peer === peerId) peers.delete(id);
            report();
          },
          (chunk) =>
            process.send?.({
              type: 'pcm',
              sequence: chunk.sequence,
              pcm: [...new Float32Array(chunk.pcm)],
            }),
          () => process.send?.({ type: 'fault', message: 'LAN failed' }),
          () => undefined,
          {
            isRevoked: () => false,
            revoke: () => undefined,
            unrevoke: () => undefined,
            forgetJoin: (id) => saved.delete(id),
            groupLinks: () => [...saved.values()],
            saveGroupLink: (link) => {
              saved.set(link.computerId, link);
              report();
            },
          },
        );
        const session = await lan.start(command.identity);
        for (const code of command.codes ?? []) lan.join(code, false);
        process.send?.({ type: 'started', session });
      } else if (command.type === 'join') {
        lan.join(command.code, true);
      } else if (command.type === 'send') {
        const peerId = peers.get(command.computerId);
        assert(peerId, 'No authenticated peer');
        lan.sendAudio({
          peerId,
          sequence: command.sequence,
          sampleRate: 48000,
          channels: 1,
          frames: 4,
          pcm: Float32Array.from([0.125, -0.25, 0.5, -0.75]).buffer,
        });
      } else if (command.type === 'stop') {
        lan.stop();
        process.disconnect();
      }
    } catch (error) {
      process.send?.({ type: 'fault', message: error.message });
    }
  });
} else {
  const { test } = require('node:test');
  for (const scenario of ['lost', 'cold']) {
    test(
      scenario === 'lost'
        ? 'authenticated discovery survives a pending refused TCP attempt'
        : 'cold saved Windows-style pair reconnects after both listener ports change',
      { timeout: 25000 },
      async (t) => {
        const changes = new EventEmitter();
        const hub = dgram.createSocket('udp4');
        const live = new Set();
        const all = new Set();
        const faults = [];
        let phase = 'boot';
        t.signal.addEventListener(
          'abort',
          () => {
            for (const item of all) item.child.kill();
          },
          { once: true },
        );
        hub.on('message', (packet) => {
          for (const item of live)
            if (item.udp) hub.send(packet, item.udp, '127.0.0.1');
        });
        hub.bind(0, '127.0.0.1');
        await once(hub, 'listening');
        const wait = (condition, label) =>
          new Promise((resolve, reject) => {
            const abort = () => {
              changes.removeListener('change', check);
              reject(
                new Error(
                  'Stopped at ' +
                    label +
                    ': ' +
                    JSON.stringify(
                      [...live].map((x) => ({
                        peers: x.peers,
                        saved: x.saved.length,
                        started: !!x.session,
                      })),
                    ),
                ),
              );
            };
            const check = () => {
              if (faults.length) {
                changes.removeListener('change', check);
                reject(new Error(JSON.stringify(faults)));
              } else if (condition()) {
                changes.removeListener('change', check);
                t.signal.removeEventListener('abort', abort);
                resolve();
              }
            };
            changes.on('change', check);
            t.signal.addEventListener('abort', abort, { once: true });
            check();
          });
        const start = async (
          identity,
          saved = [],
          codes = [],
          gatedFailure = false,
        ) => {
          const child = fork(
            __filename,
            [
              'peer',
              String(hub.address().port),
              ...(gatedFailure ? ['hold-first-failure'] : []),
            ],
            {
              cwd: path.resolve(__dirname, '../..'),
              stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            },
          );
          const item = {
            child,
            peers: [],
            saved,
            session: undefined,
            pcm: [],
            udp: undefined,
            errors: '',
          };
          child.stderr.on('data', (data) => {
            item.errors += data.toString();
          });
          child.on('error', (error) => {
            faults.push({ phase, message: error.message });
            changes.emit('change');
          });
          all.add(item);
          live.add(item);
          child.on('message', (message) => {
            if (message.type === 'state') {
              item.peers = message.peers;
              item.saved = message.saved;
            }
            if (message.type === 'started') item.session = message.session;
            if (message.type === 'udp') item.udp = message.port;
            if (message.type === 'pcm') item.pcm.push(message);
            if (message.type === 'failedAttempt')
              item.failedAttempt = message.code;
            if (message.type === 'released') item.released = message.attempts;
            if (message.type === 'fault')
              faults.push({ phase, message: message.message });
            changes.emit('change');
          });
          child.on('exit', (code) => {
            live.delete(item);
            if (code && !t.signal.aborted)
              faults.push({ phase, code, error: item.errors });
            changes.emit('change');
          });
          child.send({ type: 'start', identity, saved, codes });
          await wait(() => item.session, phase + ':listener');
          return item;
        };
        const stop = async (item) => {
          live.delete(item);
          const exited = once(item.child, 'exit');
          item.child.send({ type: 'stop' });
          await exited;
        };
        try {
          if (scenario === 'lost') {
            const net = require('node:net');
            const reservation = net.createServer();
            reservation.listen(0, '127.0.0.1');
            await once(reservation, 'listening');
            const port = reservation.address().port;
            reservation.close();
            await once(reservation, 'close');
            const code =
              'FLUIDEQ-LAN-2.' +
              Buffer.from(
                JSON.stringify({
                  address: '127.0.0.1',
                  addresses: ['127.0.0.1'],
                  port,
                  secret: 'b'.repeat(43),
                  deviceName: 'B',
                }),
              ).toString('base64url');
            const a = await start(
              { port: 0, secret: 'a'.repeat(43) },
              [],
              [code],
              true,
            );
            await wait(
              () => a.failedAttempt,
              'real TCP refusal before B boots',
            );
            assert.equal(a.failedAttempt, 'ECONNREFUSED');
            const b = await start({ port, secret: 'b'.repeat(43) });
            await wait(
              () => a.released,
              'authenticated B discovery before refusal continuation',
            );
            assert.equal(
              a.released,
              2,
              'The fresh announcement was lost: no second real connection attempt',
            );
            await wait(
              () => a.peers.length === 1 && b.peers.length === 1,
              'actual authentication after rediscovery',
            );
            a.child.send({
              type: 'send',
              computerId: b.session.details.computerId,
              sequence: 1,
            });
            b.child.send({
              type: 'send',
              computerId: a.session.details.computerId,
              sequence: 1,
            });
            await wait(
              () => a.pcm.length && b.pcm.length,
              'bidirectional recovered PCM',
            );
            assert.deepEqual(a.pcm[0].pcm, [0.125, -0.25, 0.5, -0.75]);
            assert.deepEqual(b.pcm[0].pcm, [0.125, -0.25, 0.5, -0.75]);
            t.diagnostic(
              'Real ECONNREFUSED, real authenticated UDP announcement while pending, then real authenticated TCP and unchanged PCM in both directions',
            );
            return;
          }
          let a = await start({ port: 0, secret: 'a'.repeat(43) });
          let b = await start({ port: 0, secret: 'b'.repeat(43) });
          const aCode = a.session.details.code;
          b.child.send({ type: 'join', code: aCode });
          await wait(
            () =>
              a.peers.length === 1 &&
              b.peers.length === 1 &&
              a.saved.length === 1 &&
              b.saved.length === 1 &&
              a.saved[0].secret === b.saved[0].secret,
            'initial persisted pairing',
          );
          for (let round = 0; round < 4; round += 1) {
            phase = 'pcm round ' + round;
            a.child.send({
              type: 'send',
              computerId: b.session.details.computerId,
              sequence: round,
            });
            b.child.send({
              type: 'send',
              computerId: a.session.details.computerId,
              sequence: round,
            });
            await wait(() => a.pcm.length && b.pcm.length, phase);
            assert.deepEqual(a.pcm[0].pcm, [0.125, -0.25, 0.5, -0.75]);
            assert.deepEqual(b.pcm[0].pcm, [0.125, -0.25, 0.5, -0.75]);
            if (round === 3) break;
            const stateA = {
              identity: { ...a.session.credentials, port: 0 },
              saved: a.saved,
            };
            const stateB = {
              identity: { ...b.session.credentials, port: 0 },
              saved: b.saved,
            };
            phase = 'both offline round ' + round;
            await Promise.all([stop(a), stop(b)]);
            phase = 'cold reconnect round ' + round;
            [a, b] = await Promise.all([
              start(stateA.identity, stateA.saved),
              start(stateB.identity, stateB.saved, [aCode]),
            ]);
            await wait(
              () => a.peers.length === 1 && b.peers.length === 1,
              phase,
            );
          }
          t.diagnostic(
            '4 bidirectional PCM rounds; 3 cold restarts with changed ports and original pasted code replay',
          );
        } finally {
          const children = [...all].filter(
            (item) =>
              item.child.pid !== undefined &&
              item.child.exitCode === null &&
              item.child.signalCode === null,
          );
          const exits = children.map((item) => once(item.child, 'exit'));
          live.clear();
          for (const item of children) item.child.kill();
          const closed = once(hub, 'close');
          hub.close();
          await Promise.all([...exits, closed]);
        }
      },
    );
  }
}
