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

import { TApoLayer } from 'common/constants';
import type { Translate } from 'common/i18n';
import { isVoicingActive } from 'common/voicing';
import type { IVoicingProfile } from 'common/voicing';
import type { IDriverProfile } from 'common/driver';
import { hasSmartEqCorrection } from 'common/smartEq';
import { hasHeadphoneCorrection } from '../../common/headphone';
import type { IFluidEqContext } from '../utils/FluidEqContext';
import { setContinuousEq } from '../utils/continuousEq';
import {
  clearConvolution,
  clearGains,
  setDriver as setDriverApi,
  setHeadphone as setHeadphoneApi,
  setSmartEq as setSmartEqApi,
  setTone as setToneApi,
  setVoicing as setVoicingApi,
  writeApoConfigFile,
} from '../utils/equalizerApi';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import { hasTone } from '../../common/tone';
import switchPresetRackOff from '../dsp/presetRackOff';
import type { MenuIconName } from '../icons/MenuIcon';
import { TONE_CONTROLS } from '../eq/useTone';

/** A dial's value as its chip names it: signed, to the tenth it steps by. */
const signedDb = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/** One thing shaping the sound besides the bands on screen. */
export interface IActiveLayer {
  key: string;
  icon?: MenuIconName;
  isVoicing?: boolean;
  label: string;
  name: string;
  onClear: () => Promise<void>;
  /** Overrides the generic "remove this layer" wording. */
  clearHint?: string;
  /**
   * Whether this layer is being maintained right now rather than sitting
   * where a measurement left it.
   *
   * Only Smart EQ can be, and only under Continuous EQ. Worth saying on the
   * chip because the difference is invisible otherwise: the curve moves half
   * a decibel at a time, which is the point of it and also why nobody would
   * notice it was moving.
   */
  isLive?: boolean;
  /**
   * How strongly this layer is applied, when that is a thing it has.
   *
   * Only the voicing, and it is here rather than only on its own tab because
   * strength is the setting people actually reach for. Which voicing is a
   * decision made once; how much of it is a dial you turn while listening, and
   * turning it meant leaving the EQ and coming back.
   */
  strength?: number;
  /** Where a drag on that slider goes. */
  onStrength?: (intensity: number) => void;
  /**
   * The strength as a number, drawn in a fixed-width cell of its own.
   *
   * Separate from `name` so it can be given reserved space. Appended to the
   * name it made the chip a different width at 5% than at 100%, so dragging
   * the slider shoved every chip to its right back and forth under the cursor.
   */
  percent?: number;
  /**
   * Chosen, but contributing nothing — a voicing turned down to zero.
   *
   * Drawn like a bypassed layer, because that is what it is from the sound's
   * point of view. Kept separate from bypass itself because the switch is
   * still on: pressing the body toggles the include, and the way back from
   * this state is the slider, not the switch.
   */
  isInactive?: boolean;
  /**
   * Which file in the Equalizer APO config this chip stands for, and so what
   * its A/B switch takes out of the chain.
   *
   * Every layer written as filters has one. The convolution does not: it is a
   * `Convolution:` line in the device file rather than an include of its own,
   * so there is nothing here to leave out.
   */
  feature?: TApoLayer;
}

/** What the list is built from: the state it names, and how to change it. */
export type TLayerListInputs = Pick<
  IFluidEqContext,
  | 'convolution'
  | 'setConvolution'
  | 'driver'
  | 'setDriver'
  | 'headphone'
  | 'headset'
  | 'setHeadphone'
  | 'eqBandDesign'
  | 'voicing'
  | 'setVoicing'
  | 'smartEq'
  | 'setSmartEq'
  | 'tone'
  | 'setTone'
  | 'customFx'
  | 'refreshState'
> & {
  t: Translate;
  isBypassed: (layer: TApoLayer) => boolean;
  driverProfile: IDriverProfile | undefined;
  setDriverStrength: (intensity: number) => void;
  headsetName: string | undefined;
  setHeadphoneStrength: (intensity: number) => void;
  hasShapedBands: boolean;
  bandCount: number;
  voicingProfile: IVoicingProfile | undefined;
  presetName: string | undefined;
  setVoicingStrength: (intensity: number) => void;
  modeName: string;
  setLayerStrength: (
    key: string,
    apply: (intensity: number) => void,
    write: (intensity: number) => Promise<void>,
    intensity: number,
  ) => void;
  isContinuousOn: boolean;
};

/**
 * The order the row shows the chips in, which is not the config's.
 *
 * The row used to read in the order the config is written — convolution,
 * driver, headphone, bands, Tone, preset — and the chip most often reached for
 * wandered: the bands' chip landed in the middle, wherever the layers before
 * it put it. Ivan fixed the order on 2026-09-24: the headphone correction
 * always first and the convolution after it (what the output is corrected
 * by), then the rest, and the three that change most last and in the same
 * places, the preset third from the end, the Tone second, and the bands'
 * own chip last, "so its easy to find and delete".
 */
