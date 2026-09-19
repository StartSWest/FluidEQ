/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the room is doing this second, for the card's chip.
 *
 * From the engine's own status for the output being listened to — the one
 * Windows plays through — which carries the stream's channel count and the
 * room's state (`off`, `no-head`, `front-stage`, `5.1`, `7.1`, `on`). An
 * output the engine has not locked is nothing playing, which the chip says
 * rather than guessing what would happen.
 */

import type { TRoomState } from 'common/engineHealth';
import {
  useListenedOutput,
  type IListenedOutput,
} from '../utils/useListenedOutput';

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
