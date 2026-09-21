/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { resolveDspPreset } from './dspPresetCatalog';
import {
  holdRackForApo,
  rackHeldForApo,
  releaseRackHold,
} from './rackHeldForApo';
import { applyDspSettings, persistDspSettings, readDspSettings } from './store';

/**
 * A preset is one choice on both engines: its curve plays on either, its
 * rack only where a rack can run for the whole machine.
 *
 * The curve is the Preset layer of the main EQ and crosses an engine switch
 * by itself. The rack does not: Equalizer APO has none, so there a preset
 * picked for the whole machine leaves it off (`useDspPresetSelection`).
 * Without this, a switch to the FluidEQ Engine brought the curve back
 * without the rest of the preset, and a switch to Equalizer APO left a rack
 * on that APO cannot play — which then ran on the Library player alone.
 *
 * Only at a switch, and only for the preset the Preset layer names: a rack
 * switched off by hand stays off, and one switched on by hand under
 * Equalizer APO — for the Library player — stays on. The hold is written
 * down so it outlives a restart between the two switches.
 *
 * Headless, beside the window's other always-on engines: a switch is made in
 * a dialog over any page.
 */
const RackFollowsEngine = () => {
  const { status } = useAudioEngineStatus();
  const { voicing } = useFluidEqContext();
  const engine = status?.engine ?? null;
  const previous = useRef(engine);

  useEffect(() => {
    const was = previous.current;
    previous.current = engine;
    if (was === null || engine === null || was === engine) {
      return;
    }
    const settings = readDspSettings();
    if (engine === 'apo') {
      const picked = settings.presetId;
      if (
        settings.enabled &&
        picked !== '' &&
        dspVoicingPresetId(voicing) === picked
      ) {
        holdRackForApo(picked);
        applyDspSettings({ ...settings, enabled: false, gameMode: false });
        persistDspSettings();
      }
      return;
    }
    const held = rackHeldForApo();
    releaseRackHold();
    if (
      engine === 'fluid' &&
      held !== undefined &&
      held === settings.presetId &&
      !settings.enabled
    ) {
      // The whole rack again, Game mode and all, rather than the switch alone:
      // the hold cleared what APO cannot use.
      const next = resolveDspPreset(held, settings);
      if (next) {
        applyDspSettings(next);
        persistDspSettings();
      }
    }
  }, [engine, voicing]);

  return null;
};

export default RackFollowsEngine;
