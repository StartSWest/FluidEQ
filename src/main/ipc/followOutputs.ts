/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import { IAudioDevice } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import type { TSuccess } from '../../renderer/utils/ipcRequest';
import { checkConfigFile, save, updateConfig } from '../flush';
import { flushDeviceProfiles, getStateForAudioDevice } from '../deviceProfiles';
import { getConfigPath } from '../registry';
import type { IProfilesIpcDeps, IReplySink } from './profiles';

export type TOutputFollowerDeps = Pick<
  IProfilesIpcDeps,
  | 'state'
  | 'userDataDir'
  | 'presetDirForDevice'
  | 'deviceProfileSettings'
  | 'session'
  | 'handleError'
  | 'createEmptyProfileForActiveDevice'
  | 'adoptExistingApoConfig'
  | 'applyDeviceState'
  | 'captureCurrentLayout'
  | 'notifyOutputStateChanged'
  | 'guardAgainstApo'
>;

/**
 * What main does with a fresh reading of the outputs, whoever read them.
 *
 * It used to be the body of the window's GET_AUDIO_DEVICES handler, and that
 * handler was the only way main ever learned the outputs had moved: the
 * window polled it every three seconds while it was on screen, and not at all
 * while it was hidden or in the tray — so a headset plugged in with FluidEQ in
 * the tray kept playing the speakers' profile until somebody opened the
 * window. Windows now says when the outputs move (`outputWatch.ts`) and main
 * reads them itself; both readings come through here, so a plug-in is
 * followed the same way whether or not anybody is looking.
 *
 * The answer goes to `sink` on `channel` in the reply's own shape: the
 * window's request replies to the request, and the watcher's reading is
 * pushed on AUDIO_DEVICES_CHANGED, a failure included.
 *
 * Two readings can overlap — the window's own and the watcher's — and only
 * one of them switches: the check and the change of `activeAudioDeviceId` are
 * one synchronous step ahead of every await below.
 */
export const createOutputFollower = ({
  state,
  userDataDir,
  presetDirForDevice,
  deviceProfileSettings,
  session,
  handleError,
  createEmptyProfileForActiveDevice,
  adoptExistingApoConfig,
  applyDeviceState,
  captureCurrentLayout,
  notifyOutputStateChanged,
  guardAgainstApo,
}: TOutputFollowerDeps) => {
  return async (
    devices: IAudioDevice[],
    sink: IReplySink,
    channel: ChannelEnum,
  ): Promise<void> => {
    const activeDevice = devices.find((device) => device.isDefault);
    if (activeDevice && activeDevice.id !== session.activeAudioDeviceId) {
      session.activeAudioDeviceId = activeDevice.id;
      session.activeAudioDevice = activeDevice;
      // A device switch always starts from that device's attached profile or
      // a clean neutral state. Never carry a previous output's transient EQ.
      session.hasActiveSessionOverride = false;
      applyDeviceState(
        getStateForAudioDevice(
          deviceProfileSettings,
          activeDevice.id,
          presetDirForDevice,
          // The preset keeps playing across the switch: it is the machine's
          // choice, like the rack it comes with. See `voicingForDevice`.
          { voicing: state.voicing },
        ),
      );
      // Every output keeps at least one named profile, so there is always
      // somewhere for an edit to land and always something in the list to
      // select. Only for outputs the user actually lands on — creating one
      // eagerly for every endpoint Windows reports would fill the list with
      // profiles for devices nobody has used.
      if (!deviceProfileSettings.assignments[activeDevice.id]) {
        createEmptyProfileForActiveDevice();
      }
      // The first moment the config can be read back: there is now an endpoint
      // to look up, and the state beside it is that endpoint's. It has to
      // happen before the save and the flush below, both of which write this
      // state over whatever the file was saying.
      if (adoptExistingApoConfig() === false) {
        notifyOutputStateChanged();
        handleError(
          sink,
          channel,
          ErrorCode.FAILURE,
          'The external EQ contains stages FluidEQ cannot safely adopt. Its files were left unchanged.',
        );
        return;
      }
      save(state, userDataDir);
      captureCurrentLayout();

      // A Windows output change must immediately replace the APO rules. This
      // prevents the previous device's profile from remaining active until a
      // later EQ edit is made in FluidEQ.
      try {
        if (!session.configPath) {
          session.configPath = await getConfigPath(
            session.audioEngine ?? 'apo',
          );
        }
        if (!checkConfigFile(session.configPath)) {
          updateConfig(session.configPath);
        }
        // Written once, and its own failure is the answer. It used to be
        // tried five times, half a second to a second apart, against two
        // config writes landing at once. Neither is left for a wait to fix:
        // every config write goes through the coalescing writer, one snapshot
        // in flight per folder (`asyncWriter`), so two of ours cannot collide,
        // and a reader holding the file — the engine's watcher, Equalizer APO
        // — gets the contents written in place. What still fails is a folder
        // gone, full or not ours, which no wait changes; the next change
        // writes again. The retries also hid the real error behind "failed
        // after 5 retries".
        await flushDeviceProfiles(
          deviceProfileSettings,
          presetDirForDevice,
          session.configPath,
          undefined,
          state.isEnabled,
          undefined,
          state.eqCuts,
        );
      } catch (error) {
        log.error('Failed to flush the profile for the active output', error);
      }

      // Last, and outside the try: the config write can fail without making the
      // swap any less real, and the panels must never be left describing the
      // output the user just moved away from.
      notifyOutputStateChanged();
    }
    const reply: TSuccess<IAudioDevice[]> = { result: devices };
    sink.reply(channel, reply);
    // After the answer, never before it: the window is waiting for this
    // list, and switching Equalizer APO off restarts Windows audio.
    guardAgainstApo(devices).catch((error) =>
      log.error('The Equalizer APO guard failed', error),
    );
  };
};
