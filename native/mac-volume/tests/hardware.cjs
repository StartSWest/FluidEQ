/* FluidEQ — GPL-3.0-or-later */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const client = require('./client.cjs');
const [volumePath, enginePath] = process.argv.slice(2);
const outputs = JSON.parse(
  execFileSync(enginePath, ['--list-outputs'], { encoding: 'utf8' }),
);
const originalOutput = outputs.find((item) => item.isDefault);
const choose = (uid) => execFileSync(enginePath, ['--set-default-output', uid]);
const selected = (uid) =>
  JSON.parse(
    execFileSync(enginePath, ['--list-outputs'], { encoding: 'utf8' }),
  ).some((item) => item.uid === uid && item.isDefault);

(async () => {
  const observer = await client(volumePath);
  const writer = await client(volumePath);
  const original = observer.current();
  const results = [];
  let switched = false;
  try {
    assert.ok(
      original?.canSet && original.canMute,
      'Current output lacks volume or mute controls',
    );
    for (const requested of [0.37, 0.62, 0]) {
      const applied = await writer.command('set', requested);
      assert.ok(
        Math.abs(applied.level - requested) < 0.03,
        'Native applied volume is not the requested real output level',
      );
      await observer.wait(
        (state) =>
          state?.device === original.device && state.level === applied.level,
      );
      results.push({ requested, applied: applied.level });
    }
    for (const muted of [true, false]) {
      const applied = await writer.command('mute', muted ? 1 : 0);
      assert.equal(applied.muted, muted);
      await observer.wait((state) => state?.muted === muted);
    }
    const other = outputs.find((item) => !item.isDefault);
    if (other) {
      choose(other.uid);
      switched = true;
      if (selected(other.uid)) {
        const alternate = await observer.wait(
          (state) => state !== null && state.device !== original.device,
        );
        const refused = await observer.command('set', 0.9, original.device);
        assert.deepEqual(
          refused,
          alternate,
          'A stale command changed the newly selected output',
        );
        results.push({
          switchedOutput: other.name,
          capabilities: alternate,
          staleWriteRejected: true,
        });
      } else
        results.push({
          outputSwitch: `unverified: macOS did not select ${other.name}`,
        });
    } else results.push({ outputSwitch: 'unverified: only one output exists' });
    console.log(
      JSON.stringify({ test: 'mac-system-volume', results, result: 'PASS' }),
    );
  } finally {
    try {
      if (switched && originalOutput) {
        choose(originalOutput.uid);
        await observer.wait((state) => state?.device === original.device);
      }
      if (original?.level !== undefined)
        await writer.command('set', original.level, original.device);
      if (original?.muted !== undefined)
        await writer.command('mute', original.muted ? 1 : 0, original.device);
    } finally {
      await writer.close();
      await observer.close();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
