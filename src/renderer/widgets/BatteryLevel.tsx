/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import '../styles/BatteryLevel.scss';

/** At or under this the fill turns amber: time to think about a charger. */
const LOW_PERCENT = 20;
/** At or under this, red: the headset is about to go quiet. */
const EMPTY_PERCENT = 10;

/** The case's inner width in the glyph's own units: what a full fill spans. */
const FILL_WIDTH = 13;

/**
 * How much battery an output's device has left (`IAudioDevice.batteryPercent`),
 * as a battery and its number: the glyph for a glance, the number for the
 * truth. The fill is drawn to the level, so a headset at 15% looks it before
 * the number is read, and changes colour where a listener would want to know.
 */
const BatteryLevel = ({ percent }: { percent: number }) => {
  const { t } = useTranslation();
  const level = Math.max(0, Math.min(100, Math.round(percent)));
  const label = t('output.battery', { percent: level });
  let tone = '';
  if (level <= EMPTY_PERCENT) {
    tone = ' is-empty';
  } else if (level <= LOW_PERCENT) {
    tone = ' is-low';
  }
  return (
    <span
      className={`battery-level${tone}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg
        className="battery-level__glyph"
        viewBox="0 0 20 10"
        aria-hidden="true"
      >
        <rect
          className="battery-level__case"
          x="0.75"
          y="0.75"
          width="16.5"
          height="8.5"
          rx="2.25"
        />
        <rect
          className="battery-level__nub"
          x="18"
          y="3.25"
          width="1.6"
          height="3.5"
          rx="0.8"
        />
        {/* A sliver at least, so an empty battery still shows where it is. */}
        <rect
          className="battery-level__fill"
          x="2.5"
          y="2.5"
          width={Math.max(1, (FILL_WIDTH * level) / 100)}
          height="5"
          rx="1.1"
        />
      </svg>
      <span className="battery-level__value">{level}%</span>
    </span>
  );
};

export default BatteryLevel;
