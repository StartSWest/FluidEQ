/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import log from 'electron-log';
import fs from 'fs';
import {
  adoptApoFeatureText,
  describeApoFeatureText,
} from '../common/apoFeatureSync';
import coalesceRequests from '../common/coalescedRequest';
import {
  APO_FEATURE_FILE_WORD_PATTERN,
  APO_FEATURES,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
  TApoFeature,
} from '../common/constants';
import { readApoDeviceChain } from './apoConfigReader';
import type { createApoAdoption } from './apoAdopt';
import { flushPendingWrites, hasUnsettledWrites } from './asyncWriter';
import { createConfigInclude } from './configInclude';
import { ISessionHeadroom } from './deviceProfiles';
import { flushDeviceProfiles } from './deviceProfileFlush';
import { CONFIG_FILENAME, save, savePreset, stateToApoFiles } from './flush';
import type { IMainSession } from './mainSession';
import { forgetApoInstall } from './registry';

type TApoAdoption = ReturnType<typeof createApoAdoption>;

/** A device file, a feature file or a custom file FluidEQ keeps per output. */
const GENERATED_CHAIN_FILE = new RegExp(
  `^fluideq(?:-device)?-[0-9a-f]{12}(?:-(?:${APO_FEATURE_FILE_WORD_PATTERN}|custom))?\\.txt$`,
  'i',
);

export interface IApoDiskSyncDeps {
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  userDataDir: string;
  presetDirForDevice: (deviceId: string) => string;
  getCurrentPreset: () => IPresetV2;
  sessionHeadroom: () => ISessionHeadroom;
  syncCustomFxFromConfig: TApoAdoption['syncCustomFxFromConfig'];
  adoptBypassFromConfig: TApoAdoption['adoptBypassFromConfig'];
  /** Tells the window the state it holds for this output is stale. */
  notifyOutputStateChanged: () => void;
}

/**
 * Live two-way synchronization with the generated Equalizer APO files.
 *
 * `fs.watch` is only a wake-up signal. A single FluidEQ update touches more
 * than one file and APO itself may also cause duplicate notifications, so the
 * callback never treats an event as a change. Each wake-up reads the complete
 * active chain and compares each feature's parsed audible shape with what the
 * current state would write. FluidEQ's own writes therefore compare equal and
 * stop here (or wait for the writer to settle first — see the guard at the top
 * of the sync); an external edit is adopted once, persisted, canonicalized,
 * and the canonical write compares equal on the next event.
 *
 * Coalesced, not debounced (`coalesceRequests`): one sync runs at a time,
 * and every wake-up that arrives while it runs shares a single sync after it,
 * which reads whatever the folder holds by then. It used to wait for 180 ms of
 * quiet, a guess at how long a burst of notifications lasts; the last
 * notification of a burst is still always followed by a read made after it,
 * which is what the guess was for.
 */