const ROW_ORDER: readonly string[] = [
  'headphone',
  'convolution',
  'driver',
  'smart',
  'custom',
  'voicing',
  'tone',
  'eq',
];

/**
 * The applied layers, in the row's order (`ROW_ORDER`), each with what its
 * chip needs: a name, a strength where it has one, how to take it away and
 * which include its A/B switch leaves out.
 */
export const collectLayers = ({
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
  hasShapedBands,
  eqBandDesign,
  bandCount,
  voicing,
  voicingProfile,
  presetName,
  setVoicing,
  setVoicingStrength,
  smartEq,
  setSmartEq,
  tone,
  setTone,
  modeName,
  setLayerStrength,
  isContinuousOn,
  customFx,
}: TLayerListInputs): IActiveLayer[] => {
  const layers: IActiveLayer[] = [];

  // Collected in the order the config is written; shown in `ROW_ORDER`.
  if (convolution) {
    layers.push({
      key: 'convolution',
      icon: 'convolution',
      label: t('eq.layers.convolution'),
      name: convolution.name,
      onClear: async () => {
        // Optimistic: the chip has to go the moment it is clicked, or a slow
        // config write reads as a dead button.
        setConvolution(undefined);
        await clearConvolution();
        await refreshState();
      },
      // Switchable like the rest of the row, now that switching a layer off is
      // a line that is not written rather than settings that are cleared. This
      // was the one chip without a switch, on the grounds that putting it back
      // would mean finding its file again — and it never had to be gone at all.
      // The WAV stays exactly where it is; only the line naming it comes and
      // goes, which is the same act as omitting an Include.
      feature: 'convolution',
    });
  }

  // First, because it is what the bands themselves came from rather than
  // something stacked after them. Its remove button takes the bands with it:
  // the reference is not a label attached to a tuning, it is the tuning, and
  // removing only the label left a curve behind that the EQ page then claimed
  // nothing was responsible for.
  // Shown whenever a driver is chosen, for the same reason the voicing is: the
  // chip carries the strength slider, so hiding it at 0% would take away the
  // only control that could bring the layer back.
  if (driverProfile || driver?.apoOverride) {
    layers.push({
      key: 'driver',
      icon: 'waveform',
      label: t('eq.layers.driver'),
      name: driverProfile?.name ?? 'Equalizer APO edit',
      percent: Math.round((driver?.intensity ?? 0) * 100),
      strength: driver?.intensity ?? 0,
      isInactive: (driver?.intensity ?? 0) <= 0,
      onStrength: setDriverStrength,
      onClear: async () => {
        setDriver({ profileId: '', intensity: driver?.intensity ?? 0.6 });
        await setDriverApi('', driver?.intensity ?? 0.6);
        await refreshState();
      },
      feature: 'driver',
    });
  }

  /*
   * The published headphone correction, on its own chip.
   *
   * It used to be written into the bands, so it shared theirs — "an AutoEQ
   * model IS the manual EQ auto-tuned", which was true of the implementation
   * and never true of the intention. One chip meant clearing the EQ threw the
   * correction away, switching it off was impossible without losing the tuning,
   * and the strength of one could not be set without the other.
   *
   * Two things now, because they always were two things: what the headphones
   * need, and what this person likes.
   */
  // Drawn on whether a correction is held, dimmed on whether any of it is
  // applied — the rule the driver and voicing chips have always used. Asking
  // whether it is audible made the slider disappear at the end of its own
  // travel, with no way back to it.
  if (hasHeadphoneCorrection(headphone)) {
    layers.push({
      key: 'headphone',
      icon: 'waveform',
      label: t('eq.layers.headphone'),
      name: headphone?.eqImport
        ? t('eq.layers.customHeadphone')
        : (headsetName ?? headset ?? t('eq.layers.headphone')),
      percent: Math.round((headphone?.intensity ?? 0) * 100),
      strength: headphone?.intensity ?? 0,
      isInactive: (headphone?.intensity ?? 0) <= 0,
      onStrength: setHeadphoneStrength,
      onClear: async () => {
        setHeadphone(undefined);
        await setHeadphoneApi(undefined);
        await refreshState();
      },
      feature: 'headphone',
    });
  }

  // The bands, and where they came from — one chip, because an AutoEQ model
  // *is* the manual EQ auto-tuned. Same filters, same layer, different origin,
  // so two chips would have listed the same thing twice.
  //
  // Named by the model and its measurement when the bands came from one: a
  // model alone is ambiguous, since most have several measurements and they do
  // not sound alike. Named by how many bands there are when they were placed by
  // hand, which is the only honest thing to say about a tuning with no source.
  //
  // Marked modified once the bands no longer match what the model wrote.
  // Without that the chip goes on claiming a curve that is not on screen any
  // more, and editing a reference tuning is the most ordinary thing anybody
  // does here.
  // Only once there is something to say. A row of bands all sitting at 0 dB is
  // a flat EQ — the default state of the app — and listing it as an applied
  // layer would mean the chip is there from the first launch, saying nothing,
  // for everybody. Clearing the EQ puts every gain back to zero, so the chip
  // goes on its own.
  /*
   * THE BANDS, AND ONLY THE BANDS. It used to name itself after the measured
   * model, and that stopped being true when the headphone correction became a
   * layer of its own: the model is applied beside these bands now, not inside
   * them, and it has its own chip two along saying so. Naming this one after it
   * claimed a curve that had moved out — the screenshot that reported it showed
   * both chips carrying the same headphones, which is the whole bug in one row.
   *
   * The "(modified)" it also carried was the same mistake read a second way.
   * The signature it compared described the LAYER's filters, so comparing it
   * with the bands was comparing two different things and could only ever
   * differ. It said modified the instant a reference was applied, before
   * anybody had touched anything.
   *
   * So: how many bands there are, which is the only honest thing to say about a
   * tuning with no source of its own. The attribution lives on the chip that
   * actually holds it.
   *
   * AND WHILE THE EQ IS SWITCHED OFF, whatever the bands say. This chip is the
   * EQ's only switch, so a switched-off EQ whose bands all reached 0 dB — a
   * layout with nothing on it, every band reset by hand — lost its switch
   * with them: the bands sat greyed out, whatever was moved next was written
   * nowhere, and nothing on screen said why or offered the way back.
   */
  if (hasShapedBands || isBypassed('eq')) {
    layers.push({
      key: 'eq',
      icon: 'model',
      label: t('eq.layers.eq'),
      name:
        eqBandDesign?.name ??
        t('eq.layers.eq.bands', { count: String(bandCount) }),
      /*
       * Clears the bands, like every other chip in this row clears its layer —
       * AND NOTHING ELSE, WHICH IS THE FIX.
       *
       * It used to call `clearHeadset` as well, from back when the measured
       * correction lived inside these bands: clearing them to zero really did
       * mean the model was gone, so the attribution had to go with it.
       *
       * The correction is its own layer now, so that same line deleted a
       * neighbouring layer this chip does not own. Reported exactly that way —
       * delete the EQ chip and the AutoEQ goes with it — and there is no reading
       * of "take the EQ off" that includes somebody's headphone correction. The
       * headphone chip clears the headphone layer; this one clears the bands.
       */
      clearHint: t('eq.layers.clearBands'),
      onClear: async () => {
        await clearGains();
        await refreshState();
      },
      // The purest A/B in the app: the whole tuning out, the whole tuning back.
      //
      // It works because the bands are a file now. Switching them off is the
      // `Include:` line not being written, so the tuning is never touched —
      // where the first attempt at this had to clear every gain and put them
      // back one at a time, which half-succeeded and left the chip describing a
      // state it could not render.
      //
      // Nothing has to keep the chip on screen either. Bypass no longer
      // flattens the gains this condition tests, so a switched-off EQ is still
      // a shaped one and the chip stays of its own accord.
      feature: 'eq',
    });
  }

  /*
   * The Tone panel's Bass, Mid and Treble, right after the bands they sit
   * over, as they are written.
   *
   * A layer of their own now (`tone.ts`), so a chip of their own: switched off
   * and on like every other, and its × puts the three dials back to zero
   * without touching a band — which is also why the EQ chip's × above no
   * longer takes the tone with it. Named by the dials that are away from zero,
   * in the words the dials themselves carry.
   */
  if (tone && hasTone(tone)) {
    layers.push({
      key: 'tone',
      icon: 'configure',
      label: t('eq.tone'),
      name: TONE_CONTROLS.filter(({ knob }) => tone[knob] !== 0)
        .map(({ knob, labelKey }) => `${t(labelKey)} ${signedDb(tone[knob])}`)
        .join(' · '),
      clearHint: t('eq.layers.clearTone'),
      onClear: async () => {
        setTone(undefined);
        await setToneApi(null);
        await refreshState();
      },
      feature: 'tone',
    });
  }

  // Shown whenever a voicing is CHOSEN, not whenever it is doing something.
  //
  // Those are different questions and this is the one where the difference bites:
  // the chip carries the strength slider, so hiding it at 0% takes away the only
  // control that could bring the voicing back. You would drag to zero and the
  // thing would vanish under the cursor.
  //
  // It is marked inactive instead — see `isInactive`, which is the same faded
  // treatment a bypassed layer gets, because a voicing at zero strength is
  // exactly as absent from the sound as one that is switched off.
  if (voicingProfile || voicing?.apoOverride) {
    layers.push({
      key: 'voicing',
      isVoicing: true,
      label: t('eq.layers.voicing'),
      name: presetName ?? voicingProfile?.name ?? 'Equalizer APO edit',
      percent: Math.round((voicing?.intensity ?? 0) * 100),
      strength: voicing?.intensity ?? 1,
      isInactive: !isVoicingActive(voicing),
      onStrength: setVoicingStrength,
      onClear: async () => {
        // A preset's pill takes the whole preset away: its rack goes off with
        // its curve, as None in the picker does. Any other voicing is only
        // this layer, and the DSP page is none of its business.
        const isPreset = dspVoicingPresetId(voicing) !== undefined;
        setVoicing({ profileId: '', intensity: voicing?.intensity ?? 1 });
        await setVoicingApi('', voicing?.intensity ?? 1);
        if (isPreset) {
          switchPresetRackOff();
        }
        await refreshState();
      },
      feature: 'voicing',
    });
  }

  // Last, because it is written last: it corrects the residual of everything
  // above it. Clearing it takes nothing else with it — not the bands, not the
  // reference they came from, not the other two layers — which is the whole
  // point of it being a layer at all.
  if (hasSmartEqCorrection(smartEq)) {
    layers.push({
      key: 'smart',
      icon: 'smart',
      label: t('eq.layers.smart'),
      // Which mode wrote it, and nothing else.
      //
      // Four modes write this one layer, so the chip naming none of them could
      // not say why the correction looks the way it does — and that matters,
      // because Detail and Target disagree about what a record should sound
      // like.
      //
      // What the correction is *doing* used to be here as well and has moved to
      // the bubble on the button. This row is a list of what is applied, read
      // at a glance; a sentence that changes as the mode works belongs with the
      // thing that is working, and having it in both places made the row shift
      // under the eye while nothing about the layer had actually changed. The
      // pip beside it already says whether it is running.
      name: modeName,
      clearHint: t('eq.layers.clearSmart'),
      /*
       * A strength, arriving last of the four and for the opposite reason to
       * the others.
       *
       * The voicing, the driver and the headphone correction are all published
       * curves somebody chose, so dialling one back was obviously wanted. This
       * layer writes itself: a measurement decides what the filters are, and
       * there was nothing to dial back FROM.
       *
       * Which turns out to be the argument for it. A measured correction is a
       * claim about a room, and half of one is a reasonable thing to want when
       * the claim is more confident than the listener is — the same want that
       * made "back the whole thing off by half" the most common piece of advice
       * about automatic room correction anywhere.
       */
      percent: Math.round((smartEq?.intensity ?? 1) * 100),
      strength: smartEq?.intensity ?? 1,
      isInactive: (smartEq?.intensity ?? 1) <= 0,
      onStrength: (intensity: number) =>
        setLayerStrength(
          'smart',
          (value) =>
            setSmartEq(smartEq ? { ...smartEq, intensity: value } : smartEq),
          (value) =>
            setSmartEqApi(
              smartEq ? { ...smartEq, intensity: value } : undefined,
            ),
          intensity,
        ),
      isLive: isContinuousOn && !isBypassed('smart'),
      onClear: async () => {
        // Deleting the correction switches off the thing that maintains it.
        //
        // Otherwise this button does nothing you could see: the loop would
        // measure the now-empty layer, find the room exactly as wrong as it was
        // before, and start putting the correction back within seconds. Bypass
        // is the switch for "off for a moment"; this one is "I do not want
        // this", and it has to mean that.
        setContinuousEq(false);
        setSmartEq(undefined);
        await setSmartEqApi(undefined);
        await refreshState();
      },
      feature: 'smart',
    });
  }

  // The custom file is owned by the user and may contain commands FluidEQ does
  // not understand. Removing its chip clears the file's filter text, leaving
  // the generated EQ and AutoEQ layers completely untouched.
  if (customFx) {
    layers.push({
      key: 'custom',
      icon: 'waveform',
      label: t('eq.layers.custom'),
      name: customFx.fileName,
      clearHint: t('eq.layers.clearCustom'),
      onClear: async () => {
        // This pill describes the user-owned custom file. Clear that file's
        // filter text without touching the generated EQ or AutoEQ layers.
        await writeApoConfigFile(customFx.fileName, '');
        await refreshState();
      },
      feature: 'custom',
    });
  }

  return [...layers].sort(
    (a, b) => ROW_ORDER.indexOf(a.key) - ROW_ORDER.indexOf(b.key),
  );
};
