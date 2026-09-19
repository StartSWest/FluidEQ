/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import LatencyReadout from './LatencyReadout';
import GameModeSwitch from './GameModeSwitch';
import { useFluidEqContext } from '../utils/FluidEqContext';

/**
 * The delay of the output being listened to, for a page that reads nothing
 * else from the engine — the EQ page, beside its heading.
 *
 * Nothing under Equalizer APO, which measures nothing, and nothing while the
 * FluidEQ Engine is not processing that output (see `listenedDelay`). The DSP
 * page reads the same output for its room chip and passes the delay down
 * instead, rather than opening a second reading of it.
 */
const ListenedLatency = () => {
  const { status } = useAudioEngineStatus();
  const { isEnabled } = useFluidEqContext();
  const isFluid = status?.engine === 'fluid';
  const listened = useListenedOutput(isFluid && isEnabled);
  const delay = useListenedDelay(listened);
  return isFluid ? (
    <>
      <GameModeSwitch
        installedVersion={status?.fluid.dllVersion}
        reportedGameMode={listened.output?.gameMode}
      />
      {isEnabled && delay ? (
        <LatencyReadout latency={delay.latency} gameMode={delay.gameMode} />
      ) : null}
    </>
  ) : null;
};

export default ListenedLatency;
