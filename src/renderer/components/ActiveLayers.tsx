/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useRef } from 'react';
import { ErrorDescription } from 'common/errors';
import { TApoLayer } from 'common/constants';
import { getVoicingProfile, isVoicingActive } from 'common/voicing';
import { getDriverProfile } from 'common/driver';
import { hasSmartEqLayer } from 'common/smartEq';
import { hasHeadphoneCorrection } from '../../common/headphone';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { setContinuousEq, useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import {
  clearConvolution,
  clearGains,
  setDriver as setDriverApi,
  setHeadphone as setHeadphoneApi,
  setLayerBypass,
  setSmartEq as setSmartEqApi,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
import { useSmartEqMode } from '../utils/smartEqMode';
import MenuIcon, { MenuIconName } from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import { LAYER_SWATCH } from '../styles/color';
import '../styles/ActiveLayers.scss';

/** How long a strength drag settles before it is written. */
const STRENGTH_WRITE_DEBOUNCE_MS = 250;

/**
 * What is shaping the sound besides the bands on screen.
 *
 * The EQ page shows an editor full of bands and nothing else, which is a lie
 * whenever a convolution, a voicing, a driver correction or a measured Smart EQ
 * curve is also live — every one of them is written into the same Equalizer APO
 * chain and every one is audible, but none appear in the editor. People chased
 * phantom bumps in the graph because the thing causing them was on another tab.
 *
 * Each chip removes its own layer, because the tab that owns it is the one
 * place you would otherwise have to go to turn it off.
 */
const ActiveLayers = () => {
  const strengthTimers = useRef<Record<string, number>>({});
  const {
    filters,
    convolution,
    voicing,
    driver,
    headphone,
    setHeadphone,
    smartEq,
    headset,
    isEnabled,
    isBlockingError,
    bypassed,
    refreshState,
    setConvolution,
    setVoicing,
    setDriver,
    setSmartEq,
    setPreAmp,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();
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
  const hasShapedBands = Object.values(filters).some(
    (f) => Math.abs(f.gain) > 0.01,
  );
  /*
   * The "(modified)" mark is gone with the attribution it qualified.
   *
   * It compared `headsetSignature` against the shape of the bands, which was
   * exactly right while a reference WAS the bands. Since the correction became
   * a layer, that signature describes the layer's filters — so the comparison
   * was between two different things and could only ever come out unequal. The
   * chip said modified the moment a reference was applied and never stopped.
   *
   * There is nothing to replace it with here, either: a band the user moved is
   * a band, and this chip now says how many there are. `headsetSignature` still
   * earns its keep elsewhere — `buildLayerTargetCurve` reads it to protect
   * corrections applied before the split, which really did go into the bands.
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
        setVoicing({ profileId: voicing?.profileId ?? '', intensity: value }),
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
        setDriver({ profileId: driver?.profileId ?? '', intensity: value }),
      (value) => setDriverApi(driver?.profileId ?? '', value),
      intensity,
    );

  const voicingProfile = getVoicingProfile(voicing?.profileId ?? '');
  const driverProfile = getDriverProfile(driver?.profileId ?? '');

  const layers: {
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
  }[] = [];

  // The row reads in the order the config is written, so the chips and the
  // Equalizer APO chain tell the same story top to bottom. Convolution is
  // first there because it is the base the rest is stacked on.
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
  if (driverProfile) {
    layers.push({
      key: 'driver',
      icon: 'waveform',
      label: t('eq.layers.driver'),
      name: driverProfile.name,
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
      name: headset ?? t('eq.layers.headphone'),
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
   * `headsetSignature` now describes the LAYER's filters, so comparing it with
   * the bands is comparing two different things and can only ever differ. It
   * said modified the instant a reference was applied, before anybody had
   * touched anything.
   *
   * So: how many bands there are, which is the only honest thing to say about a
   * tuning with no source of its own. The attribution lives on the chip that
   * actually holds it.
   */
  if (hasShapedBands) {
    layers.push({
      key: 'eq',
      icon: 'model',
      label: t('eq.layers.eq'),
      name: t('eq.layers.eq.bands', { count: String(bandCount) }),
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
        setPreAmp(0);
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
  if (voicingProfile) {
    layers.push({
      key: 'voicing',
      isVoicing: true,
      label: t('eq.layers.voicing'),
      name: voicingProfile.name,
      percent: Math.round((voicing?.intensity ?? 0) * 100),
      strength: voicing?.intensity ?? 1,
      isInactive: !isVoicingActive(voicing),
      onStrength: setVoicingStrength,
      onClear: async () => {
        setVoicing({ profileId: '', intensity: voicing?.intensity ?? 1 });
        await setVoicingApi('', voicing?.intensity ?? 1);
        await refreshState();
      },
      feature: 'voicing',
    });
  }

  // Last, because it is written last: it corrects the residual of everything
  // above it. Clearing it takes nothing else with it — not the bands, not the
  // reference they came from, not the other two layers — which is the whole
  // point of it being a layer at all.
  if (hasSmartEqLayer(smartEq)) {
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

  // Empty, but still there.
  //
  // This row grows as somebody works — the first band they shape, the first
  // voicing they try — and appearing from nothing pushed the whole editor down
  // under their hands mid-drag. A control that moves while you are using it is
  // the worst thing an interface can do, and it happened at exactly the moment
  // somebody was tuning for the first time.
  //
  // So the space is always reserved and the row simply has nothing in it. One
  // line of height is a small price for an editor that never moves; the
  // alternative was floating it over the layout, which trades the jump for a
  // strip that covers whatever is underneath.
  if (layers.length === 0) {
    return <div className="active-layers is-empty" aria-hidden />;
  }

  return (
    <div className="active-layers" aria-label={t('eq.layers.aria')}>
      <span className="active-layers__lede">{t('eq.layers')}</span>
      {layers.map((layer) => (
        <span
          className={`active-layer${
            (layer.feature && isBypassed(layer.feature)) || layer.isInactive
              ? ' is-bypassed'
              : ''
          }${layer.strength !== undefined ? ' has-strength' : ''}`}
          key={layer.key}
        >
          {/* The body of the chip is the A/B switch.

              Pressing it takes the layer out of the config and leaves it here,
              dimmed; pressing again puts it back. Nothing is recomputed either
              way, which is the point — a correction is either an improvement or
              it is not, and the only way to tell is to hear the same passage
              both ways within a few seconds of itself. Removing and re-applying
              is not that: Smart EQ takes half a minute to measure and a cleared
              voicing is one you have to go and find.

              One call each way, and the same call: a layer is switched off by
              its file not being included, so there is no state in between for a
              half-finished press to land in.

              A plain span for the convolution, which is a line in the device
              file rather than an include and so has nothing to leave out. */}
          {layer.feature ? (
            <button
              type="button"
              className="active-layer__body"
              aria-pressed={!isBypassed(layer.feature)}
              disabled={isBlockingError || !isEnabled}
              title={
                isBypassed(layer.feature)
                  ? t('eq.layers.enable', { layer: layer.label })
                  : t('eq.layers.disable', { layer: layer.label })
              }
              onClick={() => {
                const feature = layer.feature as TApoLayer;
                setLayerBypass(feature, !isBypassed(feature))
                  .then(() => refreshState())
                  .catch((e) => setGlobalError(e as ErrorDescription));
              }}
            >
              <span
                className="active-layer__swatch"
                style={{ background: LAYER_SWATCH[layer.key] }}
                aria-hidden
              />
              {layer.isVoicing ? (
                <VoicingIcon
                  profileId={voicing?.profileId}
                  className="active-layer__icon"
                />
              ) : (
                <MenuIcon
                  name={layer.icon as MenuIconName}
                  className="active-layer__icon"
                />
              )}
              <span className="active-layer__label">{layer.label}</span>
              <span className="active-layer__name" title={layer.name}>
                {layer.name}
                {/* Its own cell with a reserved width, so 5% and 100% take the
                    same room. Appended to the name it changed the chip width on
                    every step of a drag, shoving the chips beside it around
                    under the cursor. */}
                {layer.percent !== undefined && (
                  <em className="active-layer__percent">{layer.percent}%</em>
                )}
                {/* A pip, not a word. The row is four chips wide already and
                    this is a state of one of them rather than a fifth thing to
                    read; the title carries the sentence. */}
                {layer.isLive && (
                  <span
                    className="active-layer__live"
                    title={t('eq.smart.continuousAria')}
                  />
                )}
              </span>
            </button>
          ) : (
            <span className="active-layer__body">
              <span
                className="active-layer__swatch"
                style={{ background: LAYER_SWATCH[layer.key] }}
                aria-hidden
              />
              {layer.isVoicing ? (
                <VoicingIcon
                  profileId={voicing?.profileId}
                  className="active-layer__icon"
                />
              ) : (
                <MenuIcon
                  name={layer.icon as MenuIconName}
                  className="active-layer__icon"
                />
              )}
              <span className="active-layer__label">{layer.label}</span>
              <span className="active-layer__name" title={layer.name}>
                {layer.name}
                {/* Its own cell with a reserved width, so 5% and 100% take the
                    same room. Appended to the name it changed the chip width on
                    every step of a drag, shoving the chips beside it around
                    under the cursor. */}
                {layer.percent !== undefined && (
                  <em className="active-layer__percent">{layer.percent}%</em>
                )}
                {/* A pip, not a word. The row is four chips wide already and
                    this is a state of one of them rather than a fifth thing to
                    read; the title carries the sentence. */}
                {layer.isLive && (
                  <span
                    className="active-layer__live"
                    title={t('eq.smart.continuousAria')}
                  />
                )}
              </span>
            </span>
          )}
          {/* Outside the body, not inside it: the body is a button, and a range
              input nested in one cannot be dragged — the button swallows the
              pointer and every attempt to slide toggles the layer off instead.

              Disabled while the layer is bypassed, not removed. Taking it away
              changed the chip's width, so switching a layer off resized it and
              shoved every chip beside it along — and it left nothing on screen
              to say the setting still exists and is waiting. Greyed out, it says
              both: this has a strength, and it is not doing anything at the
              moment. */}
          {layer.strength !== undefined && (
            <input
              type="range"
              className="active-layer__strength"
              min={0}
              max={100}
              step={5}
              value={Math.round(layer.strength * 100)}
              aria-label={t('voicing.strength')}
              title={t('voicing.strength')}
              disabled={
                isBlockingError ||
                !isEnabled ||
                Boolean(layer.feature && isBypassed(layer.feature))
              }
              style={
                {
                  '--fill': `${Math.round(layer.strength * 100)}%`,
                } as React.CSSProperties
              }
              onChange={(event) =>
                layer.onStrength?.(Number(event.target.value) / 100)
              }
            />
          )}
          <button
            type="button"
            aria-label={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            title={
              layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
            }
            disabled={isBlockingError || !isEnabled}
            onClick={() => {
              // Switching it back on is the main process's job, not this
              // button's. Every clear here goes through a handler that already
              // treats a layer being taken away as reason enough — and doing it
              // from this side would have switched the EQ back on even where
              // its X does nothing at all, which is the case for bands nobody
              // applied a reference to.
              layer
                .onClear()
                .catch((e) => setGlobalError(e as ErrorDescription));
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
};

export default ActiveLayers;
