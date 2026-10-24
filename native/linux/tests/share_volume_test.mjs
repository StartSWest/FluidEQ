/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
// Run after building the native engine and volume helper. Owns private audio
// servers, never the desktop. PulseAudio can run in an Ubuntu container:
// node native/linux/tests/share_volume_test.mjs pulse <image-with-pulseaudio>
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import createCaptureReader from './share_volume_capture.mjs';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const backend = process.argv[2] || 'pipewire';
assert.ok(['pipewire', 'pipewire-pulse', 'pulse'].includes(backend));
const pipewireServer = backend.startsWith('pipewire');
const image = process.argv[3];
const repo = fileURLToPath(new URL('../../../', import.meta.url));
fs.accessSync(
  process.env.FLUIDEQ_AUDIO_TEST_ENGINE ||
    path.join(repo, 'native/.build/bin/FluidEQ-Engine'),
  fs.constants.X_OK,
);
fs.accessSync(
  path.join(repo, 'native/.build/bin/FluidEQ-Volume'),
  fs.constants.X_OK,
);
if (!process.env.FLUIDEQ_AUDIO_TEST_ROOT) {
  const root = fs.mkdtempSync('/tmp/fluideq-share-volume-');
  const env = { ...process.env, FLUIDEQ_AUDIO_TEST_ROOT: root };
  for (const [key, dir] of Object.entries({
    XDG_RUNTIME_DIR: 'run',
    XDG_CONFIG_HOME: 'config',
    XDG_DATA_HOME: 'data',
    XDG_STATE_HOME: 'state',
    XDG_CACHE_HOME: 'cache',
  })) {
    env[key] = path.join(root, dir);
    fs.mkdirSync(env[key], { mode: 0o700 });
  }
  for (const key of [
    'PIPEWIRE_REMOTE',
    'PIPEWIRE_RUNTIME_DIR',
    'PULSE_SERVER',
    'PULSE_RUNTIME_PATH',
    'DBUS_SESSION_BUS_ADDRESS',
    'DISPLAY',
    'WAYLAND_DISPLAY',
  ])
    delete env[key];
  const config = path.join(
    env.XDG_CONFIG_HOME,
    'wireplumber/wireplumber.conf.d',
  );
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(
    path.join(config, '90-isolated.conf'),
    'wireplumber.profiles = { main = { monitor.alsa = disabled monitor.alsa-midi = disabled monitor.bluez = disabled monitor.bluez-midi = disabled monitor.v4l2 = disabled monitor.libcamera = disabled support.logind = disabled support.reserve-device = disabled } }\n',
  );
  const child = spawn(
    'dbus-run-session',
    ['--', process.execPath, ...process.argv.slice(1)],
    { env, stdio: 'inherit', detached: true },
  );
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => process.kill(-child.pid, signal));
  process.exitCode = (await once(child, 'exit'))[0] ?? 1;
} else {
  const root = process.env.FLUIDEQ_AUDIO_TEST_ROOT;
  assert.ok(root.startsWith('/tmp/fluideq-share-volume-'));
  const children = [];
  const container = `fluideq-share-volume-${process.pid}`;
  const start = (name, args, pipes = false) => {
    const fd = fs.openSync(path.join(root, `${path.basename(name)}.log`), 'a');
    const child = spawn(name, args, {
      stdio: pipes ? ['pipe', 'pipe', fd] : ['ignore', fd, fd],
    });
    fs.closeSync(fd);
    children.push(child);
    return child;
  };
  const waitFor = (file, matches) =>
    new Promise((resolve, reject) => {
      const check = () => {
        if (!fs.existsSync(file)) return;
        try {
          if (matches && !matches(fs.readFileSync(file, 'utf8'))) return;
        } catch {
          return;
        }
        watcher.close();
        resolve();
      };
      const watcher = fs.watch(path.dirname(file), check);
      watcher.on('error', reject);
      check();
    });
  const pulseArgs = (command, args) => [
    'exec',
    '-i',
    '-e',
    'PULSE_SERVER=unix:/test/run/native',
    container,
    command,
    ...args,
  ];
  const command = (name, args) =>
    backend === 'pulse' && image
      ? run('docker', pulseArgs(name, args))
      : run(name, args);
  const audio = (name, args) =>
    backend === 'pulse' && image
      ? start('docker', pulseArgs(name, args), true)
      : start(name, args, true);
  const tone = (target, hz) => {
    const child = pipewireServer
      ? audio('pw-play', [
          '--target',
          target,
          '--raw',
          '--format',
          'f32',
          '--rate',
          '48000',
          '--channels',
          '2',
          '-',
        ])
      : audio('pacat', [
          '--playback',
          `--device=${target}`,
          '--raw',
          '--format=float32le',
          '--rate=48000',
          '--channels=2',
          '--latency-msec=20',
        ]);
    let phase = 0;
    const write = () => {
      if (child.exitCode !== null || child.signalCode || child.stdin.destroyed)
        return;
      const buffer = Buffer.alloc(8192);
      for (let at = 0; at < buffer.length; at += 8) {
        const value = 0.02 * Math.sin((2 * Math.PI * hz * phase++) / 48000);
        buffer.writeFloatLE(value, at);
        buffer.writeFloatLE(value, at + 4);
      }
      if (child.stdin.write(buffer)) setImmediate(write);
      else child.stdin.once('drain', write);
    };
    child.stdin.on('error', () => {});
    write();
    return child;
  };
  const measure = createCaptureReader({ pipewireServer, audio });
  let helper, engine;
  try {
    if (pipewireServer) {
      let ready = waitFor(path.join(process.env.XDG_RUNTIME_DIR, 'pipewire-0'));
      start('pipewire', []);
      await ready;
      start('wireplumber', []);
      for (const name of ['speakers', 'headphones'])
        await run('pw-cli', [
          'create-node',
          'adapter',
          `{ factory.name=support.null-audio-sink node.name=iso_${name} media.class=Audio/Sink object.linger=true audio.position=[FL FR] monitor.channel-volumes=true priority.session=${name === 'speakers' ? 1000 : 900} }`,
        ]);
      fs.mkdirSync(path.join(process.env.XDG_RUNTIME_DIR, 'pulse'));
      ready = waitFor(path.join(process.env.XDG_RUNTIME_DIR, 'pulse/native'));
      start('pipewire-pulse', []);
      await ready;
    } else {
      process.env.PULSE_SERVER = `unix:${root}/run/native`;
      const ready = waitFor(path.join(root, 'run/native'));
      const args = [
        '-n',
        '--daemonize=no',
        '--exit-idle-time=-1',
        `--load=module-native-protocol-unix socket=${image ? '/test/run/native' : `${root}/run/native`} auth-anonymous=1`,
        '--load=module-null-sink sink_name=iso_speakers rate=48000 format=float32le',
        '--load=module-null-sink sink_name=iso_headphones rate=48000 format=float32le',
        '--load=module-stream-restore',
      ];
      if (image)
        start('docker', [
          'run',
          '--rm',
          '--name',
          container,
          '--network',
          'none',
          '-v',
          `${root}:/test`,
          image,
          'pulseaudio',
          ...args,
        ]);
      else start('pulseaudio', args);
      await ready;
      await command('pactl', ['set-default-sink', 'iso_speakers']);
    }
    const engineRoot = path.join(root, 'engine');
    fs.mkdirSync(engineRoot);
    const outputs = path.join(engineRoot, 'outputs.json');
    const ready = waitFor(
      outputs,
      (s) => JSON.parse(s).sink === 'fluideq_sink',
    );
    engine = start(
      process.env.FLUIDEQ_AUDIO_TEST_ENGINE ||
        path.join(repo, 'native/.build/bin/FluidEQ-Engine'),
      [
        '--server',
        backend === 'pipewire' ? 'pipewire' : 'pulse',
        '--root',
        engineRoot,
      ],
    );
    await ready;
    if (pipewireServer) {
      // outputs.json can precede export of the named audio targets. Wait
      // for registry events before clients connect; pw-play otherwise falls
      // back to the default when its requested target does not exist yet.
      const registry = audio('pw-mon', []);
      const names = new Set(['fluideq_share', 'fluideq_send']);
      const events = readline.createInterface({ input: registry.stdout });
      await new Promise((resolve) =>
        events.on('line', (line) => {
          for (const name of names)
            if (line.includes(`node.name = "${name}"`)) names.delete(name);
          if (names.size === 0) resolve();
        }),
      );
      registry.kill();
    }
    helper = start(
      path.join(repo, 'native/.build/bin/FluidEQ-Volume'),
      [],
      true,
    );
    const lines = readline.createInterface({ input: helper.stdout });
    const waiters = new Set();
    let current;
    lines.on('line', (line) => {
      current = line;
      for (const w of waiters)
        if (w.matches(line)) {
          waiters.delete(w);
          w.resolve();
        }
    });
    const reading = (matches) =>
      new Promise((resolve) => {
        if (matches(current || '')) resolve();
        else waiters.add({ matches, resolve });
      });
    await reading((line) => line.startsWith('volume\t'));
    const locals = [tone('fluideq_sink', 440), tone('fluideq_sink', 1320)];
    tone('fluideq_share', 880);
    const closeTo = (actual, wanted, label) =>
      assert.ok(
        Math.abs(actual - wanted) < Math.max(0.00012, wanted * 0.018),
        `${label}: ${actual}, expected ${wanted}`,
      );
    const check = async (
      volume,
      muted,
      output = 'iso_speakers',
      local = true,
    ) => {
      const readings = await Promise.all(
        ['fluideq_send', 'fluideq_send', output].map(measure),
      );
      console.log(
        JSON.stringify({
          backend,
          volume,
          muted,
          output,
          local,
          amplitudes: readings,
          rms: readings.map((r) => r.rms),
        }),
      );
      if (
        pipewireServer &&
        !muted &&
        volume > 0 &&
        (readings[2][1] < 0.0001 || readings[0][0] < 0.0001)
      ) {
        fs.writeFileSync(
          path.join(root, 'failed-graph.json'),
          (await run('pw-dump')).stdout,
        );
      }
      for (const send of readings.slice(0, 2)) {
        closeTo(send.rms, local ? 0.02 : 0, 'outgoing signal RMS');
        if (backend !== 'pipewire' && local) {
          // The PulseAudio route can shift phase between graph quanta.
          // RMS measures signal level; these bins confirm both origins.
          assert.ok(send[0] > 0.014 && send[2] > 0.014);
        } else {
          closeTo(send[0], local ? 0.02 : 0, 'Send origin A');
          closeTo(send[2], local ? 0.02 : 0, 'Send origin B');
        }
        closeTo(send[1], 0, 'received audio excluded');
      }
      const gain = muted ? 0 : volume ** 3;
      closeTo(
        readings[2].rms,
        (local ? Math.sqrt(1.5) * 0.02 : Math.SQRT1_2 * 0.02) * gain,
        'local playback RMS',
      );
      for (let k = 0; k < 3; k++) {
        if (backend !== 'pipewire' && gain && (local || k === 1)) {
          assert.ok(readings[2][k] > 0.014 * gain);
          continue;
        }
        closeTo(
          readings[2][k],
          (local || k === 1 ? 0.02 : 0) * gain,
          'local system playback',
        );
      }
    };
    for (const [volume, muted] of [
      [1, 0],
      [0.5, 0],
      [0, 0],
      [1, 1],
      [1, 0],
    ]) {
      helper.stdin.write(`set ${volume}\nmute ${muted}\n`);
      await reading(
        (line) => line === `volume\t${volume.toFixed(4)}\t${muted}`,
      );
      await check(volume, muted);
    }
    for (const [volume, muted] of [
      [0.5, 0],
      [0, 0],
      [1, 1],
      [1, 0],
    ]) {
      if (pipewireServer) {
        await run('wpctl', [
          'set-volume',
          '@DEFAULT_AUDIO_SINK@',
          String(volume),
        ]);
        await run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', String(muted)]);
      } else {
        await command('pactl', [
          'set-sink-volume',
          '@DEFAULT_SINK@',
          `${volume * 100}%`,
        ]);
        await command('pactl', [
          'set-sink-mute',
          '@DEFAULT_SINK@',
          String(muted),
        ]);
      }
      await reading(
        (line) => line === `volume\t${volume.toFixed(4)}\t${muted}`,
      );
      await check(volume, muted);
    }
    helper.stdin.write('set 0.5\nmute 1\n');
    await reading((line) => line === 'volume\t0.5000\t1');
    const changed = waitFor(outputs, (s) =>
      JSON.parse(s).outputs.some(
        (o) => o.name === 'iso_headphones' && o.target,
      ),
    );
    if (pipewireServer) {
      const dump = JSON.parse((await run('pw-dump')).stdout);
      await run('wpctl', [
        'set-default',
        String(
          dump.find((o) => o.info?.props?.['node.name'] === 'iso_headphones')
            .id,
        ),
      ]);
    } else await command('pactl', ['set-default-sink', 'iso_headphones']);
    await changed;
    await check(0.5, 1, 'iso_headphones');
    helper.stdin.write('set 1\nmute 0\n');
    await reading((line) => line === 'volume\t1.0000\t0');
    await check(1, 0, 'iso_headphones');
    await Promise.all(
      locals.map(async (child) => {
        const ended = once(child, 'exit');
        child.stdin.end();
        await ended;
      }),
    );
    await check(1, 0, 'iso_headphones', false);
    helper.stdin.write('mute 1\n');
    await reading((line) => line === 'volume\t1.0000\t1');
    tone('fluideq_sink', 440);
    tone('fluideq_sink', 1320);
    await check(1, 1, 'iso_headphones');
    helper.stdin.write('mute 0\n');
    await reading((line) => line === 'volume\t1.0000\t0');
    await check(1, 0, 'iso_headphones');
    console.log(
      `PASS ${backend}: two local origins, two Send consumers, incoming exclusion, app/OS 100/50/0/mute, output switch, received-only playback`,
    );
  } finally {
    helper?.stdin.end();
    if (engine && engine.exitCode === null && engine.signalCode === null) {
      const ended = once(engine, 'exit');
      engine.kill();
      await ended;
    }
    if (backend === 'pulse' && image)
      await run('docker', ['stop', container]).catch(() => {});
    for (const child of children.reverse())
      if (child.exitCode === null && child.signalCode === null) {
        const ended = once(child, 'exit');
        child.kill();
        await ended;
      }
    console.log(`Verification logs: ${root}`);
  }
}
