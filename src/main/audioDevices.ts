/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { IAudioDevice } from '../common/constants';
import coalesceRequests from '../common/coalescedRequest';
import { POWERSHELL_PATH } from './powershell';

const execFileAsync = promisify(execFile);

/**
 * Asking Windows which outputs exist, and telling it which to use.
 *
 * Ninety lines that leave the process: a PowerShell script enumerates the audio
 * endpoints and a second call sets the default. Everything else in
 * deviceProfiles.ts is text going into a config file — this is the only part
 * that talks to the operating system, and the only part that can fail because
 * something outside FluidEQ said no.
 *
 * The script is a file on disk rather than a string argument, and stays that
 * way: a device name can contain a quote, and building a command line out of
 * one is how that becomes an injection.
 */
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

const HELPER_PREFIX = 'audio-devices-';

/**
 * Where the script keeps its compiled helper between runs.
 *
 * The script's C# is compiled by `Add-Type`, which starts the C# compiler —
 * csc.exe and its temp files — each time it runs, and the output list is read
 * every few seconds while the window is open (`DeviceProfiles.tsx`), plus on
 * every output change: the compile was most of each read. Measured under
 * PowerShell 7, whose compiler runs in-process and is the cheaper of the two,
 * a read took ≈1.0–1.3 s compiling and ≈0.6 s loading the kept helper.
 *
 * Named by the script's own hash, so a new version of the script compiles
 * once and never loads an older helper, and the helpers of older versions are
 * removed. Undefined — the script then compiles in memory, as every run used
 * to — when the folder cannot be made; the script does the same on its own
 * for a helper that is missing, half written or refused.
 *
 * The hash is taken again whenever the script's size or modified time moves.
 * `pnpm dev` does not restart main for an edit under `assets`, and a helper
 * named by the hash taken at launch went on running the old C# under the new
 * script — its changes silently ignored, or a member the script now calls
 * missing and the output list coming back empty.
 */
let helperAssembly:
  { stamp: string; assembly: Promise<string | undefined> } | undefined;

const keepHelperFor = async (
  scriptPath: string,
): Promise<string | undefined> => {
  try {
    const script = await fs.promises.readFile(scriptPath);
    const digest = createHash('sha256')
      .update(script)
      .digest('hex')
      .slice(0, 16);
    const folder = path.join(app.getPath('userData'), 'helpers');
    await fs.promises.mkdir(folder, { recursive: true });
    const name = `${HELPER_PREFIX}${digest}.dll`;
    const stale = (await fs.promises.readdir(folder)).filter(
      (file) => file.startsWith(HELPER_PREFIX) && file !== name,
    );
    // A helper still loaded by a run in flight cannot be removed yet; the
    // next launch removes it.
    await Promise.allSettled(
      stale.map((file) => fs.promises.rm(path.join(folder, file))),
    );
    return path.join(folder, name);
  } catch (error) {
    log.warn('Output list: compiling its helper on every read', error);
    return undefined;
  }
};

const getHelperAssemblyPath = async (): Promise<string | undefined> => {
  const scriptPath = getAudioDeviceScriptPath();
  let stamp: string;
  try {
    const { mtimeMs, size } = await fs.promises.stat(scriptPath);
    stamp = `${mtimeMs}:${size}`;
  } catch (error) {
    log.warn('Output list: its script could not be read', error);
    return undefined;
  }
  if (helperAssembly?.stamp !== stamp) {
    helperAssembly = { stamp, assembly: keepHelperFor(scriptPath) };
  }
  return helperAssembly.assembly;
};

const helperArguments = async (): Promise<string[]> => {
  const assembly = await getHelperAssemblyPath();
  return assembly === undefined ? [] : ['-AssemblyPath', assembly];
};

/**
 * What the discovery script said, or nothing at all.
 *
 * `JSON.parse` was called on this output bare, with `|| '[]'` as its only
 * guard. That covers an empty run and nothing else: PowerShell writes progress
 * records, deprecation notices and module-load warnings to the same stream it
 * is asked for JSON on, and one line ahead of the payload makes the whole thing
 * unparseable. The throw then travelled up through the IPC handler and the
 * device list came back as an error rather than as a list — for a machine whose
 * devices were perfectly readable.
 *
 * An empty list is the honest answer to "I could not read this". The caller
 * already handles having no devices; it has no way to handle an exception.
 *
 * The scalar case is kept because the script emits a bare object rather than a
 * one-element array when the machine has exactly one endpoint — that is
 * `ConvertTo-Json` behaviour, not a bug, and it is why the wrap exists.
 */
export const parseDeviceJson = (stdout: string): IAudioDevice[] => {
  const text = stdout.trim();
  if (!text) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    log.error(
      `Audio device discovery did not return JSON: ${text.slice(0, 200)}`,
    );
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed as IAudioDevice[];
  }
  // `null` parses fine and is not a device.
  return parsed && typeof parsed === 'object' ? [parsed as IAudioDevice] : [];
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

/**
 * The endpoints Windows has, read by one PowerShell run however many callers
 * ask at once — see `coalesceRequests` for who shares an answer and who waits
 * for the next one.
 */
export const discoverAudioDevices = coalesceRequests(
  async (): Promise<IAudioDevice[]> => {
    if (process.platform !== 'win32') {
      return [
        {
          id: 'demo-speakers',
          name: 'Demo Speakers (Windows discovery runs on Windows)',
          guid: '{DEMO-SPEAKERS}',
          isDefault: true,
          isActive: true,
          isEqualizerApoAttached: true,
          isFluidEngineAttached: true,
          canHostEffects: true,
        },
        {
          id: 'demo-headphones',
          name: 'Demo Headphones',
          guid: '{DEMO-HEADPHONES}',
          isDefault: false,
          isActive: true,
          isEqualizerApoAttached: true,
          isFluidEngineAttached: true,
          canHostEffects: true,
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
        ...(await helperArguments()),
      ],
      { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    return filterVisibleAudioDevices(parseDeviceJson(stdout));
  },
);

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
      ...(await helperArguments()),
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
  );
};
