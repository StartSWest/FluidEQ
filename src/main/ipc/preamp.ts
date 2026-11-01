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

import { IState, MAX_GAIN, PREAMP_MIN_GAIN } from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import ChannelEnum from '../../common/channels';
import { getResolvedPreAmp } from '../flush';
import { TSuccess } from '../../renderer/utils/equalizerApi';
import type { TReplySink } from '../updatePath';
import onWindowMessage from './windowMessages';
import mainText from '../mainText';

export interface IPreampIpcDeps {
  state: IState;
  canMeasureHeadroom: () => boolean;
  usesNativeHeadroom: () => boolean;
  /** The preamp Auto normalize settled on, for the window's slider. */
  tellWindowPreAmp: (preAmp: number) => void;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleUpdateHelper: <T>(
    event: TReplySink,
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
  tellWindowPreAmp,
  handleUpdate,
  handleUpdateHelper,
  handleError,
}: IPreampIpcDeps): {
  applyHeadroomTrim: (trimDb: number) => Promise<boolean>;
} => {
  onWindowMessage(ChannelEnum.SET_AUTO_PREAMP, async (event, arg) => {
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

  /**
   * A trim Auto normalize on Equalizer APO settled on (`core/headroom`),
   * written, and whether it was.
   *
   * It came from the window over a channel of its own while the measurement
   * ran there; the core measures it now and calls this. The window is told
   * the preamp the writer settled on, which its slider was listening for and
   * never heard: the channel answered with an object where it looked for a
   * number.
   */
  const applyHeadroomTrim = async (trimDb: number): Promise<boolean> => {
    // Ignored while the user owns the level. Auto normalize off means the
    // preamp is theirs, and a measurement arriving then would sit in state
    // waiting to move it the instant the switch came back on.
    if (!state.isAutoPreAmpOn || !state.isEnabled || !canMeasureHeadroom()) {
      return false;
    }
    // A trim alone, always: the moving-spectrum estimate an older version
    // kept is cleared by the first one written.
    state.smartHeadroomProgramme = undefined;
    // Never positive. The supervisor exists to take level away; a trim above
    // zero would be it adding some, and it is not trusted to be the only
    // thing that checks.
    state.smartHeadroomTrimDb = Number.isFinite(trimDb)
      ? Math.max(-20, Math.min(0, trimDb))
      : 0;
    state.preAmp = getResolvedPreAmp(state);
    let applied = true;
    const sink: TReplySink = {
      reply: (_channel, payload) => {
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload
        ) {
          applied = false;
        }
      },
    };
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
     * takes the trim as `sessionHeadroom` and derives the number itself, for
     * the one output it was heard on, and the active-session path renders it
     * straight off live state. Both routes already have this measurement;
     * neither needs a file.
     */
    await handleUpdateHelper(sink, 'apoHeadroom', undefined, false, false);
    if (applied) {
      tellWindowPreAmp(state.preAmp);
    }
    return applied;
  };

  onWindowMessage(ChannelEnum.GET_PREAMP, async (event) => {
    const reply: TSuccess<number> = { result: state.preAmp || 0 };
    event.reply(ChannelEnum.GET_PREAMP, reply);
  });

  onWindowMessage(ChannelEnum.SET_PREAMP, async (event, arg) => {
    const channel = ChannelEnum.SET_PREAMP;
    const gain = parseFloat(arg[0]) || 0;

    // The preamp's own floor, never a band's: it cancels the SUM of every
    // layer, and a headphone correction plays as published past ±20 dB.
    if (gain < PREAMP_MIN_GAIN || gain > MAX_GAIN) {
      handleError(
        event,
        channel,
        ErrorCode.INVALID_PARAMETER,
        mainText('eq.refused.preampRange', {
          min: PREAMP_MIN_GAIN,
          max: MAX_GAIN,
        }),
        mainText('eq.refused.preampRange.action'),
      );
      return;
    }

    state.preAmp = gain;
    await handleUpdate(event, channel, false, true);
  });

  return { applyHeadroomTrim };
};
