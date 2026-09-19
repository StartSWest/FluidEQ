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
import {
  encodeChainSettings,
  gameModeOnWire,
  legacyChainWithoutInactiveRoom,
} from '../../../common/dsp/chainWire';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { readEngineHealth } from '../../../main/engineHealth';
import { flushPendingWrites, forgetPath } from '../../../main/asyncWriter';
import {
  SYSTEM_DSP_CHAIN_HEADER,
  formatSystemDspChain,
  writeSystemDspChain,
} from '../../../main/systemDspChain';

jest.mock('../../../main/engineHealth', () => ({
  readEngineHealth: jest.fn(async () => ({ outputs: [] })),
}));

describe('the system-wide DSP chain file', () => {
  it('keeps Gaming readable by older engines and carries its mode in a comment', () => {
    const normal = encodeChainSettings(DSP_DEFAULTS);
    const gaming = encodeChainSettings({ ...DSP_DEFAULTS, gameMode: true });
    const lines = formatSystemDspChain(gaming).split('\r\n');
    expect(lines).toContain('# FluidEQLowLatency: ON');
    const numbers = lines
      .filter((line) => line && !line.startsWith('#'))
      .join(' ');
    expect(numbers.split(' ').map(Number)).toEqual(normal);
    expect(formatSystemDspChain(normal)).not.toContain('FluidEQLowLatency');
  });

  let configDir: string;

  beforeEach(() => {
    jest
      .mocked(readEngineHealth)
      .mockReset()
      .mockResolvedValue({ outputs: [] });
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

  it('writes the format a running development engine reports it supports', async () => {
    jest.mocked(readEngineHealth).mockResolvedValue({
      outputs: [
        {
          endpoint: '{LIVE}',
          locked: true,
          processing: true,
          owner: true,
          problems: [],
          gameMode: false,
        },
      ],
    });
    const values = encodeChainSettings({ ...DSP_DEFAULTS, gameMode: true });
    await writeSystemDspChain(configDir, values);
    await flushPendingWrites();
    const written = fs.readFileSync(
      path.join(configDir, FLUID_ENGINE_DSP_FILENAME),
      'utf8',
    );
    const body = written
      .split('\r\n')
      .filter((line) => line && !line.startsWith('#'));
    expect(body[0].split(' ').map(Number)).toEqual(values);
  });

  it('does not let a slow Gaming capability read overwrite a later mode change', async () => {
    let finish = () => {};
    const pending = new Promise<{ outputs: [] }>((resolve) => {
      finish = () => resolve({ outputs: [] });
    });
    jest.mocked(readEngineHealth).mockReturnValue(pending);
    const gaming = writeSystemDspChain(
      configDir,
      encodeChainSettings({ ...DSP_DEFAULTS, gameMode: true }),
    );
    const normal = encodeChainSettings(DSP_DEFAULTS);
    await writeSystemDspChain(configDir, normal);
    finish();
    await gaming;
    await flushPendingWrites();
    const written = fs.readFileSync(
      path.join(configDir, FLUID_ENGINE_DSP_FILENAME),
      'utf8',
    );
    expect(written).toBe(formatSystemDspChain(normal));
  });

  it('retains the numeric Game mode word for engines that already report it', () => {
    const values = encodeChainSettings({ ...DSP_DEFAULTS, gameMode: true });
    const numbers = formatSystemDspChain(values, true)
      .split('\r\n')
      .filter((line) => line && !line.startsWith('#'))
      .join(' ');
    expect(numbers.split(' ').map(Number)).toEqual(values);
  });

  it.each(['active', 'rack-off', 'room-off', 'source-bypass'])(
    'preserves Room and Game mode through the actual writer for %s',
    async (mode) => {
      const values = encodeChainSettings({
        ...DSP_DEFAULTS,
        enabled: mode !== 'rack-off',
        gameMode: true,
        room: {
          ...DSP_DEFAULTS.room,
          enabled: mode !== 'room-off',
          rendererVersion: 2,
          sourceAlreadySpatial: mode === 'source-bypass',
        },
      });
      expect(gameModeOnWire(values)).toBe(true);
      await writeSystemDspChain(configDir, values);
      await flushPendingWrites();
      const written = fs.readFileSync(
        path.join(configDir, FLUID_ENGINE_DSP_FILENAME),
        'utf8',
      );
      expect(written).toContain('# FluidEQLowLatency: ON');
      expect(
        written
          .split('\r\n')
          .find((line) => line && !line.startsWith('#'))
          ?.split(' ')
          .map(Number),
      ).toEqual(values);
    },
  );

  it.each(['rack-off', 'room-off', 'source-bypass'])(
    'preserves Game metadata after stripping the inactive Room trailer for %s',
    (mode) => {
      const legacy = legacyChainWithoutInactiveRoom(
        encodeChainSettings({
          ...DSP_DEFAULTS,
          enabled: mode !== 'rack-off',
          gameMode: true,
          room: {
            ...DSP_DEFAULTS.room,
            enabled: mode !== 'room-off',
            rendererVersion: 2,
            sourceAlreadySpatial: mode === 'source-bypass',
          },
        }),
      );
      expect(legacy).toBeDefined();
      expect(gameModeOnWire(legacy ?? [])).toBe(true);
      expect(formatSystemDspChain(legacy ?? [])).toContain(
        '# FluidEQLowLatency: ON',
      );
    },
  );

  it('does not invent Game mode from a Room flag, malformed trailer or short payload', () => {
    const values = encodeChainSettings({
      ...DSP_DEFAULTS,
      room: {
        ...DSP_DEFAULTS.room,
        rendererVersion: 2,
        sourceAlreadySpatial: true,
      },
    });
    expect(gameModeOnWire(values)).toBe(false);
    expect(formatSystemDspChain(values)).not.toContain('FluidEQLowLatency');
    const gaming = encodeChainSettings({
      ...DSP_DEFAULTS,
      gameMode: true,
      room: { ...DSP_DEFAULTS.room, rendererVersion: 2 },
    });
    gaming[gaming.length - 1] = 99;
    expect(gameModeOnWire(gaming)).toBe(false);
    expect(gameModeOnWire(gaming.slice(0, -2))).toBe(false);
    expect(gameModeOnWire([1])).toBe(false);
  });

  it('round-trips through Number back to the same array', () => {
    const values = encodeChainSettings(DSP_DEFAULTS);
    const [header, body] = formatSystemDspChain(values).split('\r\n');

    expect(header).toBe(SYSTEM_DSP_CHAIN_HEADER);
    expect(body.split(' ').map(Number)).toEqual(values);
  });
});
