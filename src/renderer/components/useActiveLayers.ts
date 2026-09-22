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

import { useEffect, useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { AutoEqFormat, OPRA_SOURCE_ID, TApoLayer } from 'common/constants';
import { getVoicingProfile } from 'common/voicing';
import { getDriverProfile } from 'common/driver';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import {
  getOpraLabel,
  setDriver as setDriverApi,
  setHeadphone as setHeadphoneApi,
  setLayerBypass,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
import { useSmartEqMode } from '../utils/smartEqMode';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import { presetLayerName } from '../dsp/dspPresetCatalog';
import { collectLayers } from './activeLayerList';
import type { IActiveLayer } from './activeLayerList';

/** How long a strength drag settles before it is written. */
const STRENGTH_WRITE_DEBOUNCE_MS = 250;

/**
 * What is shaping the sound besides the bands on screen, and the three
 * things a chip does to one: switch it off and on, set its strength, take
 * it away.
 *
 * The EQ page's row (`ActiveLayers`) and the mini player's screen read the
 * same list from here, so the two cannot disagree about what is applied or
 * about what switching one off means.
 */
const useActiveLayers = () => {
  const strengthTimers = useRef<Record<string, number>>({});
  const {
    filters,
    eqBandDesign,
    eqFormat,
    graphicEq,
    convolution,
    voicing,
    driver,
    headphone,
    setHeadphone,
    smartEq,
    customFx,
    headset,
    headsetSource,
    bypassed,
    refreshState,
    setConvolution,
    setVoicing,
    setDriver,
    setSmartEq,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();
  /*
   * The model's name, asked for by id.
   *
   * The chip used to print `headset` straight out, which is an OPRA id —
   * `razer::kraken_v3_pro` on a chip in the middle of the window. The index that
   * turns it into "Razer Kraken V3 Pro" is two megabytes and lives in the main
   * process, so this asks for the one string rather than the library. Falls back
   * to the id, which is what a selection from the retired AutoEq database still
   * resolves to.
   */
  const [headsetName, setHeadsetName] = useState<string>();
  useEffect(() => {
    if (!headset || headsetSource !== OPRA_SOURCE_ID) {
      setHeadsetName(undefined);
      return undefined;
    }
    let isCurrent = true;
    getOpraLabel(headset)
      .then((name) => {
        if (isCurrent) {
          setHeadsetName(name || undefined);
        }
        return name;
      })
      .catch(() => setHeadsetName(undefined));
    return () => {
      isCurrent = false;
    };
  }, [headset, headsetSource]);
  const isContinuousOn = useContinuousEq();
  const smartEqMode = useSmartEqMode();
  /** Which of the four wrote this layer, in the words the picker uses. */
  const modeName = {
    smart: t('eq.smart'),
    detail: t('eq.smart.mode.detail'),
    balance: t('eq.smart.mode.balance'),
    target: t('eq.smart.mode.target'),
  }[smartEqMode];

  const isBypassed = (layer: TApoLayer) => bypassed.includes(layer);

  const bandCount = Object.keys(filters).length;
  // Flat means no layer, however many bands are sitting there at zero.
  const hasShapedBands =
    eqFormat === AutoEqFormat.GRAPHIC
      ? graphicEq?.some((point) => point.gain !== 0)
      : Object.values(filters).some((filter) => filter.gain !== 0);
  /*
   * The "(modified)" mark is gone with the attribution it qualified.
   *
   * It compared a recorded signature of the applied reference against the
   * shape of the bands, which was exactly right while a reference WAS the
   * bands. Since the correction became a layer, that signature described the
   * layer's filters — so the comparison was between two different things and
   * could only ever come out unequal. The chip said modified the moment a
   * reference was applied and never stopped.
   *
   * There is nothing to replace it with here, either: a band the user moved is
   * a band, and this chip now says how many there are. The signature itself
   * went on being recorded and saved into every profile for a year after
   * nothing read it, and was taken out on 2026-09-20.
   */

  /**
   * Strength, applied at once and written a moment later.
   *
   * The same debounce the two owning tabs use on their own sliders, and for the
   * same reason: dragging across the track fires a change per step, and each one
   * is a config rewrite that Equalizer APO then reloads. The state moves
   * immediately so the chip and the graph follow the thumb, and only the last
   * value reaches disk.
   *
   * ONE TIMER PER LAYER, keyed, and not one timer shared between them.
   *
   * Sharing looked harmless — nobody drags two sliders at once — and is not:
   * the point of a debounce is that the write happens *after* you stop moving,
   * so a pending write outlives the drag that scheduled it. Reach for the second
   * slider inside that window and the shared timer is cleared, the first layer's
   * write never happens, and it sits showing a value that was never written. The
   * next state refresh pulls the old one back and the slider appears to move on
   * its own, on a chip nobody touched.
   */
  const setLayerStrength = (
    key: string,
    apply: (intensity: number) => void,
    write: (intensity: number) => Promise<void>,
    intensity: number,
  ) => {
    apply(intensity);
    const pending = strengthTimers.current[key];
    if (pending !== undefined) {
      window.clearTimeout(pending);
    }
    strengthTimers.current[key] = window.setTimeout(() => {
      delete strengthTimers.current[key];
      write(intensity).catch((e) => setGlobalError(e as ErrorDescription));
    }, STRENGTH_WRITE_DEBOUNCE_MS);
  };

  const setVoicingStrength = (intensity: number) =>
    setLayerStrength(
      'voicing',
      (value) =>
        setVoicing({
          ...(voicing ?? { profileId: '' }),
          intensity: value,
        }),
      (value) => setVoicingApi(voicing?.profileId ?? '', value),
      intensity,
    );

  const setHeadphoneStrength = (intensity: number) =>
    setLayerStrength(
      'headphone',
      (value) =>
        setHeadphone(
          headphone ? { ...headphone, intensity: value } : undefined,
        ),
      (value) => setHeadphoneApi(value),
      intensity,
    );

  const setDriverStrength = (intensity: number) =>
    setLayerStrength(
      'driver',
      (value) =>
        setDriver({
          ...(driver ?? { profileId: '' }),
          intensity: value,
        }),
      (value) => setDriverApi(driver?.profileId ?? '', value),
      intensity,
    );

  const voicingProfile = getVoicingProfile(voicing?.profileId ?? '');
  // A preset's tone plays as a voicing named `dsp:<preset>`; its chip wears
  // the preset's own name and glyph, as the picker that put it there does.
  const presetName = presetLayerName(voicing, t);
  const voicingGlyph = dspVoicingPresetId(voicing) ?? voicing?.profileId;
  const driverProfile = getDriverProfile(driver?.profileId ?? '');

  const layers = collectLayers({
    t,
    refreshState,
    isBypassed,
    convolution,
    setConvolution,
    driver,
    driverProfile,
    setDriver,
    setDriverStrength,
    headphone,
    headset,
    headsetName,
    setHeadphone,
    setHeadphoneStrength,
    hasShapedBands: hasShapedBands === true,
    eqBandDesign,
    bandCount,
    voicing,
    voicingProfile,
    presetName,
    setVoicing,
    setVoicingStrength,
    smartEq,
    setSmartEq,
    modeName,
    setLayerStrength,
    isContinuousOn,
    customFx,
  });

  /*
   * SWITCHING ON FROM ZERO GOES TO FULL, so the switch is a switch.
   *
   * Zero strength and bypassed are one state now, which means a
   * layer can be arrived at from either control — and un-bypassing
   * one that was dragged to zero used to put it back at zero. The
   * chip lit up, the file was written, and not one decibel of it was
   * applied: a control that says "on" and does nothing, which is
   * worse than one that refuses.
   *
   * Only from zero. A layer left at 40% comes back at 40%, because
   * that is a strength somebody chose and the switch is not the
   * place to lose it.
   */
  const toggle = (layer: IActiveLayer) => {
    const { feature } = layer;
    if (!feature) {
      return;
    }
    const turningOn = isBypassed(feature);
    if (turningOn && layer.onStrength && (layer.strength ?? 0) <= 0) {
      layer.onStrength(1);
    }
    setLayerBypass(feature, !turningOn)
      .then(() => refreshState())
      .catch((e) => setGlobalError(e as ErrorDescription));
  };

  /*
   * ZERO IS THE SAME AS SWITCHED OFF, so the chip says so.
   *
   * They were already the same in the sound — a layer at zero
   * strength writes no filters, exactly like a bypassed one — and
   * having two controls that reach one outcome by different routes
   * meant the chip could sit at 0% looking applied, or bypassed at
   * 100% looking loud. Neither described what was coming out.
   *
   * So the two are kept in step from here: arriving at zero
   * bypasses, and moving off zero un-bypasses. The switch still
   * works on its own — it is the fast way, and it leaves the
   * strength where it was for when it comes back.
   */
  const setStrength = (layer: IActiveLayer, next: number) => {
    layer.onStrength?.(next);
    if (layer.feature) {
      const shouldBypass = next <= 0;
      if (shouldBypass !== isBypassed(layer.feature)) {
        setLayerBypass(layer.feature, shouldBypass).catch((e) =>
          setGlobalError(e as ErrorDescription),
        );
      }
    }
  };

  return { layers, isBypassed, voicingGlyph, toggle, setStrength };
};

export type TActiveLayers = ReturnType<typeof useActiveLayers>;

export default useActiveLayers;
