/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import {
  APO_FEATURES,
  IAudioDevice,
  ICustomFxSettings,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
  TApoFeature,
  getDefaultState,
} from '../common/constants';
import {
  addFileToPath,
  FLUIDEQ_CONFIG_FILENAME,
  fetchPreset,
  IApoChainFiles,
  savePreset,
  stateToApoFiles,
} from './flush';
import { parseCustomFx } from '../common/customFx';
import { writeConvolutionWav } from './convolution';
import { POWERSHELL_PATH } from './powershell';
import { hydrateConvolutionAnalysis } from './convolutionAnalysis';

export interface IActiveStateOverride {
  deviceId?: string;
  /**
   * What Windows calls this output, for the comment above its block.
   *
   * Every other block is headed `<output> -> <profile>`, and that comment is
   * the only thing in the config that names an output in words — the `Device:`
   * line is a GUID and the file names are a digest of one. A session override
   * had no name to put there, so the one output somebody is listening through
   * was the one whose files could not say what they were for.
   */
  deviceName?: string;
  devicePattern: string;
  state: IState;
}

/**
 * Whether this name may be written into a `Convolution:` line.
 *
 * `path.basename` splits on separators and nothing else, so the old pair of
 * checks accepted a name containing a newline — and A NEWLINE IN AN APO CONFIG
 * FILE ENDS THE COMMAND. A name of `ir.wav`, a carriage return, and a `Plugin:`
 * line would have been written out as two commands, the second of which makes
 * Equalizer APO load a DLL into the Windows audio pipeline.
 *
 * Reachable because a preset read from disk does not pass through
 * `normalizeConvolution` and the preset schema does not constrain this field at
 * all, so an imported profile is the delivery mechanism. Found in review rather
 * than the other way round.
 *
 * Every control character rather than the two that end a line: what the config
 * parser does with a NUL or an escape is not this file's to reason about, and
 * none of them belong in a filename anybody meant to write.
 */
const isSafeConvolutionFileName = (fileName: string) =>
  fileName === path.basename(fileName) &&
  !fileName.includes('..') &&
  // eslint-disable-next-line no-control-regex -- the characters are the point
  !/[\u0000-\u001f\u007f]/.test(fileName);

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

/**
 * The one file in a device's chain that FluidEQ does not write.
 *
 * Created empty when an output first gets a chain and never touched again, so
 * whatever goes in it survives every flush. Every other file here is generated
 * from the profile and rewritten the moment anything changes, which makes them
 * all the wrong place to put anything by hand — a hand edit to one is not
 * refused, it simply disappears at the next slider move.
 *
 * This is where an Equalizer APO command FluidEQ has no interface for belongs:
 * a `Plugin:` line for a VST, a `Copy:` for channel routing, a `Delay:`.
 */
const customFileName = (slug: string) => `fluideq-${slug}-custom.txt`;

/**
 * The custom file belonging to one output, by its endpoint id.
 *
 * Exported because exporting a chain has to carry this file literally: it is
 * the one part of an output's chain that is not generated from the profile, so
 * it is the one part that cannot be rebuilt at the other end. The slug is a
 * digest and the name is assembled from it in two places here, neither of which
 * anything outside this file should be reproducing by hand.
 */
export const getCustomFileNameForDevice = (deviceId: string) =>
  customFileName(deviceSlug(deviceId));

/** Read the measurable EQ portion of an output's user-owned custom file. */
const readCustomFx = (
  configDirPath: string | undefined,
  deviceId: string,
): ICustomFxSettings | undefined => {
  if (!configDirPath || !deviceId) {
    return undefined;
  }
  const fileName = getCustomFileNameForDevice(deviceId);
  try {
    return parseCustomFx(
      fileName,
      fs.readFileSync(addFileToPath(configDirPath, fileName), 'utf8'),
    );
  } catch {
    return undefined;
  }
};

/** What a custom file says before anybody has put anything in it. */
const CUSTOM_FILE_TEMPLATE = [
  '# Yours. FluidEQ creates this file once and never writes it again, so',
  '# anything here survives every change made in the app.',
  '#',
  '# Applied last, after the generated chain and after its preamp. Equalizer',
  '# APO commands go here — Plugin:, Copy:, Delay: and the rest.',
  '',
];

