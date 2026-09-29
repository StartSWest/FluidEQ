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
import ChannelEnum from '../common/channels';
import { IDeviceProfileSettings, IPresetV2, IState } from '../common/constants';
import { ErrorCode } from '../common/errors';
import { TError, TSuccess } from '../renderer/utils/equalizerApi';
import type { TApoDiskSync } from './apoDiskSync';
import {
  flushDeviceProfiles,
  IActiveStateOverride,
  ISessionHeadroom,
} from './deviceProfiles';
import { getResolvedPreAmp, save, savePreset } from './flush';
import type { TReflushResult } from './ipc/audioEngine';
import type { IMainSession } from './mainSession';
import { getAutomaticPresetName } from './profileStore';
import { getConfigPath, isEngineInstalled } from './registry';

/**
 * Everything the update path uses an IPC event for, which is one method.
 *
 * Stated as its own type so the same path can be run with nobody waiting on
 * the answer — an engine switch reflushes, and there is no request in flight
 * to reply to. The alternative was a fake `IpcMainEvent`, which means a cast
 * through `unknown` over a hundred-property interface to reach a function
 * that only ever calls `reply`.
 */
export type TReplySink = {
  reply: (channel: string, ...args: unknown[]) => void;
};

export const handleError = (
  event: TReplySink,
  channel: ChannelEnum | string,
  errorCode: ErrorCode,
  // Only for failures the user can act on — a file at the wrong sample rate,
  // a name that is already taken. Internal faults keep the canned wording.
  detail?: string,
  // And what to do about it. Pass this whenever `detail` describes a rule
  // rather than a fault, or the canned "reach out to the developers" is left
  // underneath a message that needs no developer at all.
  action?: string,
) => {
  const reply: TError = {
    errorCode,
    ...(detail ? { detail } : {}),
    ...(action ? { action } : {}),
  };
  // The whole failure, not just where it came from. This logged the channel
  // name alone until 1.7.1, so any request that failed without logging for
  // itself left a bug report with one word about it: the user saw an error
  // on screen and the log said `audio-engine`.
  log.error(
    `Request failed on ${channel}: ${errorCode}`,
    ...(detail ? [detail] : []),
  );
  event.reply(channel, reply);
};

/**
 * Tell the update path's two reply shapes apart.
 *
 * `TSuccess` carries `result` and nothing else, so the presence of a numeric
 * `errorCode` is the whole distinction — the same test `ipcRequest.ts` makes
 * on the window's side of the same wire.
 */
const isErrorReply = (payload: unknown): payload is TError =>
  typeof payload === 'object' &&
  payload !== null &&
  'errorCode' in payload &&
  typeof payload.errorCode === 'number';

export interface IUpdatePathDeps {
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  userDataDir: string;
  diskSync: TApoDiskSync;
  presetDirForDevice: (deviceId: string) => string;
  getCurrentPreset: () => IPresetV2;
  sessionHeadroom: () => ISessionHeadroom;
  attachPresetToActiveDevice: (presetName: string) => boolean;
  captureCurrentLayout: () => void;
}

/**
 * The one way a change reaches the engine: the state, the attached profile and
 * the config written together, and the request answered once they are.
 */
