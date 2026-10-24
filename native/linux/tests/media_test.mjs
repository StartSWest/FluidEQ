/* FluidEQ — GPL-3.0-or-later; runs only in a private D-Bus session. */
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const executable =
  process.env.FLUIDEQ_MEDIA_HELPER ||
  path.join(repo, 'native/.build/bin/FluidEQ-Media');
if (!process.env.FLUIDEQ_MEDIA_TEST_BUS) {
  const env = {
    ...process.env,
    FLUIDEQ_MEDIA_TEST_BUS: '1',
    GIO_USE_VFS: 'local',
  };
  const root = fs.mkdtempSync('/tmp/fluideq-media-');
  for (const [key, folder] of Object.entries({
    XDG_RUNTIME_DIR: 'run',
    XDG_CONFIG_HOME: 'config',
    XDG_DATA_HOME: 'data',
    XDG_CACHE_HOME: 'cache',
    XDG_STATE_HOME: 'state',
  })) {
    env[key] = path.join(root, folder);
    fs.mkdirSync(env[key], { mode: 0o700 });
  }
  delete env.DBUS_SESSION_BUS_ADDRESS;
  const c = spawn(
    'dbus-run-session',
    ['--', process.execPath, import.meta.filename],
    { env, stdio: 'inherit' },
  );
  const [code] = await once(c, 'exit');
  process.exitCode = code;
} else {
  const children = [];
  const start = (exe, args) => {
    const c = spawn(exe, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    children.push(c);
    const events = [];
    const listeners = new Set();
    createInterface({ input: c.stdout }).on('line', (s) => {
      events.push(s);
      for (const f of listeners) f(s);
    });
    return {
      c,
      events,
      wait: (fn) =>
        new Promise((resolve) => {
          const found = events.find(fn);
          if (found !== undefined) return resolve(found);
          const read = (s) => {
            if (fn(s)) {
              listeners.delete(read);
              resolve(s);
            }
          };
          listeners.add(read);
        }),
    };
  };
  try {
    const name = 'org.mpris.MediaPlayer2.fluideqtest';
    const fixture = start('gjs', [
      repo + '/native/linux/tests/media_fixture.gjs',
      name,
    ]);
    await fixture.wait((s) => s === 'ready');
    const helper = start(executable, ['1']);
    const reading = (predicate) =>
      helper.wait((s) => {
        try {
          return predicate(JSON.parse(s));
        } catch {
          return false;
        }
      });
    const first = JSON.parse(await reading((s) => s?.title === 'First song'));
    assert.equal(first.artist, 'Artist one, Artist two');
    assert.equal(first.positionMs, 42000);
    assert.equal(first.durationMs, 180000);
    assert.equal(first.canNext, true);
    assert.equal(first.canPrevious, false);
    assert.equal(first.canSeek, true);
    assert.deepEqual(first.playing, []);
    const call = async (method, args = [], destination = name) =>
      promisify(execFile)('gdbus', [
        'call',
        '--session',
        '--dest',
        destination,
        '--object-path',
        '/org/mpris/MediaPlayer2',
        '--method',
        'org.fluideq.Test.' + method,
        ...args,
      ]);
    await call('SetPlaying', ['true']);
    await reading((s) => s?.isPlaying === true && s.playing.includes(name));
    helper.c.stdin.write('playPause\n');
    await fixture.wait((s) => s === 'command playPause');
    await reading((s) => s?.isPlaying === false);
    helper.c.stdin.write('next\nseek 53000\n');
    await fixture.wait((s) => s === 'command next');
    await fixture.wait(
      (s) => s === 'command seek /org/fluideq/test/track1 53000000',
    );
    await reading((s) => s?.positionMs === 53000);
    await call('SetTitle', ['Another song']);
    await reading((s) => s?.title === 'Another song');
    await call('SetControls', ['false']);
    await reading(
      (s) =>
        s?.title === 'Another song' &&
        s.canNext === false &&
        s.canSeek === false,
    );
    await call('SetControls', ['true']);
    await call('SetPlaying', ['true']);
    const secondName = `${name}2`;
    const second = start('gjs', [
      repo + '/native/linux/tests/media_fixture.gjs',
      secondName,
    ]);
    await second.wait((s) => s === 'ready');
    await call('SetPlaying', ['true'], secondName);
    await reading((s) => s?.playing?.length === 2);
    helper.c.stdin.write(`pauseOthers ${secondName}\n`);
    await fixture.wait((s) => s === 'command pause');
    await reading(
      (s) => s?.app === secondName && s.isPlaying && s.playing.length === 1,
    );
    helper.c.stdin.write('pauseOthers\n');
    await second.wait((s) => s === 'command pause');
    await reading(
      (s) => s?.app === secondName && !s.isPlaying && s.playing.length === 0,
    );
    const secondEnded = once(second.c, 'exit');
    second.c.kill();
    await secondEnded;
    helper.c.stdin.end();
    assert.equal((await once(helper.c, 'exit'))[0], 0);
    const own = start(executable, [String(fixture.c.pid)]);
    await own.wait((s) => s === 'null');
    own.c.stdin.end();
    assert.equal((await once(own.c, 'exit'))[0], 0);
    console.log(
      'PASS: MPRIS metadata, controls, seek, player arrival/departure, pause others, self exclusion, and owner shutdown',
    );
  } finally {
    for (const c of children.reverse())
      if (c.exitCode === null && c.signalCode === null) {
        const done = once(c, 'exit');
        c.kill();
        await done;
      }
  }
}
