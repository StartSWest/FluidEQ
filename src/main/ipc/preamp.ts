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
  handleUpdate,
  handleUpdateHelper,
  handleError,
}: IPreampIpcDeps) => {
  ipcMain.on(ChannelEnum.SET_AUTO_PREAMP, async (event, arg) => {
    // Whichever way the switch moves, the number that comes out of it is the one
    // auto-normalize computes for the chain as it stands. On, it goes on deriving
    // it; off, that same value becomes the manual one to adjust from. The switch
    // changes who is in charge of the level, never the level itself.
    //
    // Which is why the resolver is asked with the flag forced on rather than with
    // whatever it is about to become. `resolvePreAmp` branches on that flag and
    // returns the stored manual value when it is off, so reading it around the
    // assignment gets one of the two directions wrong every time:
    //
    //  - Read before the flip, switching OFF is right (it captures the automatic
    //    reserve) and switching ON is wrong — it answers with the manual value,
    //    which is then published as though it were the newly computed one. That
    //    is the bug where enabling Auto normalize left the old number on screen.
    //    It only looked correct on tabs that mount the response graph, because
    //    the graph recomputed and overwrote the display a moment later; on the
    //    Karaoke tab, which mounts no graph, the stale number simply stayed.
    //  - Read after the flip, switching ON is right and switching OFF drops back
    //    to the stored manual value — 0 on a profile that never set one by hand,
    //    so a chain reserving 11 dB got 11 dB louder from the click of a switch
    //    whose whole job is to stop it clipping.
    //
    // Forcing it on answers the question actually being asked, in both
    // directions. The copy is shallow and read-only; nothing here mutates state.
    const isAutoPreAmpOn = Boolean(arg[0]);
    const automatic = getResolvedPreAmp({ ...state, isAutoPreAmpOn: true });
    state.isAutoPreAmpOn = isAutoPreAmpOn;
    state.preAmp = automatic;
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

  ipcMain.on(ChannelEnum.SET_SMART_HEADROOM, async (event, arg) => {
    // The same reasoning as the switch above, one position along: whichever way
    // this moves, the number that comes out is the one the resolver derives for
    // the chain as it stands, asked with both flags forced into the position
    // they are about to be in. Reading it before the assignment would answer
    // for the mode being left rather than the mode being entered.
    const isSmartHeadroomOn = Boolean(arg[0]);
    state.isSmartHeadroomOn = isSmartHeadroomOn;
    // Turning Smart off drops the measurement with it. Keeping it would leave a
    // spectrum in memory that nothing is updating any more, ready to be applied
    // the moment somebody switched back — evidence about a session that ended.
    if (!isSmartHeadroomOn) {
      state.smartHeadroomProgramme = undefined;
      state.smartHeadroomTrimDb = undefined;
    }
    /*
     * Resolved as the state actually is, NOT with the flag forced on.
     *
     * The switch above forces it because both of its directions are about the
     * automatic value. This one is not: Smart is a position of that switch, so
     * it is only ever reached with Auto normalize already on, and forcing the
     * flag here would mean that a call arriving while it is off replaces a
     * preamp the user typed with a chain-derived one. Nothing in the UI does
     * that today — the control enables Auto normalize first — but this is an
     * IPC endpoint, and the manual value it would overwrite is not recoverable.
     */
    state.preAmp = getResolvedPreAmp(state);
    await handleUpdateHelper<number>(
      event,
      ChannelEnum.SET_SMART_HEADROOM,
      state.preAmp,
      false,
      true,
    );
  });

  ipcMain.on(ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT, async (event, arg) => {
    // Ignored unless the mode is on. A measurement arriving for a mode nobody
    // asked for would sit in state waiting to change the preamp the instant the
    // switch moved, which is not what moving that switch should mean.
    if (!state.isSmartHeadroomOn || !state.isAutoPreAmpOn) {
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
    state.smartHeadroomTrimDb = Number.isFinite(trim) ? Math.min(0, trim) : 0;
    state.preAmp = getResolvedPreAmp(state);
    await handleUpdateHelper<number>(
      event,
      ChannelEnum.SET_SMART_HEADROOM_MEASUREMENT,
      state.preAmp,
      false,
      true,
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
