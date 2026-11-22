/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic profiles, as the engine's test reads them.
 *
 *   pnpm ts-node ./.erb/scripts/generate-mic-profiles-fixture.ts
 *
 * `mic_profiles_test.cpp` runs every profile's rack through the engine's own
 * graph, so the lines have to be the ones a mic is given: they are written
 * out of `micProfiles.ts` by the encoder, and `micProfiles.test.ts` fails
 * when the header and the profiles part ways. A profile retuned in the app
 * is regenerated here in the same commit.
 */
import { renameSync, writeFileSync } from 'fs';
import path from 'path';
import micProfilesFixture from '../../src/common/dsp/micProfilesFixture';

const out = path.resolve(
  process.cwd(),
  'native/system-apo/tests/mic_profiles_fixture.h',
);
// Beside the header and renamed over it, so a build that starts meanwhile
// never reads half a table.
const partial = `${out}.partial`;
writeFileSync(partial, micProfilesFixture());
renameSync(partial, out);
