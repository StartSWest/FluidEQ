/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import LatencyReadout from './LatencyReadout';
import GameModeSwitch from './GameModeSwitch';
import { useFluidEqShell } from '../utils/FluidEqContext';
import '../styles/EngineStrip.scss';

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
  // What the window already knows: this mounts with the EQ page, and asking
  // main on every mount ran the engine helper again for `AppContent`'s answer.
  const status = useKnownAudioEngineStatus();
  const { isEnabled } = useFluidEqShell();
  const isFluid = status?.engine === 'fluid';
  const listened = useListenedOutput(isFluid && isEnabled);
  const delay = useListenedDelay(listened);
  return isFluid ? (
    // One capsule, because the switch is what moves the figure beside it —
    // see `EngineStrip.scss` for what the two looked like standing apart.
    <div className="engine-strip">
      <GameModeSwitch
        installedVersion={status?.fluid.dllVersion}
        reportedGameMode={listened.output?.gameMode}
      />
      {isEnabled && delay ? (
        <LatencyReadout latency={delay.latency} gameMode={delay.gameMode} />
      ) : null}
    </div>
  ) : null;
};

export default ListenedLatency;
