/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The Linux engine's `outputs.json`, as the app reads it.
 *
 * The file is written by `native/linux/engine/outputs_file.cpp`; the sample
 * below is one the engine wrote, so a field renamed on either side fails
 * here rather than reading as a machine with no outputs.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseLinuxOutputs,
  readLinuxOutputs,
  toAudioDevices,
  toEngineEndpoints,
} from '../../../main/linux/linuxOutputs';
import { linuxEngineRoot } from '../../../main/linux/linuxEngineFiles';

const WRITTEN_BY_THE_ENGINE = `{
  "version": 1,
  "engineVersion": "1.23.0.0",
  "backend": "pipewire",
  "sink": "fluideq_sink",
  "pid": 518379,
  "outputs": [
    {"id": "{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}", "name": "iso_speakers", "description": "Speakers", "channels": 2, "target": true},
    {"id": "{1DEC117B-9B9A-8340-A39F-89DA8E1D9C91}", "name": "iso_headphones", "description": "Headphones", "channels": 2, "target": false}
  ]
}
`;

describe('the Linux engine outputs', () => {
  it('reads what the engine wrote', () => {
    const outputs = parseLinuxOutputs(WRITTEN_BY_THE_ENGINE);
    expect(outputs.engineVersion).toBe('1.23.0.0');
    expect(outputs.backend).toBe('pipewire');
    expect(outputs.outputs).toHaveLength(2);
    expect(outputs.outputs[0]).toEqual({
      id: '{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}',
      name: 'iso_speakers',
      description: 'Speakers',
      channels: 2,
      target: true,
    });
  });

  it('lists every output as one the engine is on, the target as the default', () => {
    const devices = toAudioDevices(parseLinuxOutputs(WRITTEN_BY_THE_ENGINE));
    expect(devices.map((device) => device.name)).toEqual([
      'Headphones',
      'Speakers',
    ]);
    const speakers = devices.find((device) => device.name === 'Speakers');
    expect(speakers).toMatchObject({
      // What the engine is told to play to, and what every file is keyed by.
      id: 'iso_speakers',
      guid: '{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}',
      isDefault: true,
      isFluidEngineAttached: true,
      isEqualizerApoAttached: false,
    });
    expect(toEngineEndpoints(parseLinuxOutputs(WRITTEN_BY_THE_ENGINE))).toEqual(
      [
        {
          guid: '{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}',
          attached: true,
          backupExists: false,
        },
        {
          guid: '{1DEC117B-9B9A-8340-A39F-89DA8E1D9C91}',
          attached: true,
          backupExists: false,
        },
      ],
    );
  });

  it('refuses an output whose id could name another file', () => {
    const outputs = parseLinuxOutputs(
      JSON.stringify({
        outputs: [
          { id: '../config', name: 'x', description: 'Bad', target: false },
          { id: '{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}', name: 'ok' },
        ],
      }),
    );
    expect(outputs.outputs.map((output) => output.name)).toEqual(['ok']);
    expect(outputs.outputs[0].description).toBe('ok');
    expect(outputs.outputs[0].channels).toBe(2);
  });

  it('reads a half-written or missing file as no outputs, never a throw', async () => {
    expect(parseLinuxOutputs('{"outputs": [').outputs).toEqual([]);
    expect(parseLinuxOutputs('null').outputs).toEqual([]);
    const missing = path.join(os.tmpdir(), 'fluideq-no-such-outputs.json');
    expect((await readLinuxOutputs(missing)).outputs).toEqual([]);
  });

  it('reads the file from where the engine writes it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-outputs-'));
    const file = path.join(dir, 'outputs.json');
    fs.writeFileSync(file, WRITTEN_BY_THE_ENGINE);
    expect((await readLinuxOutputs(file)).outputs).toHaveLength(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("the Linux engine's folder", () => {
  it('is the user data folder the engine uses, by the same rule', () => {
    expect(linuxEngineRoot({}, '/home/ivan')).toBe(
      '/home/ivan/.local/share/FluidEQ/engine',
    );
    expect(linuxEngineRoot({ XDG_DATA_HOME: '/data' }, '/home/ivan')).toBe(
      '/data/FluidEQ/engine',
    );
    // A relative XDG value is ignored, as the engine ignores it.
    expect(linuxEngineRoot({ XDG_DATA_HOME: 'data' }, '/home/ivan')).toBe(
      '/home/ivan/.local/share/FluidEQ/engine',
    );
    expect(
      linuxEngineRoot({ FLUIDEQ_ENGINE_ROOT: '/tmp/engine/' }, '/home/ivan'),
    ).toBe('/tmp/engine');
  });
});
