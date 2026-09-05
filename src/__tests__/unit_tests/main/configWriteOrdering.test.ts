/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { flushDeviceProfiles } from '../../../main/deviceProfiles';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { FLUIDEQ_CONFIG_FILENAME } from '../../../main/flush';
import type { IDeviceProfileSettings } from '../../../common/constants';

it('publishes every Include after its dependency and finishes the root before removing old files', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fluideq-config-order-'),
  );
  const presets = path.join(directory, 'presets');
  fs.mkdirSync(presets);
  fs.writeFileSync(
    path.join(presets, 'Studio'),
    JSON.stringify({ preAmp: -3, filters: {} }),
  );
  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      headphones: {
        deviceId: 'headphones',
        deviceName: 'Headphones',
        deviceGuid: '{headphones}',
        presetName: 'Studio',
      },
    },
  };
  const originalWrite = fs.promises.writeFile.bind(fs.promises);
  let releaseFirst: () => void = () => undefined;
  let announceFirst: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const started = new Promise<void>((resolve) => {
    announceFirst = resolve;
  });
  let firstWrite = true;
  const missingIncludes: string[] = [];
  let includesChecked = 0;
  const write = jest
    .spyOn(fs.promises, 'writeFile')
    .mockImplementation(async (...args) => {
      if (firstWrite) {
        firstWrite = false;
        announceFirst();
        await gate;
      }
      const contents = String(args[1]);
      [...contents.matchAll(/^Include: (.+)$/gm)].forEach((match) => {
        includesChecked += 1;
        const dependency = path.join(directory, match[1].trim());
        if (!fs.existsSync(dependency)) {
          missingIncludes.push(dependency);
        }
      });
      await originalWrite(...args);
    });
  try {
    const first = flushDeviceProfiles(settings, () => presets, directory);
    await started;
    // A newer device selection may arrive while the previous snapshot is still
    // writing. It must not delete dependencies underneath that snapshot.
    const second = flushDeviceProfiles(
      { version: 1, assignments: {} },
      () => presets,
      directory,
    );
    releaseFirst();
    await Promise.all([first, second]);
    expect(missingIncludes).toEqual([]);
    expect(
      fs.readFileSync(path.join(directory, FLUIDEQ_CONFIG_FILENAME), 'utf8'),
    ).not.toContain('{headphones}');
    // Also exercise a non-coalesced populated snapshot as the positive control.
    await flushDeviceProfiles(settings, () => presets, directory);
    expect(includesChecked).toBeGreaterThan(0);
    expect(missingIncludes).toEqual([]);
    await flushPendingWrites();
  } finally {
    releaseFirst();
    write.mockRestore();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
