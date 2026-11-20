/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef } from 'react';
import type { IDspSettings } from '../../../common/dsp/chain';
import { dspPresetVoicing } from '../../../common/dsp/presetVoicing';
import type { ErrorDescription } from '../../../common/errors';
import { useDspSettings } from '../../dsp/store';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { queueDraftCurve } from './draftCurveSend';
import { draftCurveOf } from './presetEditBands';
import { markPresetEditDirty, usePresetEditSession } from './presetEditSession';

/**
 * What makes a preset being edited audible, mounted once in the shell so it
 * lasts across the EQ page and the DSP page: every change to the draft curve
 * becomes the Preset layer — in the window at once, for every chip and line
 * that names it, and in the engine one write at a time — and any change to
 * the rack while the session lasts counts as something to keep. Renders
 * nothing.
 */
const PresetEditLive = () => {
  const session = usePresetEditSession();
  const { setVoicing, setGlobalError } = useFluidEqLayers();
  const dsp = useDspSettings();
  const presetId = session?.presetId;
  const base = session?.base;
  const bands = session?.bands;

  const curve = useMemo(
    () => (base && bands ? draftCurveOf(base, bands) : undefined),
    [base, bands],
  );

  useEffect(() => {
    if (presetId === undefined || !curve) {
      return;
    }
    const layer = dspPresetVoicing(presetId, curve);
    setVoicing(layer);
    queueDraftCurve({
      profileId: layer.profileId,
      curve,
      onError: (error) => setGlobalError(error as ErrorDescription),
    });
  }, [curve, presetId, setGlobalError, setVoicing]);

  // The rack the session started on, read on the render that began it: the
  // session puts its rack on in the same turn it opens (`usePresetEditActions`).
  const startRack = useRef<{ presetId: string; rack: IDspSettings }>(undefined);
  useEffect(() => {
    if (presetId === undefined) {
      startRack.current = undefined;
      return;
    }
    if (startRack.current?.presetId !== presetId) {
      startRack.current = { presetId, rack: dsp };
    } else if (startRack.current.rack !== dsp) {
      markPresetEditDirty();
    }
  }, [dsp, presetId]);

  return null;
};

export default PresetEditLive;
