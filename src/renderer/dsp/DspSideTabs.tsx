/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import DspSectionIcon from './DspSectionIcon';
import { DSP_SECTIONS, TDspSection } from './sections';

interface IDspSideTabsProps {
  active: TDspSection;
  onSelect: (section: TDspSection) => void;
  /** Which processors are switched on, so the rail can show it at a glance. */
  enabled: Record<TDspSection, boolean>;
}

/**
 * The rail down the side of the DSP page, one entry per processor.
 *
 * Stacking every processor on one scrolling page put four cards and forty-one
 * knobs in front of someone who wanted to move one — the EQ alone was eighteen
 * of them. One processor at a time, each with the whole page, is what every
 * plugin host does and for the same reason.
 *
 * The lamp is the processor's own enabled state, not the selection. Reading
 * "which of these are doing something" has to be possible without visiting
 * each one, or the rail is just four words.
 */
const DspSideTabs = ({ active, onSelect, enabled }: IDspSideTabsProps) => {
  const { t } = useTranslation();
  return (
    <nav className="dsp-rail" aria-label={t('dsp.title')}>
      {DSP_SECTIONS.map(({ id, labelKey }) => (
        <button
          key={id}
          type="button"
          className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
            enabled[id] ? ' is-on' : ''
          }`}
          aria-current={id === active ? 'true' : undefined}
          // The name is hidden by CSS on a narrow window, so the button would
          // be left with nothing an assistive reader could announce.
          title={t(labelKey)}
          onClick={() => onSelect(id)}
        >
          <DspSectionIcon section={id} />
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
