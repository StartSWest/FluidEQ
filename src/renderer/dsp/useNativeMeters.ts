/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { ANALYSIS_BINS } from '../../common/dsp/analysisWire';
import { useOutputEditor } from '../utils/outputEditor';
import { INativeMetersBridge, createNativeMeters } from './nativeMeters';
import { engineOwnsRack, rackSuspension, useRackGate } from './rackPlacement';
import { useDspNativeState, useDspSettings } from './store';
import useSystemMeters from './useSystemMeters';

/** The DSP bridge the window's preload exposes, when it does. */
const meterBridge = (): INativeMetersBridge | undefined => {
  const found = (
    window as unknown as {
      electron?: { ipcRenderer?: Record<string, unknown> };
    }
  ).electron?.ipcRenderer;
  return typeof found?.onDspHostAnalysis === 'function'
    ? (found as unknown as INativeMetersBridge)
    : undefined;
};

/**
 * Point the panel's graphs at the native engine while it is the audible one.
 *
 * Keyed on the controller, so it lives exactly as long as the engine it
 * reports on: the analysers are registered when the host engages and cleared
 * when it lets go. Any other lifetime leaves the panel drawing a frozen frame
 * from an engine that has stopped, which is the same defect this fixes.
 */
const useNativeMeters = (): void => {
  const nativeState = useDspNativeState();
  const gate = useRackGate();
  const settings = useDspSettings();
  const { editor, main } = useOutputEditor();
  const editingOtherOutput = !!editor && !!main && editor.device.id !== main.id;
  const systemOwnsMeters =
    gate.engine === 'fluid' && (editingOtherOutput || engineOwnsRack(gate));
  useSystemMeters(
    systemOwnsMeters &&
      settings.enabled &&
      gate.eqEnabled &&
      (editingOtherOutput || rackSuspension(gate) === undefined),
  );
  useEffect(() => {
    if (nativeState !== 'engaged' || systemOwnsMeters || editingOtherOutput) {
      return undefined;
    }
    const bridge = meterBridge();
    if (!bridge) {
      return undefined;
    }
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    return () => meters.release();
  }, [nativeState, systemOwnsMeters, editingOtherOutput]);
};

export default useNativeMeters;
