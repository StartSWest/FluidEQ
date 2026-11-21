/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode, Ref } from 'react';

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
  /** The card's presses, the suggested one first and loud. */
  actions: ReactNode;
  /** Handed the card as it is drawn (`useWaveCard`: the focus goes in). */
  cardRef: Ref<HTMLDivElement>;
}

/**
 * The card a press on the titlebar's plate opens (Ivan, 2026-11-20): what
 * plays, and the way to change it. Shown while its plate says so and never
 * on pointing, so nothing comes up uninvited over the window.
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
  cardRef,
}: IWavePresetCardProps) => (
  <div
    ref={cardRef}
    className="wave-preset-card"
    role="dialog"
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
