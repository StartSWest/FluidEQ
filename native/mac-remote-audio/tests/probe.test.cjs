/* FluidEQ — GPL-3.0-or-later */
const test = require('node:test');
const assert = require('node:assert/strict');
const probe = require('./probe.cjs');
const measure = (frequency, amplitude, common = 0, phaseJump = false) => {
  const rate = 48000;
  const meter = probe(rate, 3, 9173);
  for (let start = 0; start < rate * 3; start += 480) {
    const pcm = Buffer.alloc(480 * 8);
    for (let frame = 0; frame < 480; ++frame) {
      const phase = ((start + frame) * 2 * Math.PI) / rate;
      const side =
        amplitude *
        Math.sin(
          phase * frequency +
            (phaseJump && start + frame >= rate * 1.53 ? Math.PI : 0),
        );
      const centre = common * Math.sin(phase * 440);
      pcm.writeFloatLE(centre + side, frame * 8);
      pcm.writeFloatLE(centre - side, frame * 8 + 4);
    }
    meter.push(pcm, 480);
  }
  return meter.result();
};
test('measures the known source across hardware-clock offsets, rejecting centre-panned playback', () => {
  for (const hz of [9172.77, 9173, 9173.31])
    assert.ok(Math.abs(measure(hz, 0.01, 0.1) / 0.01 - 1) < 0.005);
});
test('distinguishes a real 50%/zero gain from a clock phase discontinuity', () => {
  const full = measure(9173.23, 0.01, 0.1);
  assert.ok(Math.abs(measure(9173.23, 0.01, 0.1, true) / full - 1) < 0.02);
  assert.ok(Math.abs(measure(9173.23, 0.005, 0.1) / full - 0.5) < 0.005);
  assert.ok(measure(9173.23, 0, 0.1) < 0.000001);
});
test('has a positive control for a 1% received leak and rejects unrelated audio', () => {
  assert.ok(measure(9173.2, 0.0001, 0.1) > 0.000099);
  assert.ok(measure(8000, 0.01, 0.1) < 0.000001);
});
