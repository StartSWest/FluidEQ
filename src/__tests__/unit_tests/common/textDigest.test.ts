/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the scene runner keys its proven sizes by. The key used to be the
 * program itself — a whole shader source per entry, never let go — so every
 * Studio save that ran long enough kept its own copy for the session.
 */

import textDigest from 'common/textDigest';

const SHADER = `uniform float uTime;\n${'color += sin(uv.x * 3.0) * 0.5;\n'.repeat(1_600)}`;

it('names a 50 KB program in a few characters', () => {
  expect(SHADER.length).toBeGreaterThan(50_000);
  expect(textDigest(SHADER).length).toBeLessThan(16);
});

it('names the same program the same way, and an edited one differently', () => {
  expect(textDigest(SHADER)).toBe(textDigest(SHADER.split('').join('')));
  expect(textDigest(SHADER)).not.toBe(textDigest(SHADER.replace('3.0', '4.0')));
  expect(textDigest(`${SHADER} `)).not.toBe(textDigest(SHADER));
  expect(textDigest('ab')).not.toBe(textDigest('ba'));
});
