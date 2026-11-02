/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Writes the headers the C++ scenes are held to: the hops
 * `src/common/soundHops.ts` reads and the music `src/common/spectrumEnergy.ts`
 * hears in them (`native/scene-core/tests`), and the flash limiter's programs
 * as `sceneFlashGuardGpu.ts` links them (`native/scene-host/src`), and the
 * lamps' atmosphere, time of day and swatch (`lampFixture.ts`), and the
 * lamp host's messages (`lampWireFixture.ts`). Run it after changing any of
 * those; `soundHopsFixture.test.ts`, `sceneEnergyFixture.test.ts`,
 * `flashGuardHeader.test.ts`, `lampFixture.test.ts` and
 * `sceneHostWire.test.ts` fail until the headers on disk are what this
 * writes.
 */
import { renameSync, writeFileSync } from 'fs';
import path from 'path';
import { sceneEnergyFixture } from '../../src/common/sceneEnergyFixture';
import { soundHopsFixture } from '../../src/common/soundHopsFixture';
import { flashGuardHeader } from '../../src/renderer/graph/flashGuardHeader';
import { lampWireFixture } from '../../src/main/lighting/lampWireFixture';
import { lampFixture } from '../../src/renderer/lighting/lampFixture';
import { lampFrameFixture } from '../../src/renderer/lighting/lampFrameFixture';

const write = (where: string, text: string) => {
  const out = path.resolve(process.cwd(), where);
  // Beside the header and renamed over it, so a build that starts meanwhile
  // never reads half a table.
  const partial = `${out}.partial`;
  writeFileSync(partial, text);
  renameSync(partial, out);
};

write('native/scene-core/tests/sound_hops_fixture.h', soundHopsFixture());
write('native/scene-core/tests/scene_energy_fixture.h', sceneEnergyFixture());
write('native/scene-host/src/flash_guard_sources.h', flashGuardHeader());
write('native/scene-core/tests/lamp_fixture.h', lampFixture());
write('native/scene-core/tests/lamp_frame_fixture.h', lampFrameFixture());
write('native/scene-host/tests/lamp_wire_fixture.h', lampWireFixture());
