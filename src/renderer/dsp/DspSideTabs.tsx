/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import DspRailRow from './DspRailRow';
import DspSectionIcon from './DspSectionIcon';
import {
  DSP_LEVEL_SECTIONS,
  DSP_OUTPUT_SECTIONS,
  DSP_PLAYBACK_SECTIONS,
  DSP_SECTIONS,
  TDspSection,
} from './sections';

interface IDspSideTabsProps {
  active: TDspSection;
  onSelect: (section: TDspSection) => void;
  /** Which processors are switched on, so the rail can show it at a glance. */
  enabled: Record<TDspSection, boolean>;
  /** A stage's own switch on its row: what the card's power switch does. */
  onToggle: (section: TDspSection) => void;
  /** Root bypass disables filter pages, but never the playback transition. */
  filtersDisabled: boolean;
  /** Transitions belong to Library playback, including its browser fallback. */
  playbackDisabled: boolean;
}

/**
 * The rail down the side of the DSP page: the source level in a group of its
 * own, the filters in signal order, the output level in a group of its own,
 * then the player transition in its own group. Those three groups are what no
 * preset sets.
 *
 * Stacking every processor on one scrolling page put four cards and forty-one
 * knobs in front of someone who wanted to move one — the EQ alone was eighteen
 * of them. One processor at a time, each with the whole page, is what every
 * plugin host does and for the same reason.
 *
 * Each row's switch is the processor's own enabled state, not the selection,
 * and turns it as the card's power switch does (`dspStageSwitch`). Reading
 * "which of these are doing something" has to be possible without visiting
 * each one, or the rail is just a list of names; folded to its glyphs, the
 * lamp on each glyph's corner says it.
 */
const DspSideTabs = ({
  active,
  onSelect,
  enabled,
  onToggle,
  filtersDisabled,
  playbackDisabled,
}: IDspSideTabsProps) => {
  const { t } = useTranslation();
  const renderTab = ({ id, labelKey }: (typeof DSP_SECTIONS)[number]) => {
    const disabled = id === 'crossfade' ? playbackDisabled : filtersDisabled;
    return (
      <DspRailRow
        key={id}
        name={t(labelKey)}
        isActive={id === active}
        isOff={!enabled[id]}
        power={{
          id: `dsp-rail-${id}`,
          isOn: enabled[id],
          // Out of reach exactly when the card's own switch is: the stage
          // area is inert then (`DspPanel`).
          isDisabled: disabled,
          onToggle: () => onToggle(id),
        }}
      >
        <button
          type="button"
          data-dsp-section={id}
          className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
            enabled[id] ? ' is-on' : ''
          }`}
          aria-current={id === active ? 'true' : undefined}
          disabled={disabled}
          // The name is hidden by CSS on a narrow window, so the button would
          // be left with nothing an assistive reader could announce.
          title={t(labelKey)}
          onClick={() => onSelect(id)}
        >
          <DspSectionIcon section={id} />
          {/* A word only the open rail says (`StudioRail`); folded to its
              glyphs, the title above names the button. */}
          <span className="dsp-rail-name studio-rail__word">{t(labelKey)}</span>
          {/* Seen only folded, on the glyph's corner, where the switch beside
              it has gone with the words. */}
          <span
            className="dsp-rail-lamp"
            aria-hidden="true"
            title={enabled[id] ? t('dsp.enabled') : undefined}
          />
        </button>
      </DspRailRow>
    );
  };

  return (
    <nav className="dsp-rail" aria-label={t('dsp.title')}>
      <div className="dsp-rail-level">
        <span className="dsp-rail-group-label">{t('dsp.rail.levelGroup')}</span>
        {DSP_LEVEL_SECTIONS.map(renderTab)}
      </div>
      {/* Named as the groups either side are: with no rule between them, a
          heading is what parts the filters from the source level above. A
          sibling of the rows, not their child one, so the rows' cascade
          (`stagger-in` on `.dsp-rail-processors > .dsp-rail-row`) still
          counts the filters alone. */}
      <span className="dsp-rail-group-label dsp-rail-filters-label">
        {t('dsp.rail.filtersGroup')}
      </span>
      <div className="dsp-rail-processors">{DSP_SECTIONS.map(renderTab)}</div>
      <div className="dsp-rail-output">
        <span className="dsp-rail-group-label">
          {t('dsp.rail.outputGroup')}
        </span>
        {DSP_OUTPUT_SECTIONS.map(renderTab)}
      </div>
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
