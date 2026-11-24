/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic's whole delay, in the header under the profile: Windows' block
 * plus every stage that adds any, as the engine measures it on the mic.
 * Each stage's own share stands beside it on the rail.
 *
 * It replaced a section of its own under the header, which appeared once
 * the engine's first reading came in and pushed the picture and the cards
 * down (Ivan, 2026-11-24: "quita esa sesión de delay"). This slot is there
 * from the first frame: a muted dash until the engine has written a status
 * for the mic, never a figure worked out from the dials, and never nothing.
 */

import type { IEngineOutputHealth } from '../../common/engineHealth';
import { useTranslation } from '../utils/I18nContext';

/** "2", not "2.0", and whole milliseconds from ten up, as the rail writes them. */
const toMs = (value: number) => {
  const tenths = Math.round(value * 10) / 10;
  if (tenths === 0) {
    return '0';
  }
  return tenths >= 10
    ? String(Math.round(value))
    : tenths.toFixed(1).replace(/\.0$/, '');
};

/** The whole delay, ms, or undefined until the engine has measured it. */
export const micDelayMs = (
  health: IEngineOutputHealth | undefined,
): number | undefined => {
  const latency = health?.latency;
  const periodMs = health?.load?.periodMs;
  if (!latency || periodMs === undefined || !(latency.rate > 0)) {
    return undefined;
  }
  return latency.parts.reduce(
    (sum, part) => sum + (part.frames * 1000) / latency.rate,
    periodMs,
  );
};

interface IMicDelayReadoutProps {
  health: IEngineOutputHealth | undefined;
}

const MicDelayReadout = ({ health }: IMicDelayReadoutProps) => {
  const { t } = useTranslation();
  const total = micDelayMs(health);
  const known = total !== undefined;
  return (
    <p
      className="mic-head__delay"
      title={known ? t('mic.delay.measured') : t('mic.delay.unknown')}
    >
      <span className="mic-head__delay-label">{t('mic.delay.label')}</span>
      <span className={`mic-head__delay-value${known ? '' : ' is-waiting'}`}>
        {known ? t('dsp.latency.ms', { ms: toMs(total) }) : '—'}
      </span>
    </p>
  );
};

export default MicDelayReadout;
