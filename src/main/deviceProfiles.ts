/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023> <AQUA Dev Team>
Copyright (C) <2026> <AQUA device-profile contributors>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import {
  IAudioDevice,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
  getDefaultState,
} from '../common/constants';
import {
  addFileToPath,
  APO_FEATURES,
  FLUIDEQ_CONFIG_FILENAME,
  fetchPreset,
  IApoChainFiles,
  stateToApoFiles,
  TApoFeature,
} from './flush';
import { writeConvolutionWav } from './convolution';

export interface IActiveStateOverride {
  deviceId?: string;
  devicePattern: string;
  state: IState;
}

const isSafeConvolutionFileName = (fileName: string) =>
  fileName === path.basename(fileName) && !fileName.includes('..');

const execFileAsync = promisify(execFile);
const SETTINGS_FILENAME = 'device-profiles.json';

const getAudioDeviceScriptPath = () => {
  const scriptPath = path.join(
    process.resourcesPath,
    'assets',
    'windows-audio-devices.ps1',
  );
  const developmentScriptPath = path.join(
    __dirname,
    '../../assets/windows-audio-devices.ps1',
  );
  return fs.existsSync(scriptPath) ? scriptPath : developmentScriptPath;
};

export const getDefaultDeviceProfileSettings = (): IDeviceProfileSettings => ({
  version: 1,
  assignments: {},
});

export const loadDeviceProfileSettings = (
  userDataDir: string,
): IDeviceProfileSettings => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  try {
    const input = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (input?.version !== 1 || typeof input.assignments !== 'object') {
      throw new Error('Unsupported device profile settings');
    }
    return input as IDeviceProfileSettings;
  } catch {
    return getDefaultDeviceProfileSettings();
  }
};

export const saveDeviceProfileSettings = (
  settings: IDeviceProfileSettings,
  userDataDir: string,
) => {
  fs.writeFileSync(
    path.join(userDataDir, SETTINGS_FILENAME),
    JSON.stringify(settings, null, 2),
    'utf8',
  );
};

export const assignDeviceProfile = (
  settings: IDeviceProfileSettings,
  assignment: IDeviceProfileAssignment,
) => {
  settings.assignments[assignment.deviceId] = assignment;
};

export const removeDeviceProfile = (
  settings: IDeviceProfileSettings,
  deviceId: string,
) => {
  delete settings.assignments[deviceId];
};

export const renameAssignedPreset = (
  settings: IDeviceProfileSettings,
  oldName: string,
  newName: string,
) => {
  Object.values(settings.assignments).forEach((assignment) => {
    if (assignment.presetName === oldName) {
      assignment.presetName = newName;
    }
  });
};

export const removeAssignmentsForPreset = (
  settings: IDeviceProfileSettings,
  presetName: string,
) => {
  Object.entries(settings.assignments).forEach(([deviceId, assignment]) => {
    if (assignment.presetName === presetName) {
      delete settings.assignments[deviceId];
    }
  });
};

const CRLF = '\r\n';

/**
 * A short, filename-safe stand-in for an endpoint.
 *
 * Windows endpoint ids are long and full of characters a filename should not
 * carry, and they are the only thing that identifies an output uniquely. The
 * digest is stable across runs, which is what makes a device's files findable
 * again rather than accumulating one set per launch.
 */
const deviceSlug = (deviceKey: string) =>
  createHash('sha1').update(deviceKey).digest('hex').slice(0, 12);

const getConvolutionFileName = (deviceId: string) =>
  `fluideq-convolution-${deviceSlug(deviceId)}.wav`;

const deviceFileName = (slug: string) => `fluideq-device-${slug}.txt`;

const featureFileName = (slug: string, feature: TApoFeature) =>
  `fluideq-${slug}-${feature}.txt`;

const presetForDeviceChain = (
  preset: IPresetV2,
  convolutionFileName?: string,
) => {
  const presetState = {
    isEnabled: true,
    isGraphViewOn: false,
    isCaseSensitiveFs: false,
    ...preset,
    // After the spread, not before: a preset that carries the key explicitly
    // undefined would otherwise overwrite the default with nothing. Absent
    // means automatic, which every profile written before the flag existed was.
    isAutoPreAmpOn: preset.isAutoPreAmpOn ?? true,
  };

  return stateToApoFiles(presetState, convolutionFileName);
};

