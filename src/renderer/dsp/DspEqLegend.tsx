/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

interface IDspEqLegendProps {
  /** Any band set to react, so the at-rest twin is on screen. */
  hasDynamic: boolean;
  /** The selected band is reacting, so its threshold is drawn. */
  showsThreshold: boolean;
  /** The subsonic filter is on, so its skirt is drawn. */
  showsSubsonic: boolean;
}

interface ILegendEntry {
  key: TranslationKey;
  colour: string;
  isDashed: boolean;
  isFilled?: boolean;
  /** Which axis this one is read against — the whole point of the legend. */
  scale: 'gain' | 'level';
}

/**
 * What each line on the graph is, and which of the two scales it belongs to.
 *
 * The plot carries ten things at once — the curve, each band's own share, the
 * at-rest twin, the threshold, the subsonic skirt, the spectrum, the headroom
 * shading, the clip stripe, the handles and the fuzz grain — and until now none
 * of them said so. Dense is fine; unlabelled is not, and the reading it invites
 * is the wrong one: the spectrum and the threshold are LEVELS in dBFS off the
 * right-hand scale, while everything else is GAIN in dB off the left.
 *
 * Only what is actually on screen. A legend listing things that are not being
 * drawn is a second puzzle rather than the answer to the first.
 */
const DspEqLegend = ({
  hasDynamic,
  showsThreshold,
  showsSubsonic,
}: IDspEqLegendProps) => {
  const { t } = useTranslation();

  const entries: ILegendEntry[] = [
    {
      key: 'dsp.eq.legend.curve',
      colour: '#00e5cf',
      isDashed: false,
      scale: 'gain',
    },
    {
      key: 'dsp.eq.legend.spectrum',
      colour: 'rgba(0,229,207,0.5)',
      isDashed: false,
      isFilled: true,
      scale: 'level',
    },
  ];

  if (hasDynamic) {
    entries.push({
      key: 'dsp.eq.legend.atRest',
      colour: 'rgba(0,229,207,0.6)',
      isDashed: true,
      scale: 'gain',
    });
  }
  if (showsThreshold) {
    entries.push({
      key: 'dsp.eq.legend.threshold',
      colour: 'rgba(255,196,92,0.9)',
      isDashed: true,
      scale: 'level',
    });
  }
  if (showsSubsonic) {
    entries.push({
      key: 'dsp.eq.legend.subsonic',
      colour: 'rgba(120,170,255,0.75)',
      isDashed: true,
      scale: 'gain',
    });
  }
  return (
    <ul className="dsp-eq-legend">
      {entries.map((entry) => (
        <li className="dsp-eq-legend-item" key={entry.key}>
          <span
            className={`dsp-eq-legend-mark${entry.isDashed ? ' is-dashed' : ''}${
              entry.isFilled ? ' is-filled' : ''
            }`}
            style={{ color: entry.colour }}
          />
          {t(entry.key)}
          {/* Which axis, on every entry rather than only the surprising ones.
              Naming it once teaches the plot; naming it twice removes the
              question of whether the unlabelled ones were an oversight. */}
          <span className="dsp-eq-legend-scale">
            {t(
              entry.scale === 'level'
                ? 'dsp.eq.legend.level'
                : 'dsp.eq.legend.gain',
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default DspEqLegend;
