/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack, as the engine DLL reads it.
 *
 * The DLL parses one line of decimal doubles with `std::from_chars`, which
 * has no locale and no tolerance for a thousands separator or an exponent
 * spelled differently — so the formatting is asserted here rather than left
 * to whatever `Number.prototype.toString` happens to do on the machine that
 * built the release. A single wrong separator does not fail loudly on the
 * far side: the DLL bypasses the rack and the user hears the EQ alone.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { FLUID_ENGINE_DSP_FILENAME } from '../../../common/audioEngine';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { flushPendingWrites, forgetPath } from '../../../main/asyncWriter';
import {
  SYSTEM_DSP_CHAIN_HEADER,
  formatSystemDspChain,
  writeSystemDspChain,
} from '../../../main/systemDspChain';

describe('the system-wide DSP chain file', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-dsp-chain-'));
  });

  afterEach(async () => {
    await flushPendingWrites().catch(() => undefined);
    forgetPath(path.join(configDir, FLUID_ENGINE_DSP_FILENAME));
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('is a header line and one line of space-separated numbers, CRLF', async () => {
    const values = encodeChainSettings(DSP_DEFAULTS);
    await writeSystemDspChain(configDir, values);
    await flushPendingWrites();

    const written = fs.readFileSync(
      path.join(configDir, FLUID_ENGINE_DSP_FILENAME),
      'utf8',
    );
    const body = values.map((value) => String(value)).join(' ');
    expect(written).toBe(`${SYSTEM_DSP_CHAIN_HEADER}\r\n${body}\r\n`);
  });

  it('round-trips through Number back to the same array', () => {
    const values = encodeChainSettings(DSP_DEFAULTS);
    const [header, body] = formatSystemDspChain(values).split('\r\n');

    expect(header).toBe(SYSTEM_DSP_CHAIN_HEADER);
    expect(body.split(' ').map(Number)).toEqual(values);
  });
});