/** One output's share of the config: its root block and the files it includes. */
interface IDeviceFiles {
  /** The `Device:` / `Channel:` / `Include:` trio that goes in fluideq.txt. */
  block: string;
  /** Filename to contents, feature files before the device file naming them. */
  files: Array<[string, string]>;
}

/**
 * Lay one device's chain out as files.
 *
 * The root only ever names the device file, and the device file only ever names
 * its features. Nothing in this shape says which output is current, which is
 * the point: APO's own `Device:` guard picks the matching block at playback
 * time, so switching Windows outputs needs no config write at all.
 */
const chainToFiles = (
  chain: IApoChainFiles,
  subject: string,
  devicePattern: string,
  deviceKey: string,
): IDeviceFiles => {
  const slug = deviceSlug(deviceKey);
  const files: Array<[string, string]> = chain.features.map(
    ({ feature, lines }) => [
      featureFileName(slug, feature),
      [`# ${feature}: ${subject}`, ...lines].join(CRLF),
    ],
  );

  files.push([
    deviceFileName(slug),
    [
      `# ${subject}`,
      // Before the features, because APO applies an impulse response ahead of
      // the filters and reads the file top to bottom.
      ...(chain.convolution ? [chain.convolution] : []),
      ...chain.features.map(
        ({ feature }) => `Include: ${featureFileName(slug, feature)}`,
      ),
      // Last, and after the includes: it is the peak of everything they add up
      // to, so it cannot be decided until they have all had their say.
      chain.preAmp,
    ].join(CRLF),
  ]);

  return {
    block: [
      `# ${subject}`,
      `Device: ${devicePattern}`,
      'Channel: all',
      `Include: ${deviceFileName(slug)}`,
    ].join(CRLF),
    files,
  };
};

/**
 * Every file the Equalizer APO config is made of, keyed by filename.
 *
 * Iteration order is write order: a feature file always comes before the device
 * file whose `Include:` names it, and `fluideq.txt` is last of all. At no point
 * does a file on disk point at one that is not there yet.
 */
export type TApoConfigFiles = Map<string, string>;

