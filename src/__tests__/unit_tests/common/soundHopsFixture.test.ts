/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { soundHopsFixture } from 'common/soundHopsFixture';

/**
 * The lamps and the desktop drawn without Electron hear the music through a
 * C++ twin of `soundHops.ts` (`native/scene-core`), held by
 * `sound_hops_parity_test.cpp` to `sound_hops_fixture.h`. A change to how the
 * TypeScript reads the sound, not regenerated there, is a C++ test held to a
 * reading the window no longer makes — so this holds the header to the module
 * byte for byte (`.erb/scripts/generate-sound-hops-fixture.ts` writes it).
 */
it('is what soundHops.ts reads now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-core/tests/sound_hops_fixture.h'),
    'utf8',
  );
  expect(header).toBe(soundHopsFixture());
  // Both rates, a hop every 10 ms of the song but the first block's, which
  // the TypeScript hears as the moment it starts.
  expect(header.match(/^ {4}\{/gm)).toHaveLength(2 * 149);
  // Reading three seconds of song, a transform every hop, takes about five
  // seconds on its own and more under a full run.
}, 60_000);
