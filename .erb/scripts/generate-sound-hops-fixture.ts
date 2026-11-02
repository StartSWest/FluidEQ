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
 * lamp host's messages (`lampWireFixture.ts`), and Share Audio's wire
 * (`shareWireFixture.ts`), and the size ladders, pacing and draw sizes of
 * the desktop scenes (`sceneSizingFixture.ts`) and the passes that finish
 * them (`sceneFinishHeader.ts`). Run it after changing any of
 * those; `soundHopsFixture.test.ts`, `sceneEnergyFixture.test.ts`,
 * `flashGuardHeader.test.ts`, `lampFixture.test.ts`, `sceneHostWire.test.ts`
 * and `shareWireFixture.test.ts` fail until the headers on disk are what
 * this writes.
 */
import { renameSync, writeFileSync } from 'fs';
import path from 'path';
import { sceneEnergyFixture } from '../../src/common/sceneEnergyFixture';
import { soundHopsFixture } from '../../src/common/soundHopsFixture';
import { flashGuardHeader } from '../../src/renderer/graph/flashGuardHeader';
import { lampWireFixture } from '../../src/main/lighting/lampWireFixture';
import { shareWireFixture } from '../../src/main/shareAudio/shareWireFixture';
import { lampFixture } from '../../src/renderer/lighting/lampFixture';
import { lampFrameFixture } from '../../src/renderer/lighting/lampFrameFixture';
import { sceneSizingFixture } from '../../src/renderer/graph/sceneSizingFixture';
import { sceneFinishHeader } from '../../src/renderer/graph/sceneFinishHeader';
import { songProgrammeFixture } from '../../src/main/songProgrammeFixture';

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
write('native/scene-core/tests/scene_sizing_fixture.h', sceneSizingFixture());
write('native/scene-host/src/scene_finish_sources.h', sceneFinishHeader());
write('native/tray-host/tests/song_programme_fixture.h', songProgrammeFixture());
// Squeezing the audio is asynchronous in Node, so this one is awaited.
shareWireFixture()
  .then((header) => write('native/share-core/tests/share_wire_fixture.h', header))
  .catch((error: unknown) => {
    console.error('The Share Audio wire fixture could not be written:', error);
    process.exitCode = 1;
  });
