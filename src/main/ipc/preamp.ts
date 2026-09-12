/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { ipcMain } from 'electron';
import { IState, MAX_GAIN, MIN_GAIN } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { getResolvedPreAmp } from '../flush';
import { TSuccess } from '../../renderer/utils/equalizerApi';

export interface IPreampIpcDeps {
  state: IState;
  canMeasureHeadroom: () => boolean;
  usesNativeHeadroom: () => boolean;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
}

/**
 * One number and the switch that decides who owns it.
 *
 * Three channels, and worth its own file for a reason this release earned: the
 * preamp had two writers who disagreed — this one and a renderer that restored
 * a remembered value — and finding that meant reading across four thousand
 * lines and a second process. Whatever writes `state.preAmp` in the main
 * process is now in one file that fits on a screen.
 */
export const registerPreampIpc = ({
  state,
  canMeasureHeadroom,
  usesNativeHeadroom,
  handleUpdate,
  handleUpdateHelper,
  handleError,
}: IPreampIpcDeps) => {
  ipcMain.on(ChannelEnum.SET_AUTO_PREAMP, async (event, arg) => {
    const isAutoPreAmpOn = Boolean(arg[0]);
    const automatic =
      isAutoPreAmpOn && !usesNativeHeadroom()
        ? getResolvedPreAmp({ ...state, isAutoPreAmpOn: true })
        : state.preAmp;
    state.isAutoPreAmpOn = isAutoPreAmpOn;
    state.preAmp = automatic;
    // Switching off drops what was measured. Nothing updates it while the mode
    // is off, so keeping it would leave a spectrum and a trim in memory ready to
    // move the level the instant the switch came back — evidence about a session
    // that ended, applied to one that has not started listening yet.
    if (!isAutoPreAmpOn) {
      state.smartHeadroomProgramme = undefined;
      state.smartHeadroomTrimDb = undefined;
    }
    // This is device-profile state, just like its manual preamp. Without the
    // active-session path the flag changed in memory, then the flush rebuilt APO
    // from the attached profile where Auto normalize was still off — so enabling
    // it after setting -5 dB produced the exact same -5 dB output.
    await handleUpdateHelper<number>(
      event,
      ChannelEnum.SET_AUTO_PREAMP,
      state.preAmp,
      false,
      true,
    );
  });

  ipcMain.on(ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT, async (event, arg) => {
    // Ignored while the user owns the level. Auto normalize off means the preamp
    // is theirs, and a measurement arriving then would sit in state waiting to
    // move it the instant the switch came back on.
    const requestId: unknown = arg[2];
    if (!state.isAutoPreAmpOn || !state.isEnabled || !canMeasureHeadroom()) {
      event.reply(ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT, {
        result: { requestId, applied: false },
      });
      return;
    }
    const points = Array.isArray(arg[0]) ? arg[0] : [];
    const programme = points
      .filter(
        (point: unknown): point is { frequency: number; gain: number } =>
          typeof point === 'object' &&
          point !== null &&
          Number.isFinite((point as { frequency: unknown }).frequency) &&
          Number.isFinite((point as { gain: unknown }).gain),
      )
      .map(({ frequency, gain }) => ({ frequency, gain }));
    const trim = Number.parseFloat(String(arg[1]));

    state.smartHeadroomProgramme = programme.length > 0 ? programme : undefined;
    // Never positive. The supervisor exists to take level away; a trim above
    // zero arriving over IPC would be it adding some, and the renderer is not
    // trusted to be the only thing that checks.
    state.smartHeadroomTrimDb = Number.isFinite(trim)
      ? Math.max(-20, Math.min(0, trim))
      : 0;
    state.preAmp = getResolvedPreAmp(state);
    /**
     * A measurement is evidence, and evidence is never written to a profile.
     *
     * `useActiveSessionOverride` was true here, which makes
     * `shouldPersistProfile` true in `handleUpdateHelperCore` — so every push
     * wrote the attached profile. While the estimate is still converging the
     * floor between pushes is two seconds, so a listening session spent its
     * first two minutes writing the user's profile every two seconds, on the
     * main process, with `fs.writeFileSync`. That is the "Wrote preset for:
     * <profile>" line repeating with nobody touching the app.
     *
     * It also committed whatever was live at the time into the saved profile
     * and cleared `hasActiveSessionOverride` — so a measurement quietly saved
     * edits the user had not saved.
     *
     * Nothing is lost by not writing it. The config writer never reads the
     * preamp out of a profile when Auto normalize is on: `flushDeviceProfiles`
     * takes the programme and the trim as `sessionHeadroom` and derives the
     * number itself, for the one output they were heard on, and the
     * active-session path renders them straight off live state. Both routes
     * already have this measurement; neither needs a file.
     */
    await handleUpdateHelper(
      event,
      ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
      { requestId, applied: true },
      false,
      false,
    );
  });

  ipcMain.on(ChannelEnum.GET_PREAMP, async (event) => {
    const reply: TSuccess<number> = { result: state.preAmp || 0 };
    event.reply(ChannelEnum.GET_PREAMP, reply);
  });

  ipcMain.on(ChannelEnum.SET_PREAMP, async (event, arg) => {
    const channel = ChannelEnum.SET_PREAMP;
    const gain = parseFloat(arg[0]) || 0;

    if (gain < MIN_GAIN || gain > MAX_GAIN) {
      handleError(
        event,
        channel,
        ErrorCode.INVALID_PARAMETER,
        `The preamp goes from ${MIN_GAIN} dB to ${MAX_GAIN} dB.`,
        'The preamp was left where it was.',
      );
      return;
    }

    state.preAmp = gain;
    await handleUpdate(event, channel, false, true);
  });
};
