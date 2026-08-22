/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

export type TDspSection = 'eq' | 'exciter' | 'compressor' | 'maximizer';

interface IDspSideTabsProps {
  active: TDspSection;
  onSelect: (section: TDspSection) => void;
  /** Which processors are switched on, so the rail can show it at a glance. */
  enabled: Record<TDspSection, boolean>;
}

const SECTIONS: { id: TDspSection; labelKey: TranslationKey }[] = [
  { id: 'eq', labelKey: 'dsp.eq.title' },
  { id: 'exciter', labelKey: 'dsp.exciter.title' },
  { id: 'compressor', labelKey: 'dsp.compressor.title' },
  { id: 'maximizer', labelKey: 'dsp.maximizer.title' },
];

/**
 * The rail down the side of the DSP page, one entry per processor.
 *
 * Stacking every processor on one scrolling page put four cards and forty-one
 * knobs in front of someone who wanted to move one — the EQ alone was eighteen
 * of them. One processor at a time, each with the whole page, is what every
 * plugin host does and for the same reason.
 *
 * In signal order top to bottom, and NOT reorderable: the order is an audio
 * decision, and the rail reads as the chain rather than as a menu.
 *
 * The lamp is the processor's own enabled state, not the selection. Reading
 * "which of these are doing something" has to be possible without visiting
 * each one, or the rail is just four words.
 */
const DspSideTabs = ({ active, onSelect, enabled }: IDspSideTabsProps) => {
  const { t } = useTranslation();
  return (
    <nav className="dsp-rail" aria-label={t('dsp.title')}>
      {SECTIONS.map(({ id, labelKey }, index) => (
        <button
          key={id}
          type="button"
          className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
            enabled[id] ? ' is-on' : ''
          }`}
          aria-current={id === active ? 'true' : undefined}
          onClick={() => onSelect(id)}
        >
          <span className="dsp-rail-step" aria-hidden="true">
            {index + 1}
          </span>
          <span className="dsp-rail-name">{t(labelKey)}</span>
          <span
            className="dsp-rail-lamp"
            aria-hidden="true"
            title={enabled[id] ? t('dsp.enabled') : undefined}
          />
        </button>
      ))}
    </nav>
  );
};

export default DspSideTabs;
