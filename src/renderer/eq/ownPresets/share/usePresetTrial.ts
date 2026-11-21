/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef, useState } from 'react';
import type { IDspSettings } from '../../../../common/dsp/chain';
import type { IPortableDspChain } from '../../../../common/dsp/dspChainPresetFile';
import {
  DSP_VOICING_PREFIX,
  dspVoicingCurve,
  dspVoicingPresetId,
} from '../../../../common/dsp/presetVoicing';
import type { IVoicingSettings } from '../../../../common/constants';
import type { ErrorDescription } from '../../../../common/errors';
import { resolveDspPresetCurve } from '../../../dsp/dspPresetCatalog';
import { applyDspSettings, readDspSettings } from '../../../dsp/store';
import { useFluidEqLayers } from '../../../utils/FluidEqContext';
import { setVoicing as setVoicingApi } from '../../../utils/equalizerApi';

/** The Preset layer's name while a shared preset is only being tried. */
const TRIAL_LAYER = `${DSP_VOICING_PREFIX}shared-trial`;

interface IBefore {
  settings: IDspSettings;
  voicing: IVoicingSettings | undefined;
}

/**
 * Whether what plays now can be put back exactly: no layer, a preset's
 * curve, or a named profile. A layer somebody edited in Equalizer APO's own
 * file has no name to send back, and trying a preset over it would lose it.
 */
const canPutBack = (voicing: IVoicingSettings | undefined): boolean =>
  !voicing?.apoOverride || dspVoicingPresetId(voicing) !== undefined;

/**
 * "Try it" on a shared preset: its rack and curve play while the post is on
 * screen, and what was playing comes back when the listener stops, leaves
 * the post, or keeps it with Add instead.
 *
 * The rack is applied and never persisted, so a restart in the middle comes
 * back on the rack the listener chose. The curve goes in as the Preset layer
 * under a name of its own, and the layer that was there is sent back the way
 * a pick sends it: the curve of the preset it names, or the profile.
 */
const usePresetTrial = () => {
  const { voicing, setVoicing, setGlobalError } = useFluidEqLayers();
  const before = useRef<IBefore | undefined>(undefined);
  const [isTrying, setTrying] = useState(false);

  const putBack = async (saved: IBefore) => {
    applyDspSettings(saved.settings);
    const layer = saved.voicing;
    const presetId = dspVoicingPresetId(layer);
    if (layer && presetId !== undefined) {
      const curve = resolveDspPresetCurve(presetId) ?? dspVoicingCurve(layer);
      if (curve) {
        await setVoicingApi(layer.profileId, 1, curve);
        setVoicing(layer);
        return;
      }
    }
    if (layer?.profileId) {
      await setVoicingApi(layer.profileId, layer.intensity);
      setVoicing(layer);
      return;
    }
    await setVoicingApi('', 1);
    setVoicing({ profileId: '', intensity: 1 });
  };

  const stop = () => {
    const saved = before.current;
    before.current = undefined;
    setTrying(false);
    if (saved) {
      putBack(saved).catch((error: unknown) =>
        setGlobalError(error as ErrorDescription),
      );
    }
  };

  const start = async (preset: IPortableDspChain) => {
    if (!before.current) {
      before.current = { settings: readDspSettings(), voicing };
    }
    setTrying(true);
    try {
      if (preset.curve) {
        await setVoicingApi(TRIAL_LAYER, 1, preset.curve);
      } else {
        await setVoicingApi('', 1);
      }
      applyDspSettings({ ...preset.settings, presetId: '' });
    } catch (error) {
      setGlobalError(error as ErrorDescription);
      stop();
    }
  };

  // Leaving the post ends the trial: what was playing comes back.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => stopRef.current(), []);

  return {
    isTrying,
    canTry: canPutBack(voicing),
    start,
    stop,
    /** Kept with Add: nothing to put back, the kept preset plays now. */
    forget: () => {
      before.current = undefined;
      setTrying(false);
    },
  };
};

export default usePresetTrial;
