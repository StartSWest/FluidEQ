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

import { useEffect, useRef } from 'react';
import { isMeasurementView } from 'common/smartEqMeasurement';
import {
  type ISmartEqCoreSettings,
  type ISmartEqWrote,
  SMART_EQ_CHANNEL,
  isSmartEqRunState,
  isSmartEqWrote,
} from 'common/smartEqCore';
import { useFluidEqContext } from './utils/FluidEqContext';
import { showSmartEqMeasurement } from './audio/smartEqMeasurement';
import { useContinuousEq } from './utils/continuousEq';
import { useCorrectionLimit } from './utils/correctionLimit';
import { usePresenceLines } from './utils/presenceThreshold';
import { isContinuousMode, useSmartEqMode } from './utils/smartEqMode';
import {
  registerSmartEqControl,
  setSmartEqListening,
  setSmartEqRunning,
  setSmartEqStatus,
} from './utils/smartEqRun';
import { flashCorrection } from './utils/correctionFlash';
import { planBandReveal, revealBands } from './utils/bandReveal';

/** Optional, like every bridge call: a test's partial bridge has none. */
const send = (channel: string, args: unknown[]) =>
  window.electron?.ipcRenderer?.sendMessage?.(channel, args);

/**
 * Smart EQ as the window sees it. Renders nothing.
 *
 * Every measurement runs in the app's core (`main/smartEq/smartEqRunner.ts`),
 * where no window can end one: a running mode meant to run all evening used
 * to stop whenever this window reloaded, and could not run without it. This
 * is mounted once, above the workspace tabs, and does the window's half —
 * hands the core the settings it measures by, sends the button
 * (`utils/smartEqRun`), and draws what the core says: the status bubble, the
 * graph's presence marks, and each layer it writes — a one-shot's answer
 * climbing onto the graph a band at a time, a running mode's refinement
 * lighting the ranges it moved, and a song's remembered layer as it is.
 */
const SmartEqEngine = () => {
  const { setSmartEq, getBandSetGeneration } = useFluidEqContext();
  const smartEqMode = useSmartEqMode();
  const isContinuousOn = useContinuousEq();
  const limitDb = useCorrectionLimit();
  const presenceOffsets = usePresenceLines();

  // The settings first, so a mode chosen below is measured by its own.
  useEffect(() => {
    const settings: ISmartEqCoreSettings = {
      mode: smartEqMode,
      continuous: isContinuousOn,
      limitDb,
      presenceOffsets,
    };
    send(SMART_EQ_CHANNEL.settings, [settings]);
  }, [smartEqMode, isContinuousOn, limitDb, presenceOffsets]);

  /**
   * The one-shot runs the moment it is chosen, like the other three do. A
   * continuous mode needs nothing here: choosing it switches the running
   * mode on (`setSmartEqMode`), and the core aims its next settled solve at
   * the new destination without clearing anything.
   */
  const previousModeRef = useRef(smartEqMode);
  useEffect(() => {
    if (previousModeRef.current === smartEqMode) {
      return;
    }
    previousModeRef.current = smartEqMode;
    if (!isContinuousMode(smartEqMode)) {
      send(SMART_EQ_CHANNEL.run, []);
    }
  }, [smartEqMode]);

  /**
   * The context's setter and the band set's generation, on a ref: the
   * listeners below are held for as long as the window lives, and a reveal
   * that outlives a render must draw into the current context.
   */
  const contextRef = useRef({ setSmartEq, getBandSetGeneration });
  contextRef.current = { setSmartEq, getBandSetGeneration };

  useEffect(() => {
    registerSmartEqControl({
      run: () => send(SMART_EQ_CHANNEL.run, []),
      cancel: () => send(SMART_EQ_CHANNEL.cancel, []),
    });
    const api = window.electron?.ipcRenderer;
    /** Bumped by every write, so a reveal still climbing gives way. */
    let lastWrite = 0;
    const showWrote = async ({ kind, layer, from, moved }: ISmartEqWrote) => {
      lastWrite += 1;
      const write = lastWrite;
      const context = contextRef.current;
      if (kind === 'refined') {
        context.setSmartEq(layer);
        flashCorrection(moved);
        return;
      }
      if (kind === 'remembered') {
        // A song's remembered layer, or the one it was lent over: drawn as
        // it is, because nothing was measured to be watched arriving.
        context.setSmartEq(layer);
        return;
      }
      // The same reveal the AutoEQ panel uses, pointed at the layer: its
      // curve climbs onto the graph a band at a time rather than appearing
      // whole, from where the layer was, because what is worth watching is
      // where it moved. What is heard changed once, when the core wrote it;
      // this is only how the result is drawn.
      const plan = layer
        ? planBandReveal(layer.filters, { from: from?.filters })
        : undefined;
      if (!plan || !layer) {
        context.setSmartEq(layer);
        return;
      }
      const generation = context.getBandSetGeneration();
      const isCurrent = () =>
        write === lastWrite &&
        contextRef.current.getBandSetGeneration() === generation;
      context.setSmartEq({ ...layer, filters: plan.initial });
      const revealed = { ...plan.initial };
      await revealBands(
        plan.steps,
        (arriving) => {
          arriving.forEach(({ id, gain }) => {
            revealed[id] = { ...revealed[id], gain };
          });
          contextRef.current.setSmartEq({ ...layer, filters: { ...revealed } });
        },
        { isCurrent },
      );
      if (isCurrent()) {
        contextRef.current.setSmartEq(layer);
      }
    };
    const stops = [
      api?.on?.(SMART_EQ_CHANNEL.state, (payload) => {
        if (isSmartEqRunState(payload)) {
          setSmartEqRunning(payload.isRunning);
          setSmartEqListening(payload.listeningFor);
        }
      }),
      api?.on?.(SMART_EQ_CHANNEL.remark, (payload) => {
        if (typeof payload === 'string') {
          setSmartEqStatus(payload);
        }
      }),
      api?.on?.(SMART_EQ_CHANNEL.view, (payload) => {
        if (isMeasurementView(payload)) {
          showSmartEqMeasurement(payload);
        }
      }),
      api?.on?.(SMART_EQ_CHANNEL.wrote, (payload) => {
        if (isSmartEqWrote(payload)) {
          showWrote(payload).catch(() => undefined);
        }
      }),
    ];
    // Asked once, then told: a window that reloads mid-measurement shows it.
    send(SMART_EQ_CHANNEL.ask, []);
    return () => {
      // Whatever is still climbing stops drawing into a window going away.
      lastWrite += 1;
      registerSmartEqControl(undefined);
      stops.forEach((stop) => stop?.());
    };
  }, []);

  return null;
};

export default SmartEqEngine;
