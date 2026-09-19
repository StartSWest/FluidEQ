/* FluidEQ — GPL-3.0-or-later */

/** Exercises the native pipe without opening an audio device or changing sound. */
import assert from 'assert/strict';
import { spawn } from 'child_process';
import { once } from 'events';
import path from 'path';
import {
  playbackCommand,
  PlaybackReplyReader,
} from '../../src/main/nativeRemoteAudioPlaybackProtocol';

const executable = path.resolve(
  process.argv[2] ?? 'native/.build/bin/FluidEQ-LAN-Playback.exe',
);
const run = async (commands: Buffer[], expectedCode: number) => {
  const child = spawn(executable, ['--parent-pid', String(process.pid)], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const exited = once(child, 'close');
  const reader = new PlaybackReplyReader();
  const replies: number[] = [];
  child.stdout.on('data', (bytes: Buffer) => {
    reader.push(bytes, (reply) => {
      replies.push(reply.kind);
      if (reply.kind === 1) {
        child.stdin.end(Buffer.concat(commands));
      }
    });
  });
  const [code] = await exited;
  assert.equal(code, expectedCode);
  assert.equal(replies[0], 1, 'native helper announces readiness');
  if (expectedCode !== 0) {
    assert.ok(replies.includes(4), 'invalid commands report failure');
  }
};

const smoke = async () => {
  if (process.platform !== 'win32') {
    process.stdout.write(
      'Native shared-audio protocol: Windows only; skipped.\n',
    );
    return;
  }
  const volume = Buffer.alloc(4);
  volume.writeFloatLE(0.5);
  await run(
    [playbackCommand(4, 0, volume), playbackCommand(5), playbackCommand(6)],
    0,
  );
  await run([], 0); // EOF without Close must release the parent watcher too.
  volume.writeFloatLE(Number.NaN);
  await run([playbackCommand(4, 0, volume)], 1);
  await run([playbackCommand(1, 1, Buffer.from('invalid-endpoint'))], 1);
  process.stdout.write(
    'Native shared-audio protocol: ready, control, EOF, invalid volume and endpoint passed.\n',
  );
};
smoke().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
