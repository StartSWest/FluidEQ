/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  IFilter,
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
  PREAMP_MIN_GAIN,
  isBandEnabled,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import { getBandColor } from '../utils/bandColors';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { useEnginePreamp, useEnginePreampReader } from '../utils/enginePreamp';
import { setGain, setMainPreAmp } from '../utils/equalizerApi';
import {
  FilterActionEnum,
  useFluidEqContext,
  useFluidEqShell,
} from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { sortHelper, useLatestCall } from '../utils/utils';
import PlayerFader from './PlayerFader';
import PlayerIcon from './PlayerIcon';
import useAutoPreAmp from '../components/useAutoPreAmp';

/**
 * How many bands one page of the row holds, at a width a finger can grip
 * (Ivan, 2026-10-25: "make sure they fit the 10 bands the width remaining").
 */
const BANDS_PER_PAGE = 10;

/** The preamp's key among the faders, for the screen's read-out. */
export const PREAMP_FOCUS = 'preamp';

/** A band's frequency the way the EQ page labels it: 63, 1k, 2.5k. */
export const bandLabel = (hz: number) => {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${Number.isInteger(k) ? k : Number(k.toFixed(1))}k`;
  }
  return String(Math.round(hz));
};

/**
 * Which fader is held, for a screen that reads it out; nothing on release.
 * The one amp draws none (its figures stand under the faders), so optional.
 */
type TFocus = (key: string | undefined) => void;

interface IMiniBandProps {
  band: IFilter;
  progress: number;
  isDisabled: boolean;
  onFocus?: TFocus;
}

/** One band: the player's own fader in the band's colour, its frequency. */
const MiniBand = ({ band, progress, isDisabled, onFocus }: IMiniBandProps) => {
  const rainbow = useRainbowStops();
  const { dispatchFilter, setGlobalError } = useFluidEqShell();
  // The screen first, then the engine — the order the EQ page keeps, so the
  // slider does not jitter while the write is on its way.
  const write = useCallback(
    async (gain: number) => {
      dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: band.id,
        newValue: gain,
      });
      await setGain(band.id, gain);
    },
    [band.id, dispatchFilter],
  );
  // One write in flight and the newest position waiting behind it: the EQ
  // page's own pace, so a drag here reaches the engine as a drag there does.
  const throttled = useLatestCall(write);
  const setValue = useCallback(
    async (gain: number) => {
      try {
        await throttled(gain);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, throttled],
  );
  return (
    <PlayerFader
      ariaLabel={`${bandLabel(band.frequency)} Hz`}
      label={bandLabel(band.frequency)}
      value={band.gain}
      min={MIN_GAIN}
      max={MAX_GAIN}
      step={0.1}
      zero={0}
      // The band's own colour, unless the player is drawing in one colour:
      // the spectrum is Rainbow mode's (`--player-band-tint`, declared only
      // outside it, in `MiniPlayer.scss`).
      colour={`var(--player-band-tint, ${getBandColor(progress, rainbow).color})`}
      isDisabled={isDisabled}
      isOff={!isBandEnabled(band)}
      onHold={(isHeld) => onFocus?.(isHeld ? band.id : undefined)}
      onChange={(gain) => {
        setValue(gain).catch(() => undefined);
      }}
    />
  );
};

/**
 * The equalizer's faders: the preamp, then every band with a gain, in the
 * band colours.
 *
 * The preamp is the sidebar's own: under Auto normalize it is set for the
 * listener, drawn where it stands and not draggable, with the sidebar's
 * sentence saying why.
 */
const MiniBands = ({ onFocus }: { onFocus?: TFocus }) => {
  const { t } = useTranslation();
  const {
    filters,
    isAutoPreAmpOn,
    isBlockingError,
    isEnabled,
    preAmp,
    setGlobalError,
    setPreAmp,
  } = useFluidEqContext();
  const isFluid = useCurrentEngine() === 'fluid';
  useEnginePreampReader(isFluid && isAutoPreAmpOn);
  const livePreamp = useEnginePreamp();
  const automaticPreamp = livePreamp?.enabled ? livePreamp.gainDb : 0;
  const shownPreamp = isFluid && isAutoPreAmpOn ? automaticPreamp : preAmp;
  const bands = useMemo(
    () =>
      Object.values(filters)
        .sort(sortHelper)
        .filter((band) => !NO_GAIN_FILTER_TYPES.includes(band.type)),
    [filters],
  );
  const isLocked = !isEnabled || isBlockingError;
  const auto = useAutoPreAmp();
  const fadersRef = useRef<HTMLDivElement>(null);
  const count = bands.length;
  // Whether the row runs on past either edge: the arrow on that side is
  // there to press only then. Read from the row on every scroll and change
  // of size — never from a guess at how far a smooth scroll has got.
  const [pages, setPages] = useState({ canBack: false, canOn: false });
  const readPages = useCallback(() => {
    const row = fadersRef.current;
    if (!row) {
      return;
    }
    const canBack = row.scrollLeft > 1;
    const canOn = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
    setPages((shown) =>
      shown.canBack === canBack && shown.canOn === canOn
        ? shown
        : { canBack, canOn },
    );
  }, []);

  /**
   * ONE WIDTH FOR A BAND, WHATEVER THE LAYOUT (Ivan, 2026-10-25: "all bands
   * need to fit same … if we add more we just do left and right scroll into
   * other sections", "fit the 10 bands the width remaining"). The row is cut
   * into ten equal steps — the amp's width is fixed, so that is one size for
   * good — and a layout of ten
   * or fewer stands in the middle of it, while a bigger one runs on past the
   * row's edge in pages of ten, turned with the arrows at its ends
   * (`turnPage`) or by scrolling sideways. Thirty-one bands squeezed into
   * the row were too narrow to grip and lost their names to every other one.
   *
   * Each step is the same width, with the same gap between them — IN THE
   * PIXELS THE SCREEN HAS (Ivan, 2026-09-21: keep a minimum between the
   * bands).
   *
   * Shared out by the browser, each band gets a fraction of a pixel and the
   * caps land two apart in one place and three in the next, which reads as
   * a bunched row however equal the numbers are. Whole CSS pixels are not
   * enough either — the page can be zoomed, this window sits at about 0.91,
   * and a whole CSS pixel is then a fraction of a real one. So the row is
   * measured in device pixels and cut into equal steps there, the gap is a
   * whole number of them and never less than the deck asks for, the row is
   * pushed to the next whole device pixel, and the few left over are split
   * between its two ends.
   *
   * Written straight onto the row, so a window being dragged does not
   * re-render the equalizer on every frame of it.
   */
  useLayoutEffect(() => {
    const row = fadersRef.current;
    if (!row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const fit = () => {
      const deck = row.parentElement ?? row;
      // From the deck, never from the row: the row is where the snapped
      // lengths are written, and reading those back would snap them again.
      const deckStyle = getComputedStyle(deck);
      const base =
        parseFloat(deckStyle.getPropertyValue('--player-band-gap')) || 4;
      const band =
        parseFloat(deckStyle.getPropertyValue('--player-fader-cap')) || 13;
      const ratio = window.devicePixelRatio || 1;
      const box = row.getBoundingClientRect();
      const gap = Math.max(1, Math.round(base * ratio));
      const widest = Math.max(2, Math.round(band * ratio));
      const room = Math.floor(box.width * ratio);
      // A page shared out in whole pixels, with the gap taken off the top:
      // whatever is left is the band, and the cap is never wider than that,
      // or the caps eat the gap the row was measured out to keep.
      const step = Math.max(gap + 2, Math.floor((room + gap) / BANDS_PER_PAGE));
      const cap = Math.min(widest, step - gap);
      // Ten or fewer stand in the middle; more start at the left edge,
      // where each page starts.
      const spare =
        count > BANDS_PER_PAGE ? 0 : Math.max(0, room - (count * step - gap));
      const edge = Math.ceil(box.left * ratio) - box.left * ratio;
      row.style.setProperty('--player-band-gap', `${gap / ratio}px`);
      row.style.setProperty('--player-band-width', `${(step - gap) / ratio}px`);
      row.style.setProperty('--player-fader-cap', `${cap / ratio}px`);
      row.style.setProperty('--player-page-width', `${room / ratio}px`);
      row.style.paddingLeft = `${(edge + Math.floor(spare / 2)) / ratio}px`;
      readPages();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    row.addEventListener('scroll', readPages, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener('scroll', readPages);
    };
  }, [count, readPages]);

  /** A page of ten bands on, or back, as far as the row goes. */
  const turnPage = (direction: -1 | 1) => {
    const row = fadersRef.current;
    row?.scrollBy({ left: direction * row.clientWidth, behavior: 'smooth' });
  };
  const setPreamp = useCallback(
    async (gain: number) => {
      setPreAmp(gain);
      try {
        await setMainPreAmp(gain);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, setPreAmp],
  );

  return (
    <div className="player-bands">
      {/* The preamp stands apart from the bands, before the rule: its own
          grid column, which is what `.player-bands > .player-band` styles. */}
      <PlayerFader
        ariaLabel={t('sidebar.preamp')}
        // The word under the preamp is its switch: lit and reading AUTO
        // while the app is setting it, PRE once the listener has taken it
        // back — and a press moves between the two, which is how the fader
        // is freed without leaving the player (Ivan, 2026-09-21).
        label={
          <button
            type="button"
            className={`player-band__auto${auto.isOn ? ' is-on' : ''}`}
            aria-pressed={auto.isOn}
            disabled={auto.isDisabled}
            title={
              auto.isOn ? t('sidebar.preampAuto') : t('player.eq.autoHint')
            }
            onClick={() => {
              auto.toggle().catch(() => undefined);
            }}
          >
            {auto.isOn ? t('player.eq.auto') : t('player.eq.pre')}
          </button>
        }
        title={isAutoPreAmpOn ? t('sidebar.preampAuto') : t('sidebar.preamp')}
        value={shownPreamp}
        // The preamp's own floor, not a band's: it cancels the sum of every
        // layer, and a headphone correction plays as published past ±20 dB.
        // Held to ±20 here the fader could not even SHOW a level set deeper
        // in the side panel — it pinned at the bottom, and the first touch
        // wrote -20 over it. Unity still sits in the middle, level with the
        // bands' flat line; the -60 side is compressed (`PlayerFader`).
        min={PREAMP_MIN_GAIN}
        max={MAX_GAIN}
        step={0.1}
        zero={0}
        colour="var(--player-lamp)"
        isDisabled={isLocked || isAutoPreAmpOn}
        onHold={(isHeld) => onFocus?.(isHeld ? PREAMP_FOCUS : undefined)}
        onChange={(gain) => {
          setPreamp(gain).catch(() => undefined);
        }}
      />
      <span className="player-bands__rule" aria-hidden="true" />
      {/* No printed scale beside the bands: every fader carries its own
          figure under it now (the refined amp, 2026-09-26), which says more
          than a +20 / 0 / −20 column did and takes the column's width back
          for the bands. */}
      <div
        className={`player-bands__window${pages.canBack ? ' can-back' : ''}${
          pages.canOn ? ' can-on' : ''
        }`}
      >
        <div className="player-bands__faders" ref={fadersRef}>
          {bands.map((band, i) => (
            <MiniBand
              key={band.id}
              band={band}
              progress={i / Math.max(1, bands.length - 1)}
              isDisabled={isLocked}
              onFocus={onFocus}
            />
          ))}
        </div>
        {pages.canBack && (
          <button
            type="button"
            className="player-bands__page is-back"
            aria-label={t('player.eq.pageBack')}
            title={t('player.eq.pageBack')}
            onClick={() => turnPage(-1)}
          >
            <PlayerIcon name="chevronLeft" />
          </button>
        )}
        {pages.canOn && (
          <button
            type="button"
            className="player-bands__page is-on"
            aria-label={t('player.eq.pageOn')}
            title={t('player.eq.pageOn')}
            onClick={() => turnPage(1)}
          >
            <PlayerIcon name="chevronRight" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MiniBands;
