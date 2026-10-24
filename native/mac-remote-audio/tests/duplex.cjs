/* FluidEQ — GPL-3.0-or-later */
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const readline = require('node:readline');
const [helperPath, sourcePath, enginePath] = process.argv.slice(2);
const permission = spawnSync(enginePath, ['--audio-permission'], {
  encoding: 'utf8',
});
assert.equal(permission.status, 0, permission.stderr);
// A headless runner cannot answer a first-use permission prompt. The app's
// permission flow is verified interactively; this regression requires a grant.
if (permission.stdout.trim() !== 'granted') {
  console.log(
    'SKIP: System Audio Recording permission is not granted to this test launcher',
  );
  process.exit(77);
}
const outputs = spawnSync(enginePath, ['--list-outputs'], { encoding: 'utf8' });
assert.equal(outputs.status, 0, outputs.stderr);
if (!JSON.parse(outputs.stdout).some((device) => device.isDefault)) {
  console.log('SKIP: no default Core Audio output');
  process.exit(77);
}

const children = [];
// A high, very quiet probe stays clear of the music already playing on the
// machine; the external-process positive control uses this exact probe too.
const probeHz = 9173;
const start = (executable, args = []) => {
  const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  children.push(child);
  child.stdin.on('error', () => undefined);
  child.stderr.on('data', (bytes) => {
    child.errorText = ((child.errorText ?? '') + bytes.toString()).slice(-8192);
  });
  child.finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
  return child;
};
const packet = (
  kind,
  id = 0,
  payload = Buffer.alloc(0),
  rate = 0,
  channels = 0,
  frames = 0,
) => {
  const header = Buffer.alloc(24);
  header.writeUInt32LE(0x31504c46);
  header.writeUInt32LE(kind, 4);
  header.writeUInt32LE(id, 8);
  header.writeUInt32LE(rate, 12);
  header.writeUInt16LE(channels, 16);
  header.writeUInt16LE(frames, 18);
  header.writeUInt32LE(payload.length, 20);
  return Buffer.concat([header, payload]);
};