const createApoDiskSync = ({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
  presetDirForDevice,
  getCurrentPreset,
  sessionHeadroom,
  syncCustomFxFromConfig,
  adoptBypassFromConfig,
  notifyOutputStateChanged,
}: IApoDiskSyncDeps) => {
  let apoConfigWatcher: fs.FSWatcher | undefined;
  let watchedApoConfigPath = '';
  /** Set at quit: nothing reads the folder after that. */
  let apoSyncStopped = false;
  // The live APO reader must never observe the half-state between an app edit
  // mutating memory and that edit reaching the generated files. Otherwise it
  // can read the old file back as an external change and undo actions such as
  // Clear EQ. Nested because a few higher-level operations reuse the update
  // helper.
  let apoAppWriteDepth = 0;
  let apoSyncDeferredByAppWrite = false;

  /** Read once per folder the watcher below is on (`configInclude.ts`). */
  const configInclude = createConfigInclude(
    (configPath) =>
      apoConfigWatcher !== undefined && watchedApoConfigPath === configPath,
  );

  const persistExternallyAdoptedState = () => {
    save(state, userDataDir);
    const assignment =
      deviceProfileSettings.assignments[session.activeAudioDeviceId];
    if (assignment) {
      savePreset(
        assignment.presetName,
        getCurrentPreset(),
        presetDirForDevice(assignment.deviceId),
        'external-apo-edit',
      );
    }
  };

  const syncActiveApoFilesFromDisk = async () => {
    // Not while the app is writing — and "writing" now outlasts the handler
    // that asked for it, because the config files go to disk asynchronously
    // and coalesced. The watcher fires on every one of those writes as it
    // lands; reading the chain back in the middle of a drag found the disk a
    // step behind the state and adopted it, which reset every other band. So
    // the sync waits for the writer to settle and then runs once, when what is
    // on disk is what the state says and there is nothing to adopt.
    if (apoAppWriteDepth > 0 || hasUnsettledWrites()) {
      if (!apoSyncDeferredByAppWrite) {
        apoSyncDeferredByAppWrite = true;
        flushPendingWrites()
          .catch(() => undefined)
          .finally(() => {
            if (apoAppWriteDepth === 0 && apoSyncDeferredByAppWrite) {
              apoSyncDeferredByAppWrite = false;
              queueApoDiskSync();
            }
          });
      }
      return;
    }
    if (!session.configPath || !session.activeAudioDeviceId) {
      return;
    }
    const devicePattern =
      session.activeAudioDevice?.guid ||
      session.activeAudioDevice?.name ||
      session.activeAudioDeviceId;
    const chain = readApoDeviceChain(session.configPath, devicePattern);
    let changed = syncCustomFxFromConfig();
    let generatedChanged = false;
    let containsUnsupportedCommands = false;

    if (chain?.features) {
      const expected = stateToApoFiles(state, state.convolution?.fileName);
      const expectedByFeature = new Map<TApoFeature, string>(
        (expected?.features ?? []).map(({ feature, lines }) => [
          feature,
          lines.join('\n'),
        ]),
      );

      generatedChanged = adoptBypassFromConfig(
        chain.features,
        chain.shared ?? '',
        !!chain.custom,
      );

      APO_FEATURES.forEach((feature) => {
        const actual = chain.features?.[feature];
        if (actual === undefined) {
          return;
        }
        const expectedText = expectedByFeature.get(feature) ?? '';
        if (
          describeApoFeatureText(actual) ===
          describeApoFeatureText(expectedText)
        ) {
          return;
        }
        const adoption = adoptApoFeatureText(
          state,
          feature,
          actual,
          expectedText,
        );
        if (adoption.unsupported) {
          containsUnsupportedCommands = true;
          log.warn(
            `Not adopting ${feature}: its generated APO file contains ${adoption.unsupported} unsupported command(s).`,
          );
          return;
        }
        generatedChanged = generatedChanged || adoption.changed;
        if (adoption.changed) {
          log.info(
            `Adopted an external Equalizer APO edit for the ${feature} layer.`,
          );
        }
      });
    }

    changed = changed || generatedChanged;
    if (!changed) {
      return;
    }

    /**
     * Only a change to the GENERATED files is a reason to write anything back.
     *
     * `syncCustomFxFromConfig` re-reads the user's own custom file, which is
     * not part of a preset — `getCurrentPreset` does not carry `customFx`, and
     * `getStateForAudioDevice` deliberately clears it, because that file is
     * where it lives. So persisting on it wrote a preset whose bytes could not
     * have changed, and then saved the whole state beside it.
     *
     * That is the "Wrote preset for: <profile>" line repeating every couple of
     * seconds with nobody touching the app. Each of this app's own APO writes
     * defers a sync and re-queues one when it finishes, and every sync that
     * re-read the custom file counted as an external edit — so the app kept
     * answering its own writes with a preset write, on the main process, in
     * the middle of playback.
     *
     * The renderer is still told, below: re-reading the file IS how the custom
     * layer reaches the panel, and that has nothing to do with persisting.
     */
    if (generatedChanged) {
      persistExternallyAdoptedState();
    }

    // Recompute automatic headroom and normalize the generated text after a
    // supported external edit. Never rewrite a file containing commands the app
    // cannot represent: preserving the user's APO work is more important than
    // normalizing the other files in that same pass.
    if (generatedChanged && !containsUnsupportedCommands) {
      await flushDeviceProfiles(
        deviceProfileSettings,
        presetDirForDevice,
        session.configPath,
        undefined,
        state.isEnabled,
        sessionHeadroom(),
        session.audioDevices ?? session.secondOutputDevices,
        {
          writeDsp: session.audioEngine === 'fluid',
          dspOverrides: session.outputDspOverrides,
          stateOverrides: session.outputStateOverrides,
          systemRackEnabled: session.systemRackEnabled,
        },
      );
    }

    notifyOutputStateChanged();
  };

  const queueApoDiskSync = coalesceRequests(() =>
    apoSyncStopped
      ? Promise.resolve()
      : syncActiveApoFilesFromDisk().catch((error) =>
          log.warn('Unable to synchronize Equalizer APO file edits', error),
        ),
  );

  const startApoConfigWatcher = () => {
    if (!session.configPath || watchedApoConfigPath === session.configPath) {
      return;
    }
    apoConfigWatcher?.close();
    watchedApoConfigPath = session.configPath;
    try {
      apoConfigWatcher = fs.watch(
        session.configPath,
        { persistent: false },
        (_eventType, fileName) => {
          const name = fileName?.toString();
          if (!name || name.toLowerCase() === CONFIG_FILENAME) {
            configInclude.forget();
          }
          // Every word a feature's file is or was named by, from the one list:
          // spelled out here it missed `preset` when the voicing's file was
          // renamed, and would have missed `tone`.
          if (!name || GENERATED_CHAIN_FILE.test(name)) {
            queueApoDiskSync();
          }
        },
      );
      apoConfigWatcher.on('error', (error) => {
        log.warn('Equalizer APO config watcher stopped', error);
        apoConfigWatcher?.close();
        apoConfigWatcher = undefined;
        watchedApoConfigPath = '';
        configInclude.forget();
        // A folder that cannot be watched any more is usually a folder that is
        // gone, and the registry is what says where Equalizer APO's is now.
        forgetApoInstall();
      });
    } catch (error) {
      apoConfigWatcher = undefined;
      watchedApoConfigPath = '';
      log.warn('Unable to watch the Equalizer APO config directory', error);
    }
  };

  /**
   * Runs one of the app's own writes with the reader held off, and lets a
   * sync the write deferred run once the last write in progress is done.
   */
  const whileAppWrites = async <T>(work: () => Promise<T>): Promise<T> => {
    apoAppWriteDepth += 1;
    try {
      return await work();
    } finally {
      apoAppWriteDepth -= 1;
      if (apoAppWriteDepth === 0 && apoSyncDeferredByAppWrite) {
        apoSyncDeferredByAppWrite = false;
        queueApoDiskSync();
      }
    }
  };

  /** At quit: no sync after the one in flight, and no folder watched. */
  const stop = () => {
    apoSyncStopped = true;
    apoConfigWatcher?.close();
    apoConfigWatcher = undefined;
  };

  return { configInclude, startApoConfigWatcher, whileAppWrites, stop };
};

export type TApoDiskSync = ReturnType<typeof createApoDiskSync>;

export default createApoDiskSync;
