/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The featured rooms, as the engine's test reads them.
 *
 *   pnpm ts-node ./.erb/scripts/generate-room-profiles-fixture.ts
 *
 * `room_profiles_test.cpp` measures the six featured rooms through the
 * shipped head, and what it measures has to be what the card applies — so
 * the table is written out of `roomPresets.ts` itself, and
 * `dspRoomProfiles.test.ts` fails when the header and the table part ways.
 * A room retuned in the app is regenerated here in the same commit.
 */
import { renameSync, writeFileSync } from 'fs';
import path from 'path';
import { roomProfilesFixture } from '../../src/common/dsp/roomProfilesFixture';

const out = path.resolve(
  process.cwd(),
  'native/dsp-core/tests/room_profiles_fixture.h',
);
// Beside the header and renamed over it, so a build that starts meanwhile
// never reads half a table.
const partial = `${out}.partial`;
writeFileSync(partial, roomProfilesFixture());
renameSync(partial, out);