async function run() {
  const helper = start(helperPath, ['--parent-pid', String(process.pid)]);
  let buffered = Buffer.alloc(0),
    nextId = 0,
    ready,
    refuseReady;
  let measure,
    feed = false,
    sequence = 0,
    sampleAt = 0,
    meterPeak = 0;
  const requests = new Map();
  const readyPromise = new Promise((resolve, reject) => {
    ready = resolve;
    refuseReady = reject;
  });
  const fail = (error) => {
    refuseReady(error);
    requests.forEach((waiter) => waiter.reject(error));
    requests.clear();
    measure?.reject(error);
  };
  const audio = (header, pcm) => {
    const frames = header.readUInt16LE(18),
      rate = header.readUInt32LE(12);
    if (measure) {
      measure.rate = rate;
      const count = Math.min(
        frames,
        Math.round(rate * measure.seconds) - measure.n,
      );
      for (let f = 0; f < count; ++f) {
        const value = pcm.readFloatLE(f * 8);
        const phase = (2 * Math.PI * probeHz * measure.n) / rate;
        const weight =
          0.5 -
          0.5 *
            Math.cos(
              (2 * Math.PI * measure.n) /
                (Math.round(rate * measure.seconds) - 1),
            );
        measure.sin += value * weight * Math.sin(phase);
        measure.cos += value * weight * Math.cos(phase);
        measure.n += 1;
      }
      if (measure.n >= Math.round(rate * measure.seconds)) {
        const result =
          (4 * Math.hypot(measure.sin, measure.cos)) / (measure.n - 1);
        const done = measure.resolve;
        measure = undefined;
        done(result);
      }
    }
    if (feed) pushTone(Math.round((frames * 48000) / rate));
  };
  const pushTone = (frames) => {
    const body = Buffer.alloc(4 + frames * 8);
    body.writeUInt32LE(sequence++);
    for (let f = 0; f < frames; ++f) {
      const value =
        0.002 * Math.sin((2 * Math.PI * probeHz * sampleAt++) / 48000);
      body.writeFloatLE(value, 4 + f * 8);
      body.writeFloatLE(-value, 8 + f * 8);
    }
    helper.stdin.write(packet(2, 1, body, 48000, 2, frames));
  };
  helper.stdout.on('data', (bytes) => {
    try {
      buffered = Buffer.concat([buffered, bytes]);
      while (buffered.length >= 24) {
        assert.equal(buffered.readUInt32LE(0), 0x31504c46);
        const size = buffered.readUInt32LE(20);
        assert.ok(size <= 8192 * 8 * 4);
        if (buffered.length < 24 + size) return;
        const h = buffered.subarray(0, 24),
          payload = buffered.subarray(24, 24 + size);
        buffered = buffered.subarray(24 + size);
        const kind = h.readUInt32LE(4),
          id = h.readUInt32LE(8);
        if (kind === 1) ready();
        if (kind === 3) {
          const waiter = requests.get(id);
          requests.delete(id);
          if (h.readUInt32LE(12) >= 0x80000000)
            waiter?.reject(
              new Error(`Native request failed: ${helper.errorText ?? ''}`),
            );
          else waiter?.resolve();
        }
        if (kind === 10) audio(h, payload);
        if (kind === 5)
          meterPeak = Math.max(meterPeak, payload.readDoubleLE(8));
        if (kind === 9 || kind === 4)
          throw new Error(`Native audio failed: ${helper.errorText ?? ''}`);
      }
    } catch (error) {
      fail(error);
      helper.kill();
    }
  });
  helper.finished.then((code) => {
    fail(new Error(`Native helper exited ${code}: ${helper.errorText ?? ''}`));
  }, fail);
  const request = (kind, body) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      requests.set(id, { resolve, reject });
      helper.stdin.write(packet(kind, id, body));
    });
  const level = (seconds) =>
    new Promise((resolve, reject) => {
      assert.equal(measure, undefined);
      measure = { seconds, resolve, reject, n: 0, sin: 0, cos: 0 };
    });
  await readyPromise;
  await request(8, Buffer.from('lan'));
  await level(0.15);
  const baseline = await level(3);
  await request(1);
  for (let n = 0; n < 8; ++n) pushTone(240);
  feed = true;
  await level(0.2);
  const receivedLeak = await level(3);
  assert.ok(
    meterPeak > 0.001,
    `Positive playback control never rendered: ${meterPeak}`,
  );
  feed = false;
  await request(7);
  await level(0.15);

  const source = start(sourcePath);
  const lines = readline.createInterface({ input: source.stdout });
  const seen = [],
    waiters = [];
  lines.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else seen.push(line);
  });
  const line = () =>
    Promise.race([
      seen.length
        ? Promise.resolve(seen.shift())
        : new Promise((resolve) => waiters.push(resolve)),
      source.finished.then((code) => {
        throw new Error(
          `Positive control exited ${code}: ${source.errorText ?? ''}`,
        );
      }),
    ]);
  assert.equal(await line(), 'ready');
  source.stdin.write('start\n');
  assert.match(await line(), /^playing /);
  await level(0.2);
  const ownSource = await level(3);
  source.stdin.end('quit\n');
  assert.equal(await source.finished, 0, source.errorText);
  assert.ok(
    ownSource > 0.001,
    `Capture heard no external positive control: ${ownSource}`,
  );
  assert.ok(
    baseline < ownSource * 0.1,
    `Background sound prevents a reliable no-feedback verdict: ${JSON.stringify({ baseline, receivedLeak, ownSource })}`,
  );
  assert.ok(
    receivedLeak < ownSource * 0.01,
    `Received audio leaked into the send: ${receivedLeak} vs ${ownSource}`,
  );
  await request(9);
  helper.stdin.end(packet(6));
  assert.equal(await helper.finished, 0, helper.errorText);
  console.log(
    JSON.stringify({
      test: 'mac-share-audio',
      baseline,
      receivedLeak,
      ownSource,
      playbackPeak: meterPeak,
      result: 'PASS',
    }),
  );
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    children.forEach((child) => {
      if (child.exitCode === null) child.kill();
    });
  });
