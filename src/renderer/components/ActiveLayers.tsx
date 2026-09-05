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
import { OPRA_SOURCE_ID, TApoLayer } from 'common/constants';
import { getVoicingProfile, isVoicingActive } from 'common/voicing';
import { getDriverProfile } from 'common/driver';
import { hasSmartEqCorrection } from 'common/smartEq';
import { hasHeadphoneCorrection } from '../../common/headphone';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { setContinuousEq, useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import {
  clearConvolution,
  clearGains,
  getOpraLabel,
  setDriver as setDriverApi,
  setHeadphone as setHeadphoneApi,
  setLayerBypass,
  setSmartEq as setSmartEqApi,
  setVoicing as setVoicingApi,
  writeApoConfigFile,
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
    customFx,
    headset,
    headsetSource,
    isFlat,
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
    isFlat === false ||
    Object.values(filters).some((f) => Math.abs(f.gain) > 0.01);
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
   * a band, and this chip now says how many there are. `headsetSignature` is
   * kept in state for profiles saved before the split, which carry it; nothing
   * in the renderer reads it any more, since Smart EQ subtracts the whole band
   * layer and no longer needs to know which part of it was a headset curve.
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
      name: headsetName ?? headset ?? t('eq.layers.headphone'),
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
  if (voicingProfile || voicing?.apoOverride) {
    layers.push({
      key: 'voicing',
      isVoicing: true,
      label: t('eq.layers.voicing'),
      name: voicingProfile?.name ?? 'Equalizer APO edit',
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

  /**
   * The chips, on one line or behind a button.
   *
   * Five layers with faders is most of a window; on a narrow one they wrapped
   * into three ragged rows above the bands and the header stopped reading as
   * a header. Collapsed they are one control saying how many there are, and
   * the same chips are inside it -- laid out as a column there, which is the
   * part that took two goes: a chip sized for a row is cut off in a menu.
   *
   * The decision is made against the widest the row has ever needed rather
   * than against what it currently measures. Measuring the collapsed row
   * would find it narrow, expand it, find it too wide, collapse it again —
   * a loop that runs as fast as the browser can lay out. The remembered
   * figure only grows while the row is open, which is the only state where it
   * means anything, and a little hysteresis on top keeps a window dragged to
   * exactly the boundary from flickering.
   */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const naturalWidthRef = useRef(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuHolder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => {
      const available = row.clientWidth;
      setIsCollapsed((wasCollapsed) => {
        if (!wasCollapsed) {
          // The children's own widths, added up, and not `scrollWidth`.
          //
          // A flex row wider than its contents reports `scrollWidth` as its
          // own width, so on a wide window the figure recorded here was the
          // window rather than the chips — and the row then stayed collapsed
          // at widths where everything would have fitted twice over. Summing
          // the children asks the question that was meant: how much do these
          // need.
          const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
          const children = Array.from(row.children);
          naturalWidthRef.current = children.reduce(
            (total, child) => total + child.getBoundingClientRect().width,
            gap * Math.max(0, children.length - 1),
          );
        }
        const needed = naturalWidthRef.current;
        if (needed === 0) {
          return wasCollapsed;
        }
        return wasCollapsed ? available < needed + 24 : available < needed;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [layers.length]);

  // Nothing to hang a menu off once the row fits again.
  useEffect(() => {
    if (!isCollapsed) {
      setIsMenuOpen(false);
    }
  }, [isCollapsed]);

  // Closes on a press elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !menuHolder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  // alternative was floating it over the layout, which trades the jump for a
  // strip that covers whatever is underneath.
  if (layers.length === 0) {
    return <div className="active-layers is-empty" aria-hidden />;
  }

  /**
   * How many of them are switched off, for the button that hides them.
   *
   * Only the button says it. With the chips on the surface a bypassed one is
   * struck through and dimmed where you can see it; folded behind a count,
   * "4 layers" would be the same words whether all four were doing something
   * or none of them were.
   */
  const offCount = layers.filter(
    (layer) => (layer.feature && isBypassed(layer.feature)) || layer.isInactive,
  ).length;

  const chips = layers.map((layer) => (
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
          onClick={() => {
            const feature = layer.feature as TApoLayer;
            const turningOn = isBypassed(feature);
            if (turningOn && layer.onStrength && (layer.strength ?? 0) <= 0) {
              layer.onStrength(1);
            }
            setLayerBypass(feature, !turningOn)
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

              ALWAYS DRAGGABLE, INCLUDING WHILE BYPASSED, and that is a fix
              rather than a relaxation. It used to be disabled when the layer was
              switched off, which reads as sensible and is a dead end: the only
              way back to a strength is the slider, so switching a layer off
              locked its strength wherever it happened to be. Two of today's
              reports were the same shape — a control that removes itself at the
              end of its own travel — and this is the third instance of it.

              It stays greyed to the eye through `.is-bypassed` on the chip, so
              it still says "this has a strength and none of it is being
              applied" without also refusing to be moved. It is never removed
              either: taking it away changed the chip's width, so switching a
              layer off resized it and shoved every chip beside it along. */}
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
          disabled={isBlockingError || !isEnabled}
          style={
            {
              '--fill': `${Math.round(layer.strength * 100)}%`,
            } as React.CSSProperties
          }
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
          onChange={(event) => {
            const next = Number(event.target.value) / 100;
            layer.onStrength?.(next);
            if (layer.feature) {
              const shouldBypass = next <= 0;
              if (shouldBypass !== isBypassed(layer.feature)) {
                setLayerBypass(layer.feature, shouldBypass).catch((e) =>
                  setGlobalError(e as ErrorDescription),
                );
              }
            }
          }}
        />
      )}
      <button
        type="button"
        aria-label={
          layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })
        }
        title={layer.clearHint ?? t('eq.layers.remove', { layer: layer.label })}
        disabled={isBlockingError || !isEnabled}
        onClick={() => {
          // Switching it back on is the main process's job, not this
          // button's. Every clear here goes through a handler that already
          // treats a layer being taken away as reason enough — and doing it
          // from this side would have switched the EQ back on even where
          // its X does nothing at all, which is the case for bands nobody
          // applied a reference to.
          layer.onClear().catch((e) => setGlobalError(e as ErrorDescription));
        }}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </span>
  ));

  return (
    <div
      ref={rowRef}
      className={`active-layers${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label={t('eq.layers.aria')}
    >
      <span className="active-layers__lede">{t('eq.layers')}</span>
      {isCollapsed ? (
        // The same split control as the Smart EQ button and the layout picker
        // beside it, down to their classes: a main half and a caret attached
        // to it. Written as a plain button with a chevron inside, it was the
        // one dropdown in this header that looked like something else.
        <span
          className={`eq-mode is-subtle active-layers__picker${
            isMenuOpen ? ' is-open' : ''
          }`}
          ref={menuHolder}
        >
          <button
            type="button"
            className="button small subtle eq-mode__main active-layers__trigger"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}
          >
            {offCount > 0
              ? t('eq.layers.countOff', {
                  count: layers.length,
                  off: offCount,
                })
              : t('eq.layers.count', { count: layers.length })}
          </button>
          <button
            type="button"
            className="eq-mode__caret"
            aria-label={t('eq.layers.aria')}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 6.5l4 4 4-4" />
            </svg>
          </button>
          <AnchoredMenu
            anchor={menuHolder.current}
            isOpen={isMenuOpen}
            className="active-layers__menu"
            ariaLabel={t('eq.layers.aria')}
          >
            {chips}
          </AnchoredMenu>
        </span>
      ) : (
        chips
      )}
    </div>
  );
};

export default ActiveLayers;
