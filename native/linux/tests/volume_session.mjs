/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const children = [];
const spawnChild = (name, args = []) => {
  const log = fs.openSync(
    path.join(process.env.XDG_STATE_HOME, `${path.basename(name)}.log`),
    'a',
  );
  const child = spawn(name, args, { stdio: ['ignore', log, log] });
  fs.closeSync(log);
  children.push(child);
  return child;
};
const waitFile = (file) =>
  new Promise((resolve, reject) => {
    const watcher = fs.watch(path.dirname(file), () => {
      if (fs.existsSync(file)) {
        watcher.close();
        resolve();
      }
    });
    watcher.on('error', reject);
    if (fs.existsSync(file)) {
      watcher.close();
      resolve();
    }
  });
let helper;
const waiters = new Set();
const records = [];
const waitReading = (matches) =>
  new Promise((resolve, reject) => {
    waiters.add({ matches, resolve, reject });
  });
const readThen = async (matches, action) => {
  const answer = waitReading(matches);
  await action();
  return answer;
};
const levelIs =
  (level, muted = 0) =>
  (line) => {
    const [tag, value, mute] = line.split('\t');
    return (
      tag === 'volume' &&
      Math.abs(Number(value) - level) < 0.002 &&
      Number(mute) === muted
    );
  };
try {
  fs.writeFileSync(
    path.join(process.env.XDG_STATE_HOME, 'bus'),
    process.env.DBUS_SESSION_BUS_ADDRESS,
  );
  fs.mkdirSync(path.join(process.env.XDG_RUNTIME_DIR, 'pulse'), {
    recursive: true,
  });
  const pwReady = waitFile(
    path.join(process.env.XDG_RUNTIME_DIR, 'pipewire-0'),
  );
  spawnChild('pipewire');
  await pwReady;
  spawnChild('wireplumber');
  await run('pw-cli', [
    'create-node',
    'adapter',
    '{ factory.name=support.null-audio-sink node.name=iso_speakers node.description=Speakers media.class=Audio/Sink object.linger=true audio.position=[FL FR] priority.session=1000 priority.driver=1000 }',
  ]);
  await run('pw-cli', [
    'create-node',
    'adapter',
    '{ factory.name=support.null-audio-sink node.name=iso_headphones node.description=Headphones media.class=Audio/Sink object.linger=true audio.position=[FL FR] priority.session=900 priority.driver=900 }',
  ]);
  const pulseReady = waitFile(
    path.join(process.env.XDG_RUNTIME_DIR, 'pulse', 'native'),
  );
  spawnChild('pipewire-pulse');
  await pulseReady;
  // The socket can exist before WirePlumber has selected and restored a
  // default. Wait for its metadata event before changing any mixer value.
  const metadata = spawn('pw-metadata', ['-m', '-n', 'default']);
  children.push(metadata);
  const metadataLines = readline.createInterface({ input: metadata.stdout });
  await new Promise((resolve) =>
    metadataLines.on('line', (line) => {
      if (line.includes('default.audio.sink') && line.includes('iso_speakers'))
        resolve();
    }),
  );
  metadata.kill();
  helper = spawn(path.join(repo, 'native/.build/bin/FluidEQ-Volume'));
  const helperExit = once(helper, 'exit');
  helper.stderr.pipe(process.stderr);
  const lines = readline.createInterface({ input: helper.stdout });
  lines.on('line', (line) => {
    records.push(line);
    for (const waiter of waiters) {
      if (waiter.matches(line)) {
        waiters.delete(waiter);
        waiter.resolve(line);
      }
    }
  });
  helper.on('exit', (code) => {
    for (const waiter of waiters)
      waiter.reject(new Error(`helper ended: ${code}`));
    waiters.clear();
  });
  await waitReading((line) => line.startsWith('volume\t'));
  await new Promise((resolve) => helper.stdin.write('se', resolve));
  await readThen(levelIs(0.35), () => helper.stdin.write('t 0.3500\n'));
  assert.match(
    (await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@'])).stdout,
    /0\.35/,
  );
  await readThen(levelIs(0.35, 1), () => helper.stdin.write('mute 1\n'));
  assert.match(
    (await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@'])).stdout,
    /MUTED/,
  );
  await readThen(levelIs(0.35), () =>
    run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', '0']),
  );
  await readThen(levelIs(0.63), () =>
    run('wpctl', ['set-volume', '@DEFAULT_AUDIO_SINK@', '63%']),
  );
  const objects = JSON.parse((await run('pw-dump')).stdout);
  const speakers = objects.find(
    (one) => one.info?.props?.['node.name'] === 'iso_speakers',
  );
  const headphones = objects.find(
    (one) => one.info?.props?.['node.name'] === 'iso_headphones',
  );
  assert.ok(speakers && headphones);
  await readThen(levelIs(0.5), () =>
    run('pw-cli', [
      'set-param',
      String(speakers.id),
      'Props',
      '{ channelVolumes: [0.125 0.027] }',
    ]),
  );
  await readThen(levelIs(0.8), () => helper.stdin.write('set 0.8\n'));
  const props = (
    await run('pw-cli', ['enum-params', String(speakers.id), 'Props'])
  ).stdout;
  assert.match(props, /0\.512/);
  assert.match(props, /0\.1105/);
  await run('wpctl', ['set-volume', String(headphones.id), '22%']);
  await readThen(levelIs(0.22), () =>
    run('wpctl', ['set-default', String(headphones.id)]),
  );
  await readThen(levelIs(0.44), () => helper.stdin.write('set 0.44\n'));
  assert.match(
    (await run('wpctl', ['get-volume', String(speakers.id)])).stdout,
    /0\.80/,
  );
  assert.match(
    (await run('wpctl', ['get-volume', String(headphones.id)])).stdout,
    /0\.44/,
  );
  helper.stdin.end();
  assert.equal((await helperExit)[0], 0);
  const invalid = spawn(path.join(repo, 'native/.build/bin/FluidEQ-Volume'));
  const invalidExit = once(invalid, 'exit');
  invalid.stdin.end('set nan\n');
  assert.equal((await invalidExit)[0], 1);
  const offline = spawn(
    path.join(repo, 'native/.build/bin/FluidEQ-Volume'),
    [],
    {
      env: {
        ...process.env,
        PULSE_SERVER: `unix:${process.env.XDG_RUNTIME_DIR}/missing-server`,
      },
    },
  );
  const offlineExit = once(offline, 'exit');
  let offlineOutput = '';
  offline.stdout.on('data', (chunk) => {
    offlineOutput += chunk;
  });
  assert.equal((await offlineExit)[0], 2);
  assert.equal(offlineOutput.trim(), 'none');
  process.stdout.write(
    'PASS: app volume, desktop changes, mute, balance, output switch, fragmented commands, stdin shutdown\n',
  );
  process.stdout.write(
    'PASS: invalid commands are refused; no sound server reports unavailable\n',
  );
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
} finally {
  helper?.stdin.end();
  for (const child of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit');
      child.kill();
      await ended;
    }
  }
  if (process.exitCode) process.stderr.write(`${JSON.stringify(records)}\n`);
}
