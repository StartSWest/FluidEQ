/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

export interface IDspRailPower {
  /** The checkbox's id, unique on the page. */
  id: string;
  isOn: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

interface IDspRailRowProps {
  /** The stage's name, which the switch's own name is said with. */
  name: string;
  /** The stage the page is showing: the whole row is its highlight. */
  isActive: boolean;
  /** The stage is doing nothing: its name dims. */
  isOff: boolean;
  /**
   * The stage's own on/off. Absent for a part that has none; its column is
   * still kept, so every row's button ends at the same place.
   */
  power?: IDspRailPower;
  /** The row's own button, which chooses the stage. */
  children: ReactNode;
}

/**
 * One stage on a rail of stages - the Mic tab's, the DSP page's and the
 * Gaming Lab's - with its own switch beside the button that chooses it (a
 * switch cannot live inside a button). The chosen row's highlight is the
 * row's, one band across the button and the switch, with air after the
 * switch, and the switch stands at the same place on every row (Ivan,
 * 2026-11-25: "I want the toggles to be inside the selected, the highlight.
 * So it's like a full band with the toggle inside. And make sure there is
 * padding after the toggle"; the first answer, a band that stopped short of
 * the switch, was sent back the same day). The switch says what pressing it does - "Turn Room off" - because
 * beside a button already named for the stage, a second control with the
 * same name tells a screen reader nothing.
 */
const DspRailRow = ({
  name,
  isActive,
  isOff,
  power,
  children,
}: IDspRailRowProps) => {
  const { t } = useTranslation();
  return (
    <div
      className={`dsp-rail-row${isActive ? ' is-active' : ''}${
        isOff ? ' is-off' : ''
      }${power ? ' has-switch' : ''}`}
    >
      {children}
      {/* Folded with the words: left in, a sliver of it showed past the
          folded rail's edge. */}
      <span className="dsp-rail-switch studio-rail__word">
        {power && (
          <Switch
            id={power.id}
            isOn={power.isOn}
            isDisabled={power.isDisabled}
            handleToggle={power.onToggle}
            ariaLabel={t(power.isOn ? 'dsp.rail.turnOff' : 'dsp.rail.turnOn', {
              name,
            })}
          />
        )}
      </span>
    </div>
  );
};

export default DspRailRow;
