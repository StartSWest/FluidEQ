/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import {
  forgetPath,
  scheduleWrite,
  scheduleWriteOperation,
} from './asyncWriter';
import {
  APO_FEATURE_FILE_WORD_PATTERN,
  IDeviceProfileSettings,
  IEqCuts,
} from '../common/constants';
import { EQ_CUTS_FILENAME } from '../common/eqCuts';
import { addFileToPath } from './flush';
import type {
  IActiveStateOverride,
  ISessionHeadroom,
  TPresetDirForDevice,
} from './deviceProfiles';
import {
  CRLF,
  CUSTOM_FILE_TEMPLATE,
  customFileName,
  deviceProfilesToFiles,
} from './deviceProfiles';

// The rendered profiles written into the engine's folder: only what
// changed, the files no output needs any more swept away, and each output's
// custom file created once.

/**
 * Write a file only when its contents actually changed.
 *
 * Equalizer APO reloads the whole chain whenever a file in the config directory
 * is touched, and the split turned one write per edit into a dozen. Nearly all
 * of them are identical to what is already there — dragging one slider changes
 * the EQ file and the preamp, and nothing else — so rewriting the rest would
 * buy a reload per file for no change at all.
 */
const writeIfChanged = (filePath: string, contents: string): Promise<void> => {
  // The writer keeps the last contents it accepted for every path and skips
  // a write that would change nothing, which is the whole of what this used
  // to do by reading the file back from disk on every call — a synchronous
  // read per config file per slider movement. The write itself is
  // asynchronous and coalesced; see asyncWriter.
  return scheduleWrite(filePath, contents);
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
    // Every word a feature's file is or was named by: a voicing file from
    // before it was named `-preset.txt` is swept like any file of ours.
    APO_FEATURE_FILE_WORD_PATTERN,
    ...RETIRED_FEATURES,
    // Named here so the config editor may write it — see isGeneratedConfigFile
    // — and NOT so the sweep may delete it. It is the single file here that
    // holds somebody's own work, and CUSTOM_FILE below lifts it back out of
    // everything removeStaleFiles is allowed to touch. The one place that may
    // delete it deliberately is the REMOVE_DEVICE_PROFILE handler in
    // ipc/profiles.ts, which the user reaches by choosing to forget an output.
    'custom',
  ].join('|')}))\\.txt$`,
);

/**
 * The one generated name that is the user's file, not ours.
 *
 * Matched separately because it is the exception to the sweep below: FluidEQ
 * creates it empty and then never writes it again, so whatever is in it was
 * typed by hand and cannot be regenerated from anything. Deleting one is not
 * this sweep's decision to make — see removeStaleFiles — it belongs to the
 * REMOVE_DEVICE_PROFILE handler in ipc/profiles.ts, the one place the user has
 * actually said the output is gone for good.
 */
const CUSTOM_FILE = /^fluideq-[0-9a-f]{12}-custom\.txt$/;

/**
 * A generated impulse (`getConvolutionFileName`), as a name and as it is
 * named inside the files that play it. Swept like the text files, but kept
 * out of `isGeneratedConfigFile`: the config editor writes text, and a WAV is
 * not one of the files it may be pointed at.
 */
const IMPULSE_FILE = /^fluideq-convolution-[0-9a-f]{12}\.wav$/;

const IMPULSE_NAMED = /fluideq-convolution-[0-9a-f]{12}\.wav/g;

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
  fileName === EQ_CUTS_FILENAME || GENERATED_FILE.test(fileName);

/**
 * Delete the files of outputs and features that no longer exist — except the
 * custom files, which THIS SWEEP never deletes.
 *
 * A feature switched off stops being included, and an unreferenced file is
 * inaudible — but leaving it there would mean the config directory slowly
 * filling with the layers of every device ever plugged in, each looking like
 * something that is still applied.
 *
 * The custom file is exempt here because "its output is gone" is not the same
 * statement as "its output is gone for good", and this sweep cannot tell them
 * apart. An unplugged headset is an empty assignment list; so is a flush with
 * `isEnabled: false`, which is exactly what neutralising the engine being left
 * writes — and this sweep used to take every custom file in the directory with
 * it, deleting hand-written work on nothing more than the user picking the
 * other engine. A generated file can always be written again from the profile;
 * this one cannot be written again from anything, so it stays and waits for
 * its device to come back — unless the user deliberately forgets that output,
 * which is a real "gone for good" this sweep is never told and must not guess
 * at. That deletion happens by name, in the REMOVE_DEVICE_PROFILE handler in
 * ipc/profiles.ts, the one place a disappearance is a fact rather than a
 * side effect of an empty keep-set.
 */
// Per config directory, the generated-file set as of the last flush that
// swept the directory. See flushDeviceProfiles.
const lastFlushedFileSet = new Map<string, string>();

const removeStaleFiles = (configDirPath: string, keep: ReadonlySet<string>) => {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(configDirPath);
  } catch {
    return;
  }

  fileNames
    .filter(
      (fileName) =>
        (isGeneratedConfigFile(fileName) || IMPULSE_FILE.test(fileName)) &&
        !CUSTOM_FILE.test(fileName) &&
        !keep.has(fileName),
    )
    .forEach((fileName) => {
      try {
        const filePath = addFileToPath(configDirPath, fileName);
        fs.unlinkSync(filePath);
        forgetPath(filePath);
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
 * the very next slider move. It is also what lets an output that comes back
 * find its own file again — the sweep below never deletes these (see
 * removeStaleFiles), so the one that was there before an unplug or an engine
 * switch is still there. Only forgetting the output on purpose removes it,
 * through the REMOVE_DEVICE_PROFILE handler in ipc/profiles.ts.
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
  presetDirForDevice: TPresetDirForDevice,
  configDirPath: string,
  activeOverride?: IActiveStateOverride,
  isEnabled = true,
  sessionHeadroom: ISessionHeadroom | undefined = undefined,
  cuts: IEqCuts | undefined = undefined,
): Promise<void> => {
  const files = deviceProfilesToFiles(
    settings,
    presetDirForDevice,
    configDirPath,
    activeOverride,
    isEnabled,
    sessionHeadroom,
    cuts,
  );

  // Every output that still has a chain, by the digest its files are named
  // with. Derived from the device files rather than passed alongside them,
  // because that is the same list by construction and cannot fall out of step.
  const liveSlugs = new Set<string>();
  // The impulses those files still name: written beside them rather than
  // through them, so read back out of what refers to them. One nobody names
  // is an output's old convolution, and it used to stay on disk for good.
  const liveImpulses = new Set<string>();
  files.forEach((contents, fileName) => {
    const slug = fileName.match(/^fluideq-device-([0-9a-f]{12})\.txt$/)?.[1];
    if (slug) {
      liveSlugs.add(slug);
    }
    (contents.match(IMPULSE_NAMED) ?? []).forEach((impulse) =>
      liveImpulses.add(impulse),
    );
  });

  // Before the device files that include them, like every other dependency
  // here: an Include must never name a file that is not there yet.
  //
  // Both directory sweeps — this one and the stale-file removal below — run
  // only when the SET of files changes. They walk the config directory
  // synchronously, and the set is the same on every slider movement; what
  // changes then is the contents, which the writer handles.
  return scheduleWriteOperation(configDirPath, async () => {
    const fileSet = [...files.keys(), ...liveSlugs, ...liveImpulses]
      .sort()
      .join('|');
    const fileSetChanged = fileSet !== lastFlushedFileSet.get(configDirPath);
    if (fileSetChanged) {
      ensureCustomFiles(configDirPath, liveSlugs);
    }

    // Starting writes in map order does not finish them in that order.
    // Await each dependency before publishing its Include, and serialize whole
    // snapshots so an older root cannot land after a newer cleanup. This is
    // asynchronous; queued slider edits are coalesced by the operation writer.
    const entries = [...files];
    for (let index = 0; index < entries.length; index += 1) {
      const [fileName, contents] = entries[index];
      await writeIfChanged(addFileToPath(configDirPath, fileName), contents);
    }

    // After the root, so nothing is deleted while something still includes it.
    // The keep set is the generated files alone: the custom files need no
    // entry here because removeStaleFiles never touches one, live output or
    // not.
    if (fileSetChanged) {
      removeStaleFiles(
        configDirPath,
        new Set([...files.keys(), ...liveImpulses]),
      );
      lastFlushedFileSet.set(configDirPath, fileSet);
    }
  });
};
