/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every layer file FluidEQ shapes itself asks the FluidEQ Engine for the
 * analog-matched design; the headphone correction's never does.
 *
 * The engine reads the directive file by file and an include inherits it, so
 * the line has to sit in each layer's own file: written once in the device
 * file it would reach the correction too, and a correction built matched
 * plays 0.89 dB from what AutoEQ fitted where the cookbook plays 0.14.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
  TApoConfigFiles,
} from '../../../main/deviceProfiles';
import { MATCHED_DESIGN_DIRECTIVE } from '../../../common/filterDesign';
import { FilterTypeEnum } from '../../../common/constants';
import { FLUIDEQ_CONFIG_FILENAME } from '../../../main/flush';

const band = (frequency: number, gain: number) => ({
  id: `band-${frequency}`,
  frequency,
  gain,
  quality: 1.2,
  type: FilterTypeEnum.PK,
});

/** Each included layer file of the device, keyed by its feature word. */
const layerFiles = (files: TApoConfigFiles, guid: string) => {
  const root = (files.get(FLUIDEQ_CONFIG_FILENAME) ?? '').split(/\r?\n/);
  const include = root
    .slice(root.indexOf(`Device: ${guid}`))
    .find((line) => line.startsWith('Include: '));
  const device = files.get(include?.replace('Include: ', '') ?? '') ?? '';
  return {
    device,
    layers: new Map(
      device
        .split(/\r?\n/)
        .filter((line) => line.startsWith('Include: '))
        .map((line) => line.replace('Include: ', ''))
        .filter((name) => !name.endsWith('custom.txt'))
        .map((name) => [
          name.replace(/^.*-(\w+)\.txt$/, '$1'),
          files.get(name) ?? '',
        ]),
    ),
  };
};

describe('the filter design each layer file asks for', () => {
  let presetsDir: string;

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-design-'));
    fs.writeFileSync(
      path.join(presetsDir, 'Layered'),
      JSON.stringify({
        preAmp: 0,
        filters: { treble: band(12000, 4) },
        headphone: { filters: { dip: band(8474, -7.3) }, intensity: 1 },
        voicing: { profileId: 'music', intensity: 1 },
        driver: { profileId: 'balanced-armature-iem', intensity: 1 },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('asks for the matched design in FluidEQ’s own layers and never in the correction', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Layered',
    };

    const { device, layers } = layerFiles(
      deviceProfilesToFiles(settings, () => presetsDir),
      '{1234-ABCD}',
    );

    // POSITIVE CONTROL: all four layers were written, so the checks below
    // are about real files rather than about missing ones.
    expect([...layers.keys()].sort()).toEqual([
      'driver',
      'eq',
      'headphone',
      'preset',
    ]);
    ['driver', 'eq', 'preset'].forEach((word) => {
      const lines = (layers.get(word) ?? '').split(/\r?\n/);
      expect(lines).toContain(MATCHED_DESIGN_DIRECTIVE);
      // Above the filters it governs: the engine applies it to the lines
      // that follow in the same file.
      expect(lines.indexOf(MATCHED_DESIGN_DIRECTIVE)).toBeLessThan(
        lines.findIndex((line) => line.startsWith('Filter ')),
      );
    });
    expect(layers.get('headphone')).toContain('Fc 8474 Hz');
    expect(layers.get('headphone')).not.toContain(MATCHED_DESIGN_DIRECTIVE);
    expect(device).not.toContain(MATCHED_DESIGN_DIRECTIVE);
  });
});