export const createUpdatePath = ({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
  diskSync,
  presetDirForDevice,
  getCurrentPreset,
  sessionHeadroom,
  attachPresetToActiveDevice,
  captureCurrentLayout,
}: IUpdatePathDeps) => {
  const updateConfigPath = async (
    event: TReplySink,
    channel: ChannelEnum | string,
  ) => {
    const engine = session.audioEngine;
    if (engine === null) {
      handleError(event, channel, ErrorCode.AUDIO_ENGINE_NOT_CHOSEN);
      return false;
    }
    // Before `getConfigPath`, not after, because under 'fluid' that call
    // CREATES the directory it hands back. A machine that has never had the
    // engine would otherwise end up with its folder under %ProgramData% and a
    // file watcher on it, for an engine that is not there to read any of it.
    //
    // A probe that throws — the registry read behind Equalizer APO's answer —
    // counts as not installed: the banner it raises has a Retry, while the
    // rejection used to escape every handler that calls this and end the whole
    // main process.
    const installed = await isEngineInstalled(engine).catch(
      (error: unknown) => {
        log.error(
          `Could not tell whether the ${engine} engine is installed`,
          error,
        );
        return false;
      },
    );
    if (!installed) {
      handleError(
        event,
        channel,
        engine === 'fluid'
          ? ErrorCode.FLUID_ENGINE_NOT_INSTALLED
          : ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
      );
      return false;
    }
    try {
      // The chosen engine's directory, resolved once and cached. Under 'fluid'
      // this is a computed path; under 'apo' it is the registry lookup, which
      // throws when Equalizer APO is not installed.
      session.configPath = await getConfigPath(engine);
      // Watching before the include is read, so a change to config.txt after
      // the read is one the watcher reports.
      diskSync.startApoConfigWatcher();
      await diskSync.configInclude.ensure(session.configPath);
    } catch (e) {
      handleError(event, channel, ErrorCode.CONFIG_NOT_FOUND);
      return false;
    }
    return true;
  };

  const handleUpdateHelperCore = async <T>(
    event: TReplySink,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile = false,
    useActiveSessionOverride = false,
  ) => {
    // Whether the chosen engine is there is asked on every change, because it
    // can be uninstalled while the app is running. Under 'fluid' this is a
    // file check plus the helper's last word on the registration, and no
    // registry probe: Equalizer APO being absent is not a failure when it is
    // not the engine being written to. Under 'apo' it is a file check too,
    // once the registry has answered for the session (`registry.ts`).
    const engine = session.audioEngine;
    if (engine === null) {
      handleError(event, channel, ErrorCode.AUDIO_ENGINE_NOT_CHOSEN);
      return;
    }
    if (!(await isEngineInstalled(engine))) {
      handleError(
        event,
        channel,
        engine === 'fluid'
          ? ErrorCode.FLUID_ENGINE_NOT_INSTALLED
          : ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
      );
      return;
    }

    try {
      if (!session.configPath) {
        session.configPath = await getConfigPath(engine);
      }
      diskSync.startApoConfigWatcher();
      await diskSync.configInclude.ensure(session.configPath);
      // Keep the root state, the disabled slider and the generated APO line on
      // the same automatic value. The writer derives this independently as its
      // final safety check; synchronizing here prevents the stored manual
      // preamp from surviving underneath an enabled Auto normalize switch.
      if (state.isAutoPreAmpOn && session.audioEngine !== 'fluid') {
        state.preAmp = getResolvedPreAmp(state);
      }
      const shouldPersistProfile =
        syncActiveProfile || useActiveSessionOverride;
      let assignment =
        deviceProfileSettings.assignments[session.activeAudioDeviceId];
      if (shouldPersistProfile && !assignment && session.activeAudioDeviceId) {
        const automaticPresetName = getAutomaticPresetName(
          session.activeAudioDeviceId,
        );
        attachPresetToActiveDevice(automaticPresetName);
        assignment =
          deviceProfileSettings.assignments[session.activeAudioDeviceId];
      }
      if (shouldPersistProfile && assignment) {
        // Every edit lands in the attached profile, named or automatic. The
        // user's manually saved copy is kept separately (see
        // savePresetBaseline in the SAVE_PRESET handler), so auto-saving here
        // can always be undone and never costs them the version they chose to
        // keep.
        savePreset(
          assignment.presetName,
          getCurrentPreset(),
          presetDirForDevice(assignment.deviceId),
          String(channel),
        );
        session.hasActiveSessionOverride = false;
      } else if (
        shouldPersistProfile &&
        !assignment &&
        session.activeAudioDeviceId
      ) {
        // An output without a profile still needs edits applied immediately.
        // Keep this override scoped to the current endpoint until it gets
        // assigned by explicit profile load or manual save.
        session.hasActiveSessionOverride = true;
        assignment =
          deviceProfileSettings.assignments[session.activeAudioDeviceId];
      }
      if (assignment) {
        // A loaded/saved profile clears the temporary override. A subsequent
        // edit recreates it and remains live-only until the user saves.
        if (syncActiveProfile) {
          session.hasActiveSessionOverride = false;
        }
      }
      const activeDevicePattern =
        session.activeAudioDevice?.guid ||
        session.activeAudioDevice?.name ||
        session.activeAudioDeviceId;
      const activeOverride: IActiveStateOverride | undefined =
        session.hasActiveSessionOverride && activeDevicePattern
          ? {
              deviceId: session.activeAudioDeviceId,
              deviceName: session.activeAudioDevice?.name,
              devicePattern: activeDevicePattern,
              state,
            }
          : undefined;
      // Flush changes to the engine's config. Once: overlapping requests are
      // the writer's to coalesce, not a race to retry (see
      // `followOutputs.ts`).
      //
      // Skipped mid-switch: `session.configPath` still points at the engine
      // being left, whose directory has just been neutralised, and writing the
      // live chain into it would make that engine audible again alongside the
      // new one. Everything else here still happens — the profile is saved,
      // the reply is a success — because the state is real; only its
      // destination is in doubt, and the reflush that ends the switch settles
      // that.
      if (!session.engineSwitching) {
        await flushDeviceProfiles(
          deviceProfileSettings,
          presetDirForDevice,
          session.configPath,
          activeOverride,
          state.isEnabled,
          sessionHeadroom(),
          state.eqCuts,
        );
      }
    } catch (e) {
      handleError(event, channel, ErrorCode.FAILURE);
      return;
    }

    // Keep a device-scoped snapshot for every fixed layout. This runs after
    // every successful edit, so moving a frequency slider is preserved when
    // the user temporarily switches to another band count.
    captureCurrentLayout();

    // Return a success message of undefined
    const reply: TSuccess<T> = { result: response };
    event.reply(channel, reply);

    // Flush changes to our local state file after informing UI that the
    // changes have been applied
    save(state, userDataDir);
  };

  const handleUpdateHelper = async <T>(
    event: TReplySink,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile = false,
    useActiveSessionOverride = false,
  ) =>
    diskSync.whileAppWrites(() =>
      handleUpdateHelperCore(
        event,
        channel,
        response,
        syncActiveProfile,
        useActiveSessionOverride,
      ),
    );

  const handleUpdate = async (
    event: TReplySink,
    channel: ChannelEnum | string,
    syncActiveProfile = false,
    useActiveSessionOverride = false,
  ) => {
    return handleUpdateHelper<void>(
      event,
      channel,
      undefined,
      syncActiveProfile,
      useActiveSessionOverride,
    );
  };

  /**
   * Rewrite the current state into whichever engine is chosen now, and say
   * whether it landed.
   *
   * This is what an engine switch, an install and an attach all end in: the
   * chain has to reach the engine that is live now, and none of those
   * requests is the channel the update path replies on. So the update path is
   * run against a sink instead of an event, and the error it would have
   * replied with is handed back to the caller rather than logged and dropped —
   * a reflush that failed after a switch is precisely the failure that
   * otherwise reaches the window as "the switch worked" while nothing is being
   * processed.
   *
   * Deliberately no `adoptExistingApoConfig()`, unlike the health check: that
   * believes the config on disk over the app's state, which is right once at
   * startup and wrong here. The directory being flushed into belongs to the
   * engine that was NOT in use, so whatever it holds is older than what the
   * user is listening to — adopting it would replace the live chain with a
   * stale one at the moment of the switch.
   */
  const reflushCurrentState = async (): Promise<TReflushResult> => {
    let failure: TError | undefined;
    const sink: TReplySink = {
      reply: (channel, ...args) => {
        const [payload] = args;
        if (isErrorReply(payload)) {
          log.error(`Reflush failed on ${channel}`, payload);
          // The first refusal is the one that describes the switch: anything
          // after it is a consequence of the same missing engine.
          failure = failure ?? payload;
        }
      },
    };
    // A label for the log and for the "saved because of" note on the profile,
    // not a channel anyone listens on — the reply goes to the sink above.
    const channel = 'engineReflush';
    if (await updateConfigPath(sink, channel)) {
      await handleUpdate(sink, channel);
    }
    return failure ? { ok: false, error: failure } : { ok: true };
  };

  const doesFilterIdExist = (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    filterId: string,
  ) => {
    // Filter id must exist
    if (!(filterId in state.filters)) {
      handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
      return false;
    }
    return true;
  };

  return {
    updateConfigPath,
    handleUpdateHelper,
    handleUpdate,
    reflushCurrentState,
    doesFilterIdExist,
  };
};
