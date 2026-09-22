/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { CSSProperties, PointerEvent, ReactNode } from 'react';

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

/** Where a value sits on the travel, from the bottom (0) to the top (1). */
const fraction = (value: number, min: number, max: number) =>
  max === min ? 0 : (Math.min(max, Math.max(min, value)) - min) / (max - min);

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
          '--player-fader-v': fraction(value, min, max),
          '--player-fader-zero': fraction(zero, min, max),
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
          aria-valuetext={`${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={isDisabled}
          onChange={(event) => onChange(Number(event.target.value))}
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
