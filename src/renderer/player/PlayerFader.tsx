/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { CSSProperties, PointerEvent, ReactNode } from 'react';
import centredSweep from '../widgets/centredSweep';

/**
 * One fader on the player's equalizer, drawn from zero.
 *
 * The player's own, not the EQ page's slider: what a listener reads off a
 * graphic equalizer at a glance is how far each band is from flat and which
 * way (Ivan, 2026-09-21), so the lit part of the track runs between the zero
 * line and the cap — up for a lift, down for a cut — rather than filling from
 * the bottom of the travel, which draws a full bar for a band doing nothing.
 *
 * The travel is the input's own: Chromium puts the cap's centre half a cap in
 * from each end of a range, so the two ends of the lit part are worked out
 * the same way in CSS (`--player-fader-cap` in `_miniPlayerEq.scss`) and the
 * cap and the fill cannot drift apart at any length.
 */
interface IPlayerFaderProps {
  /** What the fader is called, for assistive tech and the hover. */
  ariaLabel: string;
  /**
   * What goes under the fader: a band's frequency, or — for the preamp —
   * the key that switches Auto normalize (`MiniBands`).
   */
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The value the lit part grows from — flat, for every fader here. */
  zero: number;
  /** The band's own colour, or the accent for the preamp. */
  colour: string;
  isDisabled: boolean;
  /** A bypassed band: its fader stays, without its colour. */
  isOff?: boolean;
  title?: string;
  /** Held, so the screen can read out what is being moved; false on release. */
  onHold: (isHeld: boolean) => void;
  onChange: (value: number) => void;
}

/** Decimals a step can land on, so a written value never carries float dust. */
const decimalsOf = (step: number) =>
  step < 1 ? Math.ceil(-Math.log10(step)) : 0;

const PlayerFader = ({
  ariaLabel,
  label,
  value,
  min,
  max,
  step,
  zero,
  colour,
  isDisabled,
  isOff = false,
  title,
  onHold,
  onChange,
}: IPlayerFaderProps) => {
  /**
   * The travel stands `zero` at its middle, as every band's is.
   *
   * The preamp runs from -60 dB to +20: on an even travel its flat sat three
   * quarters up, apart from the flat line every band beside it shares (Ivan,
   * 2026-09-24: "center 0 on top not to the side"). So the input carries a
   * position, not the value, through `centredSweep` — which for a band's
   * ±20 dB is the even travel it always had — and a step of the input is one
   * of the value's steps where the travel is finest.
   */
  const sweep = centredSweep(min, zero, max);
  const finest = Math.min(zero - min, max - zero);
  // The value's span the whole travel would have at its finest rate.
  const travel = finest > 0 ? 2 * finest : max - min;
  const positionStep = travel > 0 ? step / travel : 1;
  const decimals = decimalsOf(step);
  const toStep = (position: number) =>
    Number(
      (Math.round(sweep.toValue(position) / step) * step).toFixed(decimals),
    );

  // Ctrl+click puts a band back to flat, the gesture the EQ page's own
  // controls answer to.
  const onPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onChange(zero);
      return;
    }
    onHold(true);
  };

  return (
    <div
      className={`player-band${isOff ? ' is-off' : ''}`}
      style={
        {
          '--player-fader-colour': colour,
          '--player-fader-v': sweep.toPosition(value),
          '--player-fader-zero': sweep.toPosition(zero),
        } as CSSProperties
      }
      title={title}
    >
      <div className="player-band__slot">
        <span className="player-band__fill" aria-hidden="true" />
        {/* The cap is drawn, not the input's own: a range turned on its side
            is composited on its own layer, and each one rounds its thumb to
            the screen's pixels by itself — so a row of them drifts, two caps
            touching here and a hole there, however evenly the row was laid
            out (Ivan, 2026-09-21). Drawn here it stands on the same figure
            the lit part ends at, and rounds with the track behind it. */}
        <input
          type="range"
          className="player-band__input"
          aria-label={ariaLabel}
          // The input moves a position; assistive tech still hears the level.
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
          min={0}
          max={1}
          step={positionStep}
          value={sweep.toPosition(value)}
          disabled={isDisabled}
          onChange={(event) => onChange(toStep(Number(event.target.value)))}
          onPointerDown={onPointerDown}
          onPointerUp={() => onHold(false)}
          onPointerCancel={() => onHold(false)}
          onFocus={() => onHold(true)}
          onBlur={() => onHold(false)}
        />
        <span className="player-band__cap" aria-hidden="true" />
      </div>
      <span className="player-band__hz">{label}</span>
    </div>
  );
};

export default PlayerFader;
