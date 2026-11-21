/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';

interface IWavePresetCardProps {
  /** The glyph beside the name, sized by the card. */
  glyph: ReactNode;
  name: ReactNode;
  /** What it is, in a line under the name. */
  line?: string;
  /** The name read aloud, when `name` carries more than its words. */
  label: string;
  /** What it does: its curve, its stages. */
  children?: ReactNode;
  /** The card's two presses, the suggested one first and loud. */
  actions: ReactNode;
}

/**
 * The card under the titlebar's plate (Ivan, 2026-11-20: "ok con la
 * tarjeta"): what plays, said before anybody presses. Shown by the plate's
 * own stylesheet while the plate is pointed at or focused from the keyboard
 * and hidden while its menu is open (`WavePreset.scss`), so it has no state
 * of its own and nothing here waits on a clock.
 *
 * A double click on it stays on it: the titlebar under it takes one as
 * "maximise the window".
 */
const WavePresetCard = ({
  glyph,
  name,
  line,
  label,
  children,
  actions,
}: IWavePresetCardProps) => (
  <div
    className="wave-preset-card"
    role="group"
    aria-label={label}
    onDoubleClick={(event) => event.stopPropagation()}
  >
    <div className="wave-preset-card__head">
      {glyph}
      <strong className="wave-preset-card__name">{name}</strong>
      {line && <span className="wave-preset-card__line">{line}</span>}
    </div>
    {children}
    <div className="wave-preset-card__actions">{actions}</div>
  </div>
);

export default WavePresetCard;