const presetForDeviceChain = (
  preset: IPresetV2,
  convolutionFileName?: string,
  customFx?: ICustomFxSettings,
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
    customFx,
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
 *
 * The guard reaches into the included files too, which is what makes a device
 * file safe to write without repeating the `Device:` line inside it.
 * `DeviceFilterFactory` keeps `deviceMatches` across a nested file load — there
 * is no per-file reset, only a `startOfConfiguration` one — and while it is
 * false every command is blanked, the `Include:` line included. So another
 * output's files are not merely filtered out at playback; they are never opened.
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
      // After the includes: it is the peak of everything they add up to, so it
      // cannot be decided until they have all had their say.
      chain.preAmp,
      // And the user's own file after even that.
      //
      // Everything above is generated and rewritten on the next edit, so it is
      // no place to put anything by hand. This one is never generated: FluidEQ
      // creates it empty and then leaves it alone forever, which makes it the
      // only line in the chain somebody can own.
      //
      // Last on purpose, and after the preamp rather than before it. FluidEQ
      // cannot know what is in here, so it cannot reserve headroom for it —
      // running it after the reserve keeps the arithmetic above honest and
      // makes the ownership plain: this is the generated chain, and then this
      // is yours.
      ...(chain.custom === false ? [] : [`Include: ${customFileName(slug)}`]),
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
        if (configDirPath && preset.convolution?.fileName) {
          try {
            const hydrated = hydrateConvolutionAnalysis(
              preset.convolution,
              configDirPath,
            );
            if (hydrated !== preset.convolution) {
              preset.convolution = hydrated;
              savePreset(assignment.presetName, preset, presetsDir);
            }
          } catch {
            // Keep the profile usable if a legacy WAV cannot be analyzed. APO
            // will report an unreadable convolution independently.
          }
        }
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
        const customFx = readCustomFx(configDirPath, assignment.deviceId);
        addDevice(
          presetForDeviceChain(preset, convolutionFileName, customFx),
          `${assignment.deviceName} -> ${assignment.presetName}`,
          assignment.deviceGuid || assignment.deviceName,
          assignment.deviceId,
        );
      } catch {
        // A profile we cannot read is one this device simply does not get.
      }
    });

  if (activeOverride) {
    let activeState = activeOverride.state;
    if (configDirPath && activeState.convolution?.fileName) {
      try {
        const hydrated = hydrateConvolutionAnalysis(
          activeState.convolution,
          configDirPath,
        );
        if (hydrated !== activeState.convolution) {
          activeState = { ...activeState, convolution: hydrated };
          activeOverride.state.convolution = hydrated;
        }
      } catch {
        // Same legacy fallback as assigned profiles above.
      }
    }
    let activeConvolutionFileName: string | undefined;
    if (activeState.convolution) {
      if (
        activeState.convolution.fileName &&
        isSafeConvolutionFileName(activeState.convolution.fileName)
      ) {
        activeConvolutionFileName = activeState.convolution.fileName;
      } else if (configDirPath && activeOverride.deviceId) {
        activeConvolutionFileName = getConvolutionFileName(
          activeOverride.deviceId,
        );
        writeConvolutionWav(
          addFileToPath(configDirPath, activeConvolutionFileName),
          activeState.convolution.filters,
        );
      }
    }

    const activeCustomFx =
      activeState.customFx ??
      readCustomFx(configDirPath, activeOverride.deviceId ?? '');
    addDevice(
      stateToApoFiles(
        { ...activeState, customFx: activeCustomFx },
        activeConvolutionFileName,
      ),
      // In the same `<output> -> <what it is>` shape every other block carries,
      // so the config view splits it the same way and the device file's first
      // line names the output rather than only the mechanism. Without a name to
      // put there it stays what it was — a caller that cannot say which output
      // this is must not be made to invent one.
      activeOverride.deviceName
        ? `${activeOverride.deviceName} -> Active FluidEQ session`
        : 'Active FluidEQ session override',
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
    // Listed for the same reason as the rest, and missing for as long as it was
    // missing from the saved profile: an output that never asked for the
    // contour has to clear the one the previous output was using, or it follows
    // the user from the headphones to the speakers.
    smartEq: preset?.smartEq,
    headphone: preset?.headphone,
    eqImport: preset?.eqImport,
    customFx: undefined,
    headset: preset?.headset,
    headsetTarget: preset?.headsetTarget,
    headsetSource: preset?.headsetSource,
    headsetSignature: preset?.headsetSignature,
    // Listed like the rest, and for the same reason: a device whose profile
    // bypasses nothing has to clear whatever the previous one had switched off,
    // or a layer would arrive silent on an output that never switched it off.
    bypassed: preset?.bypassed,
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
    // Absolute, never a bare name: libuv searches the current directory before
    // PATH, and a shortcut-launched Electron app has its install directory as
    // the current directory. See the comment on the constant.
    POWERSHELL_PATH,
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
    // Absolute, for the same reason as the discovery call above.
    POWERSHELL_PATH,
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
/**
 * Features this writer no longer has, whose files may still be on disk.
 *
 * A name removed from APO_FEATURES stops being written and stops being
 * recognised, which would leave its files sitting in the config directory
 * forever — unreferenced, inaudible, and looking exactly like something that is
 * still applied. Kept here so the sweep below can still take them away.
 */
const RETIRED_FEATURES = ['loudness'];

const GENERATED_FILE = new RegExp(
  `^fluideq-(?:device-[0-9a-f]{12}|[0-9a-f]{12}-(?:${[
    ...APO_FEATURES,
    ...RETIRED_FEATURES,
    // Swept like the rest, but only when its output is gone entirely — the
    // keep-set below holds every live one. It is the single file here that may
    // contain somebody's own work, so it outlives every generated sibling and
    // goes only with the device.
    'custom',
  ].join('|')}))\\.txt$`,
);

/**
 * Whether a name is one of the files FluidEQ writes into the config directory.
 *
 * Exported so the editor can be held to the same list the sweep uses. Anything
 * arriving from a window is a name to check rather than trust, and this is the
 * only definition of what FluidEQ is entitled to write — `config.txt` is APO's,
 * the sample configs are APO's, and everything else in that directory belongs
 * to somebody who is not us.
 */
export const isGeneratedConfigFile = (fileName: string) =>
  GENERATED_FILE.test(fileName);

/**
 * Delete the files of outputs and features that no longer exist.
 *
 * A feature switched off stops being included, and an unreferenced file is
 * inaudible — but leaving it there would mean the config directory slowly
 * filling with the layers of every device ever plugged in, each looking like
 * something that is still applied.
 */
const removeStaleFiles = (configDirPath: string, keep: ReadonlySet<string>) => {
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

/**
 * Make sure every live output has a custom file, and never write over one.
 *
 * Created empty rather than on demand, because a file that only appears once
 * somebody has found the right menu is a feature nobody discovers. It is in
 * the include list from the first flush, so it is visible in the config view
 * from the first flush, waiting.
 *
 * The existence check is the whole safety of it: this runs on every edit, and
 * writing the template unconditionally would erase whatever was in there on
 * the very next slider move.
 */
const ensureCustomFiles = (configDirPath: string, slugs: ReadonlySet<string>) =>
  slugs.forEach((slug) => {
    const filePath = addFileToPath(configDirPath, customFileName(slug));
    if (fs.existsSync(filePath)) {
      return;
    }
    try {
      fs.writeFileSync(filePath, CUSTOM_FILE_TEMPLATE.join(CRLF), 'utf8');
    } catch {
      // An output whose custom file cannot be created still gets its chain;
      // the Include simply points at nothing, which the config view reports.
    }
  });

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

  // Every output that still has a chain, by the digest its files are named
  // with. Derived from the device files rather than passed alongside them,
  // because that is the same list by construction and cannot fall out of step.
  const liveSlugs = new Set<string>();
  files.forEach((_contents, fileName) => {
    const slug = fileName.match(/^fluideq-device-([0-9a-f]{12})\.txt$/)?.[1];
    if (slug) {
      liveSlugs.add(slug);
    }
  });

  // Before the device files that include them, like every other dependency
  // here: an Include must never name a file that is not there yet.
  ensureCustomFiles(configDirPath, liveSlugs);

  // In the map's order, which is dependency order: nothing names a file that
  // has not been written yet, so a reload landing between two of these writes
  // sees a config that is behind but never one that is broken.
  files.forEach((contents, fileName) => {
    writeIfChanged(addFileToPath(configDirPath, fileName), contents);
  });

  // After the root, so nothing is deleted while something still includes it.
  // A custom file is kept for as long as its output has a chain — it is the
  // one file here somebody may have put work into, and it goes only when the
  // output it belongs to does.
  removeStaleFiles(
    configDirPath,
    new Set([...files.keys(), ...[...liveSlugs].map(customFileName)]),
  );
};