export const deviceProfilesToFiles = (
  settings: IDeviceProfileSettings,
  presetsDir: string,
  configDirPath?: string,
  activeOverride?: IActiveStateOverride,
  isEnabled = true,
): TApoConfigFiles => {
  const files: TApoConfigFiles = new Map();

  if (!isEnabled) {
    files.set(
      FLUIDEQ_CONFIG_FILENAME,
      [
        '# Generated by FluidEQ. Changes are overwritten automatically.',
        '# FluidEQ engine disabled; no Equalizer APO rules are active.',
      ].join(CRLF),
    );
    return files;
  }

  const blocks: string[] = [];
  const addDevice = (
    chain: IApoChainFiles | undefined,
    subject: string,
    devicePattern: string,
    deviceKey: string,
  ) => {
    if (!chain) {
      return;
    }
    const device = chainToFiles(chain, subject, devicePattern, deviceKey);
    device.files.forEach(([name, contents]) => files.set(name, contents));
    blocks.push(device.block);
  };

  // Equalizer APO accumulates: every block whose `Device:` line matches the
  // output contributes its commands, and a later block does NOT reset an
  // earlier one. So if the device the user is listening on also has a preset
  // assigned, emitting both blocks stacks the preset's filters underneath the
  // live session instead of replacing them — pressing Clear EQ would leave the
  // preset fully audible. The session override wins, so its device drops out
  // of the assignment list entirely.
  const isOverriddenDevice = (assignment: IDeviceProfileAssignment) => {
    if (!activeOverride) {
      return false;
    }
    const pattern = assignment.deviceGuid || assignment.deviceName;
    return (
      (!!activeOverride.deviceId &&
        activeOverride.deviceId === assignment.deviceId) ||
      activeOverride.devicePattern === pattern
    );
  };

  Object.values(settings.assignments)
    .filter((assignment) => !isOverriddenDevice(assignment))
    .forEach((assignment) => {
      try {
        const preset = fetchPreset(assignment.presetName, presetsDir);
        let convolutionFileName: string | undefined;
        if (configDirPath && preset.convolution) {
          convolutionFileName = getConvolutionFileName(assignment.deviceId);
          if (
            preset.convolution.fileName &&
            isSafeConvolutionFileName(preset.convolution.fileName)
          ) {
            convolutionFileName = preset.convolution.fileName;
          }
        }
        if (configDirPath && preset.convolution && convolutionFileName) {
          if (!preset.convolution.fileName) {
            writeConvolutionWav(
              addFileToPath(configDirPath, convolutionFileName),
              preset.convolution.filters,
            );
          }
        }
        addDevice(
          presetForDeviceChain(preset, convolutionFileName),
          `${assignment.deviceName} -> ${assignment.presetName}`,
          assignment.deviceGuid || assignment.deviceName,
          assignment.deviceId,
        );
      } catch {
        // A profile we cannot read is one this device simply does not get.
      }
    });

  if (activeOverride) {
    let activeConvolutionFileName: string | undefined;
    if (activeOverride.state.convolution) {
      if (
        activeOverride.state.convolution.fileName &&
        isSafeConvolutionFileName(activeOverride.state.convolution.fileName)
      ) {
        activeConvolutionFileName = activeOverride.state.convolution.fileName;
      } else if (configDirPath && activeOverride.deviceId) {
        activeConvolutionFileName = getConvolutionFileName(
          activeOverride.deviceId,
        );
        writeConvolutionWav(
          addFileToPath(configDirPath, activeConvolutionFileName),
          activeOverride.state.convolution.filters,
        );
      }
    }

    addDevice(
      stateToApoFiles(activeOverride.state, activeConvolutionFileName),
      'Active FluidEQ session override',
      activeOverride.devicePattern,
      activeOverride.deviceId || activeOverride.devicePattern,
    );
  }

  // Last, so the file that names every other one is written after them.
  files.set(
    FLUIDEQ_CONFIG_FILENAME,
    [
      '# Generated by FluidEQ. Changes are overwritten automatically.',
      [
        '# Neutral fallback for every output without an attached profile.',
        'Device: all',
        'Channel: all',
      ].join(CRLF),
      ...blocks,
    ].join(`${CRLF}${CRLF}`),
  );

  return files;
};

/**
 * The full EQ state for a device, with every optional field present.
 *
 * Spreading a preset over the defaults is not enough, because callers apply the
 * result with Object.assign: a key the preset does not have is simply absent
 * from the object, so the assign leaves the PREVIOUS device's value in place.
 * That is how one device's convolution, voicing, driver correction, Smart EQ
 * correction or preamp followed the user onto every other output — and, once
 * edits started auto-saving, got written into those devices' profiles for good.
 *
 * Every optional field is therefore listed explicitly, undefined included, so
 * assigning this over the live state clears what the new device does not have.
 */
export const getStateForAudioDevice = (
  settings: IDeviceProfileSettings,
  deviceId: string,
  presetsDir: string,
): IState => {
  const defaultState = getDefaultState();
  const assignment = settings.assignments[deviceId];

  let preset: IPresetV2 | undefined;
  if (assignment) {
    try {
      preset = fetchPreset(assignment.presetName, presetsDir);
    } catch {
      preset = undefined;
    }
  }

  return {
    ...defaultState,
    preAmp: preset?.preAmp ?? defaultState.preAmp,
    filters: preset?.filters ?? defaultState.filters,
    eqFormat: preset?.eqFormat,
    graphicEq: preset?.graphicEq,
    convolution: preset?.convolution,
    isFlat: preset?.isFlat,
    voicing: preset?.voicing,
    driver: preset?.driver,
    smartEq: preset?.smartEq,
    headset: preset?.headset,
    headsetTarget: preset?.headsetTarget,
    headsetSource: preset?.headsetSource,
    // Absent means automatic, which is what every profile written before the
    // flag existed was. Not `?? defaultState` — the default is the same value,
    // but saying so here keeps the rule in one place.
    isAutoPreAmpOn: preset?.isAutoPreAmpOn ?? true,
  };
};

