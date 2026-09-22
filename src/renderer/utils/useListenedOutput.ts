/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the FluidEQ Engine says about the output being listened to — the one
 * Windows plays through.
 *
 * From the engine's own status for that output (`engineHealth.ts`), which it
 * writes when it locks the output, on every change, and when it lets go. The
 * DSP page reads the room's state and the delay from it, the EQ page the
 * delay.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
  type IEngineLatency,
  type IEngineOutputHealth,
} from 'common/engineHealth';
import { getAudioDevices } from './equalizerApi';
import { reportError } from './logger';
import {
  IPlayerProcessingLatency,
  usePlayerProcessingLatency,
} from '../dsp/processingLatency';
import { useRackGate } from '../dsp/rackPlacement';

const bridge = () => window.electron?.ipcRenderer;

/**
 * The engine's status for the output being listened to, or nothing: under
 * Equalizer APO (`known` false), or when the engine has not locked that
 * output, which is nothing playing on it.
 *
 * One reading per page: the room's chip and the delay readout describe the
 * same output, and two subscriptions could each land on a different moment
 * of it.
 */
export interface IListenedOutput {
  known: boolean;
  output: IEngineOutputHealth | undefined;
}

export const useListenedOutput = (isFluid: boolean): IListenedOutput => {
  // Replies from a previous engine activation must never describe this one.
  const session = useMemo(() => ({ isFluid }), [isFluid]);
  const [snapshot, setSnapshot] = useState<{
    session: object;
    health?: IEngineHealth;
    defaultGuid?: string;
  }>({ session });

  useEffect(() => {
    if (!isFluid) {
      return undefined;
    }
    let isLive = true;
    let healthRevision = 0;
    let deviceRequest = 0;
    setSnapshot({ session });
    const api = bridge();
    const acceptHealth = (health: IEngineHealth) => {
      if (isLive) {
        healthRevision += 1;
        setSnapshot((previous) => ({ ...previous, session, health }));
      }
    };
    const stop = api?.onEngineHealth?.(acceptHealth) ?? (() => undefined);
    const requestedRevision = healthRevision;
    api
      ?.getEngineHealth?.()
      .then((first) => {
        // A push can arrive before this request's older answer.
        if (isLive && first && healthRevision === requestedRevision) {
          acceptHealth(first);
        }
        return undefined;
      })
      .catch((error) =>
        reportError(
          "The engine's health could not be read for the output being listened to",
          error,
        ),
      );
    const readDefault = () => {
      deviceRequest += 1;
      const request = deviceRequest;
      // Never keep the former output's delay while its replacement is read.
      setSnapshot((previous) => ({
        ...previous,
        session,
        defaultGuid: undefined,
      }));
      getAudioDevices()
        .then((devices) => {
          if (isLive && request === deviceRequest) {
            const guid = devices.find((device) => device.isDefault)?.guid;
            setSnapshot((previous) => ({
              ...previous,
              session,
              defaultGuid: guid?.trim()
                ? normaliseEndpointGuid(guid)
                : undefined,
            }));
          }
          return undefined;
        })
        .catch((error) =>
          reportError(
            'The output list could not be read for the output being listened to',
            error,
          ),
        );
    };
    readDefault();
    window.addEventListener('fluideq-output-changed', readDefault);
    return () => {
      isLive = false;
      stop();
      window.removeEventListener('fluideq-output-changed', readDefault);
    };
  }, [isFluid, session]);

  if (
    !isFluid ||
    snapshot.session !== session ||
    !snapshot.health ||
    !snapshot.defaultGuid
  ) {
    return { known: false, output: undefined };
  }
  return {
    known: true,
    output: snapshot.health.outputs.find(
      (candidate) =>
        candidate.locked && candidate.endpoint === snapshot.defaultGuid,
    ),
  };
};

export interface IListenedDelay {
  endpoint: string;
  latency: IEngineLatency;
  gameMode: boolean;
  bypassed: boolean;
}

/**
 * Reported processing buffers, never an end-to-end measurement. A locked,
 * bypassed engine has no processing badge; absent or idle telemetry is unknown.
 */
export const listenedDelay = ({
  known,
  output,
}: IListenedOutput): IListenedDelay | undefined => {
  if (
    !known ||
    !output?.locked ||
    !output.processing ||
    output.carried === false ||
    !output.latency
  ) {
    return undefined;
  }
  return {
    endpoint: output.endpoint,
    latency: output.latency,
    gameMode: output.gameMode === true,
    bypassed: false,
  };
};

const RACK_STAGES = new Set([
  'leveler',
  'restoration',
  'exciter',
  'bassForge',
  'linearEq',
  'bassPunch',
  'room',
  'dimension',
  'compressor',
  'maximizer',
  'headroom',
  'master',
]);

/** During a rack handoff, wait for both engines to agree about where it runs. */
export const combineListenedDelay = (
  output: IListenedOutput,
  libraryAudible: boolean,
  player: IPlayerProcessingLatency | undefined,
): IListenedDelay | undefined => {
  const delay = listenedDelay(output);
  if (!delay || !libraryAudible) {
    return delay;
  }
  if (
    !player ||
    normaliseEndpointGuid(player.endpoint) !== delay.endpoint ||
    player.latency.rate !== delay.latency.rate
  ) {
    return undefined;
  }
  if (delay.latency.parts.some((part) => RACK_STAGES.has(part.stage))) {
    return undefined;
  }
  return {
    ...delay,
    latency: {
      rate: delay.latency.rate,
      frames: delay.latency.frames + player.latency.frames,
      parts: [...player.latency.parts, ...delay.latency.parts],
    },
  };
};

export const useListenedDelay = (output: IListenedOutput) => {
  const gate = useRackGate();
  const player = usePlayerProcessingLatency();
  return combineListenedDelay(output, gate.libraryAudible, player);
};
