/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFiltersMap,
} from '../common/constants';
import {
  getFixedBandSizeForCount,
  ILayoutSnapshot,
  snapshotFilters,
} from '../common/layouts';
import { scheduleWrite } from './asyncWriter';

const LAYOUT_SETTINGS_FILENAME = 'layout-frequencies.json';

interface ILayoutSettingsFile {
  version: 1;
  devices: Record<string, Record<string, ILayoutSnapshot>>;
}

const loadLayoutSettings = (filePath: string): ILayoutSettingsFile => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as
      Partial<ILayoutSettingsFile> | undefined;
    if (parsed?.version !== 1 || !parsed.devices) {
      throw new Error('Invalid layout settings');
    }
    return {
      version: 1,
      devices:
        typeof parsed.devices === 'object'
          ? (parsed.devices as ILayoutSettingsFile['devices'])
          : {},
    };
  } catch {
    return { version: 1, devices: {} };
  }
};

export interface ILayoutSettingsStore {
  /** Remember the bands as they stand, under their output and band count. */
  capture: (deviceKey: string, filters: IFiltersMap) => void;
  /** Forget every band count's bands for one output. */
  clear: (deviceKey: string) => void;
  /** The bands last captured for one output at one band count, if usable. */
  stored: (
    deviceKey: string,
    size: FixedBandSizeEnum,
  ) => ILayoutSnapshot | undefined;
}

/**
 * Each output's bands at every fixed band count it has been used at, so a
 * frequency moved at ten bands is still there after a trip to thirty-one.
 *
 * Captured after every successful edit — each step of a drag, each Auto
 * normalize measurement, each health check — and each capture used to rewrite
 * the whole file with `fs.writeFileSync`, blocking the main process on the
 * disk for an edit that had not moved a single band. Now a capture that
 * changes nothing writes nothing, and one that does goes through the
 * coalescing writer, so a drag ends in a handful of writes of the last
 * position (`asyncWriter.ts`) and a quit still waits for the last one.
 */
export const createLayoutSettingsStore = (
  userDataDir: string,
): ILayoutSettingsStore => {
  const filePath = path.join(userDataDir, LAYOUT_SETTINGS_FILENAME);
  const settings = loadLayoutSettings(filePath);

  const save = () => {
    scheduleWrite(filePath, JSON.stringify(settings, null, 2));
  };

  const capture = (deviceKey: string, filters: IFiltersMap) => {
    const size = getFixedBandSizeForCount(Object.keys(filters).length);
    if (!size) {
      return;
    }
    const snapshot = snapshotFilters(filters);
    const device = settings.devices[deviceKey] ?? {};
    const previous = device[String(size)];
    if (
      previous !== undefined &&
      JSON.stringify(previous) === JSON.stringify(snapshot)
    ) {
      return;
    }
    device[String(size)] = snapshot;
    settings.devices[deviceKey] = device;
    save();
  };

  const clear = (deviceKey: string) => {
    if (!(deviceKey in settings.devices)) {
      return;
    }
    delete settings.devices[deviceKey];
    save();
  };

  const stored = (deviceKey: string, size: FixedBandSizeEnum) => {
    const snapshot = settings.devices[deviceKey]?.[String(size)];
    if (!Array.isArray(snapshot) || snapshot.length !== size) {
      return undefined;
    }
    if (
      !snapshot.every(
        (band) =>
          Number.isFinite(band.frequency) &&
          Number.isFinite(band.gain) &&
          Number.isFinite(band.quality) &&
          Object.values(FilterTypeEnum).includes(band.type),
      )
    ) {
      return undefined;
    }
    return snapshot;
  };

  return { capture, clear, stored };
};