export const filterVisibleAudioDevices = (
  devices: IAudioDevice[],
): IAudioDevice[] => {
  const visibleByName = new Map<string, IAudioDevice>();

  devices
    .filter((device) => device.isActive && device.name.trim())
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
    .forEach((device) => {
      const normalizedName = device.name.trim().toLocaleLowerCase();
      if (!visibleByName.has(normalizedName)) {
        visibleByName.set(normalizedName, {
          ...device,
          name: device.name.trim(),
        });
      }
    });

  return [...visibleByName.values()].sort((left, right) => {
    return left.name.localeCompare(right.name);
  });
};

export const discoverAudioDevices = async (): Promise<IAudioDevice[]> => {
  if (process.platform !== 'win32') {
    return [
      {
        id: 'demo-speakers',
        name: 'Demo Speakers (Windows discovery runs on Windows)',
        guid: '{DEMO-SPEAKERS}',
        isDefault: true,
        isActive: true,
      },
      {
        id: 'demo-headphones',
        name: 'Demo Headphones',
        guid: '{DEMO-HEADPHONES}',
        isDefault: false,
        isActive: true,
      },
    ];
  }

  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      getAudioDeviceScriptPath(),
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout.trim() || '[]');
  return filterVisibleAudioDevices(
    (Array.isArray(parsed) ? parsed : [parsed]) as IAudioDevice[],
  );
};

export const setDefaultAudioDevice = async (deviceId: string) => {
  if (process.platform !== 'win32') {
    return;
  }

  const devices = await discoverAudioDevices();
  if (!devices.some((device) => device.id === deviceId)) {
    throw new Error('The selected audio output is no longer available.');
  }

  await execFileAsync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      getAudioDeviceScriptPath(),
      '-SetDefaultDeviceId',
      deviceId,
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
  );
};

/**
 * Write a file only when its contents actually changed.
 *
 * Equalizer APO reloads the whole chain whenever a file in the config directory
 * is touched, and the split turned one write per edit into a dozen. Nearly all
 * of them are identical to what is already there — dragging one slider changes
 * the EQ file and the preamp, and nothing else — so rewriting the rest would
 * buy a reload per file for no change at all.
 */
const writeIfChanged = (filePath: string, contents: string) => {
  try {
    if (fs.readFileSync(filePath, 'utf8') === contents) {
      return;
    }
  } catch {
    // Not there yet, or unreadable. Either way, write it.
  }
  fs.writeFileSync(filePath, contents, 'utf8');
};

/**
 * Files this writer generated, and only those.
 *
 * Built from APO_FEATURES so a feature added later cannot leave orphans behind,
 * and deliberately strict about the digest and the extension: the config
 * directory also holds the impulse response WAVs, APO's own sample configs, and
 * whatever the user put there.
 */
const GENERATED_FILE = new RegExp(
  `^fluideq-(?:device-[0-9a-f]{12}|[0-9a-f]{12}-(?:${APO_FEATURES.join(
    '|',
  )}))\\.txt$`,
);

/**
 * Delete the files of outputs and features that no longer exist.
 *
 * A feature switched off stops being included, and an unreferenced file is
 * inaudible — but leaving it there would mean the config directory slowly
 * filling with the layers of every device ever plugged in, each looking like
 * something that is still applied.
 */
const removeStaleFiles = (configDirPath: string, keep: TApoConfigFiles) => {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(configDirPath);
  } catch {
    return;
  }

  fileNames
    .filter((fileName) => GENERATED_FILE.test(fileName) && !keep.has(fileName))
    .forEach((fileName) => {
      try {
        fs.unlinkSync(addFileToPath(configDirPath, fileName));
      } catch {
        // A file we cannot delete is one APO no longer includes anyway.
      }
    });
};

export const flushDeviceProfiles = (
  settings: IDeviceProfileSettings,
  presetsDir: string,
  configDirPath: string,
  activeOverride?: IActiveStateOverride,
  isEnabled = true,
) => {
  const files = deviceProfilesToFiles(
    settings,
    presetsDir,
    configDirPath,
    activeOverride,
    isEnabled,
  );

  // In the map's order, which is dependency order: nothing names a file that
  // has not been written yet, so a reload landing between two of these writes
  // sees a config that is behind but never one that is broken.
  files.forEach((contents, fileName) => {
    writeIfChanged(addFileToPath(configDirPath, fileName), contents);
  });

  // After the root, so nothing is deleted while something still includes it.
  removeStaleFiles(configDirPath, files);
};
