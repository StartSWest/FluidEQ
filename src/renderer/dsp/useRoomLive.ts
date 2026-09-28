/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the room is doing this second, for the card's chip.
 *
 * From whichever of the two places the rack runs in is carrying it
 * (`rackPlacement.ts`). The rest of the time that is the FluidEQ Engine, and
 * its own status for the output being listened to — the one Windows plays
 * through — carries the stream's channel count and the room's state (`off`,
 * `no-head`, `front-stage`, `music`, `5.1`, `7.1`, `on`). An output the
 * engine has not locked is nothing playing, which the chip says rather than
 * guessing what would happen.
 */

import { useSyncExternalStore } from 'react';
import type { IHostAnalysisRoom } from 'common/dsp/analysisWire';
import type { IDspSettings } from 'common/dsp/chain';
import type { TRoomState } from 'common/engineHealth';
import {
  useListenedOutput,
  type IListenedOutput,
} from '../utils/useListenedOutput';
import { playerRunsRack, useRackGate } from './rackPlacement';
import { readDspRoomReport, subscribeDspRoomReport } from './roomTelemetry';

export type TRoomLive = TRoomState | 'idle' | 'unknown';

export interface IRoomLive {
  state: TRoomLive;
  channels: number | undefined;
}

/** The room's chip, from the output being listened to. */
export const roomLiveOf = ({ known, output }: IListenedOutput): IRoomLive => {
  if (!known) {
    return { state: 'unknown', channels: undefined };
  }
  if (!output) {
    return { state: 'idle', channels: undefined };
  }
  return {
    state: output.room ?? 'unknown',
    channels: output.channels,
  };
};

export const useRoomLive = (isFluid: boolean): IRoomLive =>
  roomLiveOf(useListenedOutput(isFluid));

/**
 * The room's chip while the Library player carries the rack.
 *
 * The engine cannot say then: its copy of the rack stands aside while the
 * Library plays, so its status read "Room off" over a room that was playing,
 * and under Equalizer APO there is no engine status at all. The player's own
 * chain reports each block whether its room rendered (`active`), and the
 * player is always two channels on the front pair (`apply_room_head` in the
 * host), so the rest is named as the engine names a stereo stream
 * (`dsp_chain.cpp`): the music upmix makes it `music`, otherwise it is the
 * front stage, and a room switched on that renders nothing had no head to
 * render through.
 */
export const roomLiveOfPlayer = (
  report: Readonly<IHostAnalysisRoom> | undefined,
  settings: Pick<IDspSettings, 'enabled' | 'room'>,
): IRoomLive => {
  if (!settings.enabled || !settings.room.enabled) {
    return { state: 'off', channels: 2 };
  }
  if (!report) {
    return { state: 'unknown', channels: undefined };
  }
  if (!report.active) {
    return { state: 'no-head', channels: 2 };
  }
  return {
    state: settings.room.musicUpmix ? 'music' : 'front-stage',
    channels: 2,
  };
};

/**
 * The DSP page's chip: the player's report while the Library carries the
 * rack, the engine's status the rest of the time. The page alone: the 7.1
 * offer (`RoomOutputNotice`) is about the output's format, which only the
 * engine's streams are shaped by — the player is stereo whatever the output
 * takes.
 */
export const useDspPageRoomLive = (
  listened: IListenedOutput,
  settings: Pick<IDspSettings, 'enabled' | 'room'>,
): IRoomLive => {
  const gate = useRackGate();
  const report = useSyncExternalStore(
    subscribeDspRoomReport,
    readDspRoomReport,
    readDspRoomReport,
  );
  return gate.libraryAudible && playerRunsRack(gate)
    ? roomLiveOfPlayer(report, settings)
    : roomLiveOf(listened);
};
