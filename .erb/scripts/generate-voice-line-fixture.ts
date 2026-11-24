/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Writes `native/system-apo/tests/voice_line_fixture.h` from the one
 * encoder there is (`encodeChainSettings`, `appendPresetTone`), for
 * `voice_line_test.cpp`: a microphone's Voice and Reverb trailers as the app
 * writes them. Written beside the header and renamed over it, so a build
 * that starts meanwhile never reads half a table.
 *
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register \
 *     ./.erb/scripts/generate-voice-line-fixture.ts
 */
import { renameSync, writeFileSync } from 'fs';
import path from 'path';
import voiceLineFixture from '../../src/common/dsp/voiceLineFixture';

const out = path.resolve(
  process.cwd(),
  'native/system-apo/tests/voice_line_fixture.h',
);
const partial = `${out}.partial`;
writeFileSync(partial, voiceLineFixture());
renameSync(partial, out);
