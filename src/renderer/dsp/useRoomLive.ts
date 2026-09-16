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

import { useEffect, useState } from 'react';
import {
  NO_ENGINE_HEALTH,
  type IEngineHealth,
  type TRoomState,
} from 'common/engineHealth';
import { normaliseEndpointGuid } from 'common/engineHealth';
import { getAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';

export type TRoomLive = TRoomState | 'idle' | 'unknown';

const bridge = () => window.electron?.ipcRenderer;

export interface IRoomLive {
  state: TRoomLive;
  channels: number | undefined;
}

export const useRoomLive = (isFluid: boolean): IRoomLive => {
  const [health, setHealth] = useState<IEngineHealth>(NO_ENGINE_HEALTH);
  const [defaultGuid, setDefaultGuid] = useState<string | undefined>();

  useEffect(() => {
    if (!isFluid) {
      return undefined;
    }
    let isLive = true;
    const api = bridge();
    const stop = api?.onEngineHealth?.(setHealth) ?? (() => undefined);
    api
      ?.getEngineHealth?.()
      .then((first) => {
        if (isLive && first) {
          setHealth(first);
        }
        return undefined;
      })
      .catch((error) =>
        reportError(
          "The engine's health could not be read for the room",
          error,
        ),
      );
    const readDefault = () => {
      getAudioDevices()
        .then((devices) => {
          if (isLive) {
            setDefaultGuid(devices.find((device) => device.isDefault)?.guid);
          }
          return undefined;
        })
        .catch((error) =>
          reportError('The output list could not be read for the room', error),
        );
    };
    readDefault();
    window.addEventListener('fluideq-output-changed', readDefault);
    return () => {
      isLive = false;
      stop();
      window.removeEventListener('fluideq-output-changed', readDefault);
    };
  }, [isFluid]);

  if (!isFluid) {
    return { state: 'unknown', channels: undefined };
  }
  const output = health.outputs.find(
    (candidate) =>
      candidate.locked &&
      (defaultGuid === undefined ||
        candidate.endpoint === normaliseEndpointGuid(defaultGuid)),
  );
  if (!output) {
    return { state: 'idle', channels: undefined };
  }
  return {
    state: output.room ?? 'unknown',
    channels: output.channels,
  };
};
