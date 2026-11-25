/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, type ReactNode, useRef } from 'react';
import { MAX_GAIN, MIN_GAIN, MIN_NUM_FILTERS } from 'common/constants';
import FrequencyBand from '../../components/FrequencyBand';
import Switch from '../../widgets/Switch';
import EqModeTriggerFace from '../../components/eqMode/EqModeTriggerFace';
import WorkspaceSectionTabs from '../../components/WorkspaceSectionTabs';
import {
  EQ_SCALE_MARKS,
  eqScaleLabel,
  eqScaleMarkClass,
} from '../../eq/eqScaleMarks';
import useToolRowFit from '../../eq/useToolRowFit';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import {
  EQ_GROUP_ICONS,
  EQ_GROUP_LABEL_KEYS,
  EQ_GROUP_TABS,
} from '../../shell/workspaceGroups';
import { useTranslation } from '../../utils/I18nContext';
import { HELP_EQ_FILTERS } from './helpEqState';
import '../../styles/MainContent.scss';
import '../../styles/MultiSelect.scss';
import '../../styles/EqLayers.scss';

/**
 * The parts of the EQ page the Help figures draw (`eqPageFigures.tsx`), as
 * `EqPageView` and the shell lay them out.
 *
 * The section pills and the bands are the page's own components fed the
 * made-up EQ (`helpEqState`); the engine's name, Game mode and the delay,
 * and the tab row with its tools, are their markup, class for class, as
 * `FluidEngineLabel`, `ListenedLatency`, `EqLayerTabs`, `SaveEqMenu`,
 * `AutoEqButton` and the pinned EQ mode trigger draw them: those read the
 * reader's engine, presets, saved EQs and songs, and act on them. The tab
 * row keeps the page's own rule for what fits (`useToolRowFit`), so a long
 * language loses the tools' words before the row would run off.
 */

const nothing = () => undefined;

/** The section pills over the graph, and the engine's name beside them. */
export const HelpEqHead = () => {
  const { t } = useTranslation();
  return (
    <div className="center-head center-head--eq">
      <WorkspaceSectionTabs
        label={t('tabs.eq')}
        activeId="eq"
        tabs={EQ_GROUP_TABS.map((tab) => {
          const group = tab as keyof typeof EQ_GROUP_LABEL_KEYS;
          return {
            id: tab,
            label: t(EQ_GROUP_LABEL_KEYS[group]),
            icon: <MenuIcon name={EQ_GROUP_ICONS[group]} />,
          };
        })}
        onSelect={nothing}
      >
        <span className="eq-engine-chip">
          <span className="eq-engine-line eq-engine-line--working">
            <p className="eq-engine-label">{t('eq.fluidEngine')}</p>
            <span className="eq-engine-label__sweep" aria-hidden="true" />
          </span>
          <div className="engine-strip">
            <div className="game-mode-switch">
              <label
                htmlFor="help-eq-game-mode"
                className="game-mode-switch__label"
              >
                <VoicingIcon
                  profileId="games"
                  className="game-mode-switch__icon"
                />
                <span className="game-mode-switch__word">
                  {t('dsp.latency.gameMode')}
                </span>
              </label>
              <Switch
                id="help-eq-game-mode"
                isOn={false}
                isDisabled={false}
                handleToggle={nothing}
              />
            </div>
            <button type="button" className="latency-readout">
              <span className="latency-readout__name">
                {t('dsp.latency.label')}
              </span>
              <span className="latency-readout__value">
                {t('dsp.latency.ms', { ms: '12.7' })}
              </span>
            </button>
          </div>
        </span>
      </WorkspaceSectionTabs>
    </div>
  );
};

