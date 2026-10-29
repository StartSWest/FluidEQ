/* FluidEQ — GPL-3.0-or-later */
// All children belong to this bounded fixture. No app, audio device, desktop
// or external network is opened. Native input uses the shipped queue/writer.
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require('worker_threads');
const { fork, spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const role =
  workerData?.role ||
  (process.argv[2] === '--audio-process' ? 'audio' : 'parent');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const pause = new Int32Array(new SharedArrayBuffer(4));
const load = process.argv[3] || 'sleep';
const sourceExe = process.argv[4];
const stalls = [];
const workload =
  role === 'parent' && load === 'load'
    ? JSON.stringify(
        Array.from({ length: 20000 }, (_, id) => ({
          id,
          title: `Track ${id}`,
          samples: [0.25, -0.25, 0.125],
        })),
      )
    : undefined;
const stallMain = () => {
  const start = now();
  if (workload) {
    for (let count = 0; count < 8; count += 1) JSON.parse(workload);
  } else Atomics.wait(pause, 0, 0, 60);
  stalls.push(now() - start);
};
if (process.env.FEQ_FIXTURE_SOURCE === '1')
  require('ts-node/register/transpile-only');
if (role === 'observer') {
  const sent = [],
    received = [];
  // Stamp at the actual handoff, not when this lower-priority observer gets
  // CPU. Otherwise observer starvation would invent an audio-path dropout.
  parentPort.on('message', ({ type, sequence, at }) => {
    if (type === 'sent') sent.push([sequence, at]);
    else if (type === 'received') received.push([sequence, at]);
    else if (type === 'finish') {
      const gap = (items) =>
        items.reduce(
          (max, item, index) =>
            index ? Math.max(max, item[1] - items[index - 1][1]) : max,
          0,
        );
      parentPort.postMessage({
        type: 'result',
        sendGap: gap(sent),
        receiveGap: gap(received),
        sent: sent.length,
        received: received.length,
        receiveTimes: received.map(([id, time]) => [id, time - received[0][1]]),
        consecutive: received.every(([id], index) => id === index),
        ordered: received.every(
          ([id], index) => !index || id > received[index - 1][0],
        ),
      });
    }
  });
  parentPort.postMessage({ type: 'observer-ready' });
} else if (role === 'visual') {
  const {
    createSenderSpectrum,
  } = require('../../src/renderer/remoteAudio/senderSpectrum');
  const spectrum = createSenderSpectrum();
  let frames = 0,
    lastRead = 0;
  parentPort.on('message', (message) => {
    if (message.type === 'finish') parentPort.postMessage({ frames });
    else {
      spectrum.push(message.chunk);
      const at = now();
      if (at - lastRead >= 33) {
        const frame = spectrum.read();
        if (frame) {
          if (frame.peaks.some((peak) => peak !== 0.25))
            throw new Error('Visual PCM changed.');
          frames += 1;
          lastRead = at;
        }
      }
    }
  });
} else {
  const protocol = require('../../src/main/remoteAudioLanProtocol');
  const createTransport =
    require('../../src/main/remoteAudioTransport').default;
  const {
    createCaptureFrameReader,
  } = require('../../src/main/nativeCaptureProcess');
  const key = protocol.keyFromSecret('public-isolated-fixture-only');
  const priorityBefore = os.getPriority();
  const scheduling =
    role === 'audio'
      ? require('../../src/main/shareAudio/scheduling').startAudioScheduling()
      : { active: false, close: () => {} };
  process.once('exit', scheduling.close);
  if (os.getPriority() !== priorityBefore)
    throw new Error('Process priority changed.');
  let cpu, steadyCpu, steadyAt;
  const visual =
    role === 'parent'
      ? new Worker(__filename, { workerData: { role: 'visual' } })
      : undefined;
  const hostPost = (message) => process.send(message);
  const complete = async (message) => {
    const visualFrames = await new Promise((resolve) => {
      visual.once('message', ({ frames }) => resolve(frames));
      visual.postMessage({ type: 'finish' });
    });
    const used = process.cpuUsage(cpu),
      steady = process.cpuUsage(steadyCpu);
    const mode = process.argv[2];
    fs.writeFileSync(
      `outputs/share-audio-${mode}-arrivals.txt`,
      message.receiveTimes.map(([id, time]) => `${id} ${time}`).join('\n'),
    );
    const { receiveTimes, ...result } = message;
    process.stdout.write(
      JSON.stringify({
        mode,
        ...result,
        visualFrames,
        workload: workload ? 'fixed-json-parse' : '60ms-main-sleep',
        stallsMs: stalls,
        cpuMs:
          (used.user + used.system) / 1000 +
          (message.audioCpuMs || 0) +
          message.nativeCpuMs,
        steadyCpuMs:
          (steady.user + steady.system) / 1000 +
          (message.audioSteadyCpuMs || 0),
        steadyDurationMs: now() - steadyAt,
        rssMiB:
          process.memoryUsage().rss / 1048576 + (message.audioRssMiB || 0),
      }) + '\n',
    );
    await visual.terminate();
  };
  const startPipeline = (isolated) => {
    const observer = new Worker(__filename, {
      workerData: { role: 'observer' },
    });
    let source,
      nativeStats,
      captured = () => {},
      arriving;
    let warmed = false,
      firstStall = false,
      secondStall = false;
    const socket = Object.assign(new EventEmitter(), {
      readyState: 1,
      bufferedAmount: 0,
      close: () => {},
      send: (packet) => {
        const at = now();
        observer.postMessage({
          type: 'sent',
          sequence: protocol.openPacket(packet, key).clear.readUInt32LE(0),
          at,
        });
      },
    });
    const play = (chunk) => {
      const at = now();
      if (new Float32Array(chunk.pcm).some((value) => value !== 0.25))
        throw new Error('PCM changed.');
      observer.postMessage({ type: 'received', sequence: chunk.sequence, at });
    };
    const transport = createTransport({
      emitAudio: (chunk) => (isolated ? arriving(chunk) : play(chunk)),
      emitSignal: () => {},
      emitNetwork: () => {},
    });
    transport.attach('fixture', socket, key);
    const startSource = () => {
      cpu = process.cpuUsage();
      source = spawn(sourceExe, [String(process.pid)], {
        windowsHide: true,
        stdio: ['pipe', 'overlapped', 'pipe'],
      });
      let stderr = '';
      source.stderr.on('data', (bytes) => {
        stderr = (stderr + bytes.toString()).slice(-4096);
      });
      source.on('error', (error) => {
        throw error;
      });
      source.stdout.on(
        'data',
        createCaptureFrameReader({
          ready: () => source.stdin.write('g'),
          invalid: (error) => {
            throw error;
          },
          reply: () => {},
          audio: (header, payload) => {
            if (header.sequence >= 1600) {
              source.stdin.end();
              return;
            }
            const chunk = {
              peerId: 'fixture',
              sequence: header.sequence,
              sampleRate: header.sampleRate,
              channels: header.channels,
              frames: header.frames,
              pcm: Uint8Array.from(payload).buffer,
            };
            if (isolated) captured(chunk);
            else {
              transport.sendAudio(chunk);
              visual.postMessage({ chunk });
            }
            socket.emit(
              'message',
              protocol.sealPacket(
                protocol.PACKET_AUDIO,
                protocol.encodeAudioRaw(protocol.normalizeAudioChunk(chunk)),
                key,
              ),
            );
            if (!warmed && header.sequence >= 400) {
              warmed = true;
              steadyCpu = process.cpuUsage();
              steadyAt = now();
              if (isolated) hostPost({ type: 'fixture-warm' });
            }
            if (
              (!firstStall && header.sequence >= 800) ||
              (!secondStall && header.sequence >= 1200)
            ) {
              if (!firstStall) firstStall = true;
              else secondStall = true;
              if (isolated) hostPost({ type: 'fixture-stall' });
              else stallMain();
            }
            if (header.sequence === 1599) source.stdin.end();
          },
        }),
      );
      source.on('close', (code) => {
        if (code !== 0) throw new Error(`Native source failed: ${stderr}`);
        nativeStats = JSON.parse(stderr.trim());
        setImmediate(() => observer.postMessage({ type: 'finish' }));
      });
    };
    if (isolated) {
      const {
        createAudioRuntime,
      } = require('../../src/main/shareAudio/runtime');
      const handle = createAudioRuntime({
        post: hostPost,
        scheduling: scheduling.active,
        createLan: (_signal, audio) => {
          arriving = audio;
          return {
            start: async () => ({
              credentials: { port: 1, secret: 'fixture' },
              details: { computerId: 'fixture', deviceName: 'Fixture' },
            }),
            sendAudio: transport.sendAudio,
            stop: transport.closeAll,
          };
        },
        startCapture: async (callback) => {
          captured = callback;
          return { close: () => source?.stdin.end() };
        },
        startPlayback: async () => ({
          push: play,
          close: async () => {},
          remove: () => {},
          reset: () => {},
        }),
        leaseHelper: async () => {
          throw new Error(
            'No native playback output is opened by this fixture.',
          );
        },
        helperPid: () => undefined,
      });
      process.on('message', (message) => {
        if (message.type === 'fixture-start') startSource();
        else handle(message);
      });
      process.on('disconnect', () => process.exit(0));
    }
    observer.on('message', async (message) => {
      if (message.type === 'observer-ready') {
        if (isolated) hostPost({ type: 'fixture-ready' });
        else startSource();
      } else if (message.type === 'result') {
        transport.closeAll();
        await observer.terminate();
        if (isolated) {
          const used = process.cpuUsage(cpu),
            steady = process.cpuUsage(steadyCpu);
          hostPost({
            ...message,
            ...nativeStats,
            scheduling: scheduling.active,
            schedulingReason: scheduling.reason,
            processPriority: os.getPriority(),
            audioCpuMs: (used.user + used.system) / 1000,
            audioSteadyCpuMs: (steady.user + steady.system) / 1000,
            audioRssMiB: process.memoryUsage().rss / 1048576,
          });
        } else await complete({ ...message, ...nativeStats });
      }
    });
  };
  if (role === 'audio') startPipeline(true);
  else if (process.argv[2] === 'baseline') startPipeline(false);
  else {
    const audio = fork(__filename, ['--audio-process', load, sourceExe], {
      windowsHide: true,
      serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let next = 0;
    const pending = new Map();
    const request = (method, ...args) =>
      new Promise((resolve, reject) => {
        next += 1;
        const id = next;
        pending.set(id, { resolve, reject });
        audio.send({ type: 'request', id, method, args });
      });
    audio.stderr.on('data', (bytes) => process.stderr.write(bytes));
    audio.on('error', (error) => {
      throw error;
    });
    audio.on('message', async (message) => {
      if (message.type === 'fixture-ready') {
        await request('lan.start', undefined, { revoked: [], links: [] });
        await request('playback.start');
        await request('routing', {
          targets: ['fixture'],
          receive: [{ peerId: 'fixture', volume: 1 }],
        });
        await request('capture.start');
        cpu = process.cpuUsage();
        audio.send({ type: 'fixture-start' });
      } else if (message.type === 'answer') {
        const promise = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) promise?.reject(new Error(message.error));
        else promise?.resolve(message.value);
      } else if (message.type === 'fixture-warm') {
        steadyCpu = process.cpuUsage();
        steadyAt = now();
      } else if (message.type === 'fixture-stall') stallMain();
      else if (message.type === 'result') {
        await complete(message);
        audio.disconnect();
      } else if (message.type === 'event' && message.credit) {
        if (message.event.type === 'capture')
          visual.postMessage({ chunk: message.event.chunk });
        audio.send({ type: 'credit', key: message.credit });
      }
    });
  }
}
