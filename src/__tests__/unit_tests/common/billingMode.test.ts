/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { billingModeOf } from '../../../common/billingMode';

/**
 * Ivan, 2026-11-28: "dev needs to behave like normal, just point to the
 * testing Stripe". `pnpm dev` buys in Stripe's test mode; anything that can
 * ship buys in live mode, as every release before it did.
 */
describe('the Stripe mode a build buys in', () => {
  it('is test mode under the development server', () => {
    expect(billingModeOf('development')).toBe('test');
  });

  it.each([
    ['a release', 'production'],
    ['Jest', 'test'],
    ['an environment with no NODE_ENV', undefined],
    ['a misspelt one', 'Development'],
  ])('is live mode in %s', (_label, nodeEnv) => {
    expect(billingModeOf(nodeEnv)).toBe('live');
  });
});

/**
 * The mode is read from `NODE_ENV`, which webpack compiles into a release.
 * What makes a release live is therefore these two configs refusing to build
 * under anything but `production`, and baking that word in; if either ever
 * built under `development`, a shipped FluidEQ would send its buyers to
 * Stripe's test checkout. Read as text: running webpack here is a build.
 */
describe('a release build', () => {
  const root = path.join(__dirname, '../../../..');
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

  it.each([
    '.erb/configs/webpack.config.main.prod.ts',
    '.erb/configs/webpack.config.renderer.prod.ts',
  ])('compiles %s under production alone', (config) => {
    const text = read(config);
    expect(text).toContain("checkNodeEnv('production');");
    expect(text).toMatch(
      /new webpack\.EnvironmentPlugin\(\{\s*NODE_ENV: 'production',/,
    );
  });

  it('is built by scripts that say production', () => {
    const { scripts } = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(scripts['build:main']).toContain('NODE_ENV=production');
    expect(scripts['build:renderer']).toContain('NODE_ENV=production');
  });
});