const Group = ({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) => (
  <div className="eq-tool-group" role="group">
    <span className="eq-tool-group__caption" aria-hidden="true">
      {caption}
    </span>
    <div className="eq-tool-group__tools">{children}</div>
  </div>
);

/** Your EQ's tools, as `EqPageView` lays them out. */
const BandTools = () => {
  const { t } = useTranslation();
  return (
    <>
      <Group caption={t('eq.tools.bands')}>
        <span className="eq-mode is-subtle quick-layouts">
          <button
            type="button"
            className="button small subtle eq-mode__main quick-layouts__trigger"
            aria-haspopup="dialog"
          >
            <MenuIcon name="layout" className="eq-toolbar__icon" />
            <span className="band-designs__current">
              {Object.keys(HELP_EQ_FILTERS).length}
            </span>
            <Chevron />
          </button>
        </span>
        <div role="button" className="button small subtle eq-toolbar__add">
          <MenuIcon name="plus" className="eq-toolbar__icon" />
          <span className="eq-toolbar__word">{t('eq.tools.add')}</span>
        </div>
        <button type="button" className="button small subtle clear-eq-trigger">
          <MenuIcon name="reset" className="eq-toolbar__icon" />
          <span className="eq-toolbar__word">{t('eq.tools.clear')}</span>
        </button>
        <button
          type="button"
          className="button small subtle eq-save-trigger"
          aria-haspopup="menu"
        >
          <span className="eq-save-trigger__glyph">
            <MenuIcon name="saveEq" className="eq-toolbar__icon" />
          </span>
          <span className="eq-toolbar__word eq-save-trigger__name">
            {t('eq.tools.saveEq')}
          </span>
        </button>
      </Group>
      <span className="eq-layer-tabs__rule" aria-hidden="true" />
      <Group caption={t('eq.tools.view')}>
        <span className="eq-mode is-subtle active-layers__picker">
          <button
            type="button"
            className="button small subtle eq-mode__main active-layers__trigger"
            aria-haspopup="menu"
          >
            <span className="active-layers__dots" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="eq-toolbar__word">{t('graph.curves')}</span>
            <Chevron />
          </button>
        </span>
        <div className="eq-toolbar__option">
          <button type="button" className="eq-mode-trigger">
            <EqModeTriggerFace customized={false} end={<Chevron />} />
          </button>
        </div>
      </Group>
      <span className="eq-mode eq-auto is-subtle">
        <button
          type="button"
          className="button small eq-mode__main subtle"
          aria-haspopup="dialog"
        >
          <MenuIcon name="smart" className="eq-toolbar__icon" />
          {t('autoEq.title')}
          <Chevron />
        </button>
      </span>
    </>
  );
};

/** The row of three tabs under the graph, with Your EQ's tools. */
export const HelpEqTabRow = () => {
  const { t } = useTranslation();
  const row = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const toolBox = useRef<HTMLDivElement>(null);
  useToolRowFit(row, slot, toolBox);
  const tabs = [
    {
      id: 'bands',
      icon: 'eqBars' as const,
      word: t('eq.tabs.bands'),
      meta: String(Object.keys(HELP_EQ_FILTERS).length),
    },
    {
      id: 'preset',
      icon: 'genre' as const,
      word: t('eq.tabs.preset'),
      meta: t('voicing.none'),
    },
    {
      id: 'tone',
      icon: 'waveform' as const,
      word: t('eq.tone'),
      meta: t('eq.tabs.toneOff'),
    },
  ];
  return (
    <div className="eq-layer-tabs" ref={row}>
      <div className="eq-layer-tabs__list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="eq-layer-tabs__tab"
            aria-selected={tab.id === 'bands'}
          >
            <MenuIcon name={tab.icon} className="eq-toolbar__icon" />
            <span className="eq-layer-tabs__word">{tab.word}</span>
            <span
              className={`eq-layer-tabs__meta${tab.id === 'tone' ? ' is-off' : ''}`}
            >
              {tab.meta}
            </span>
          </button>
        ))}
      </div>
      <div className="eq-layer-tabs__slot" ref={slot}>
        <div className="eq-layer-tabs__tools" ref={toolBox}>
          <BandTools />
        </div>
      </div>
    </div>
  );
};

const SORTED = Object.values(HELP_EQ_FILTERS).sort(
  (a, b) => a.frequency - b.frequency,
);

/**
 * Your EQ's page: the bands' sliders, each the page's own `FrequencyBand`,
 * and the dB scale beside the first. `children` stands in the panel before
 * the rail, where the band popover does.
 */
export const HelpEqBands = ({
  selected = [],
  children,
}: {
  selected?: readonly string[];
  children?: ReactNode;
}) => (
  <div className="main-content main-content--compact">
    {children}
    <div className="bands-rail">
      <div className="bands-rail__viewport">
        <div
          className="bands bands--compact"
          style={{ '--band-count': SORTED.length } as CSSProperties}
        >
          {SORTED.map((filter, index) => (
            <FrequencyBand
              key={filter.id}
              filter={filter}
              colorProgress={index / (SORTED.length - 1)}
              density="compact"
              flatLayout
              isSelected={selected.includes(filter.id)}
              isMinSliderCount={SORTED.length <= MIN_NUM_FILTERS}
            />
          ))}
        </div>
      </div>
    </div>
    <div className="eq-scale" aria-hidden="true">
      {EQ_SCALE_MARKS.map((gain) => (
        <span
          key={gain}
          className={`eq-scale__mark${eqScaleMarkClass(gain)}`}
          style={
            {
              '--at': (MAX_GAIN - gain) / (MAX_GAIN - MIN_GAIN),
            } as CSSProperties
          }
        >
          {eqScaleLabel(gain)}
        </span>
      ))}
    </div>
  </div>
);
