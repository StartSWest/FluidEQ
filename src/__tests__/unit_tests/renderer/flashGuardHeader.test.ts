/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { flashGuardHeader } from 'renderer/graph/flashGuardHeader';
import {
  CALM_SOURCE,
  COMPOSITE_SOURCE,
  STATE_SOURCE,
} from 'renderer/graph/sceneFlashGuardGpu';

/**
 * A member's scene on the lamps is held by the C++ scene host to the same
 * flash limit as on the screen, through the limiter's own programs compiled
 * into it (`native/scene-host/src/flash_guard_sources.h`). A change to the
 * limiter not regenerated there would let the desk strobe where the window
 * does not — so this holds the header to the module byte for byte.
 */
it('is the limiter the window runs', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-host/src/flash_guard_sources.h'),
    'utf8',
  );
  expect(header).toBe(flashGuardHeader());
  // Each program is in it whole, as a raw string the compiler reads back.
  [STATE_SOURCE, CALM_SOURCE, COMPOSITE_SOURCE].forEach((source) => {
    expect(header).toContain(`R"glsl(${source})glsl"`);
  });
});
