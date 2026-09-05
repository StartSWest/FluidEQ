/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import DspSectionIcon from './DspSectionIcon';
import { DSP_PLAYBACK_SECTIONS, DSP_SECTIONS, TDspSection } from './sections';

interface IDspSideTabsProps {
  active: TDspSection;
  onSelect: (section: TDspSection) => void;
  /** Which processors are switched on, so the rail can show it at a glance. */
  enabled: Record<TDspSection, boolean>;
  /** Root bypass disables filter pages, but never the playback transition. */
  filtersDisabled: boolean;
  /** Transitions belong to Library playback, including its browser fallback. */
  playbackDisabled: boolean;
}

/**
 * The rail down the side of the DSP page: filters in signal order, followed by
 * the player transition in its own group.
 *
 * Stacking every processor on one scrolling page put four cards and forty-one
 * knobs in front of someone who wanted to move one — the EQ alone was eighteen
 * of them. One processor at a time, each with the whole page, is what every
 * plugin host does and for the same reason.
 *
 * The lamp is the processor's own enabled state, not the selection. Reading
 * "which of these are doing something" has to be possible without visiting
 * each one, or the rail is just a list of names.
 */
const DspSideTabs = ({
  active,
  onSelect,
  enabled,
  filtersDisabled,
  playbackDisabled,
}: IDspSideTabsProps) => {
  const { t } = useTranslation();
  const renderTab = ({ id, labelKey }: (typeof DSP_SECTIONS)[number]) => (
    <button
      key={id}
      type="button"
      className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
        enabled[id] ? ' is-on' : ''
      }`}
      aria-current={id === active ? 'true' : undefined}
      disabled={id === 'crossfade' ? playbackDisabled : filtersDisabled}
      // The name is hidden by CSS on a narrow window, so the button would be
      // left with nothing an assistive reader could announce.
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
  );

  return (
    <nav className="dsp-rail" aria-label={t('dsp.title')}>
      <div className="dsp-rail-processors">{DSP_SECTIONS.map(renderTab)}</div>
      <div className="dsp-rail-playback">
        <span className="dsp-rail-group-label">
          {t('library.playbackOptions')}
        </span>
        {DSP_PLAYBACK_SECTIONS.map(renderTab)}
      </div>
    </nav>
  );
};

export default DspSideTabs;
