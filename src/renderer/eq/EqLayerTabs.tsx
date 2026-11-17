/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import type { TranslationKey } from '../../common/i18n/en';
import ClearEqButton from '../components/ClearEqButton';
import '../styles/EqLayers.scss';
import OutputRate from '../components/OutputRate';
import {
  NONE_CHAIN_ID,
  activeDspPresetId,
  useDspPresetCatalog,
} from '../dsp/dspPresetCatalog';
import { useDspSettings } from '../dsp/store';
import MenuIcon from '../icons/MenuIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { EQ_LAYER_TABS, setEqLayerTab, type TEqLayerTab } from './eqLayerTab';

const TAB_LABEL: Record<TEqLayerTab, TranslationKey> = {
  bands: 'eq.tabs.bands',
  preset: 'eq.tabs.preset',
  tone: 'eq.tone',
};

const TAB_ICON: Record<TEqLayerTab, 'eqBars' | 'genre' | 'waveform'> = {
  bands: 'eqBars',
  preset: 'genre',
  tone: 'waveform',
};

/** The id each tab's page carries, for `aria-controls`. */
export const eqLayerPanelId = (tab: TEqLayerTab) => `eq-layer-panel-${tab}`;
export const eqLayerTabId = (tab: TEqLayerTab) => `eq-layer-tab-${tab}`;

interface IEqLayerTabsProps {
  active: TEqLayerTab;
  bandCount: number;
  isToneOn: boolean;
  /** The open tab's own tools, before the one every tab has: Clear EQ. */
  tools: ReactNode;
}

/**
 * The row under the EQ page's divider (Ivan, 2026-11-16, "One pane, inset
 * cards"): the three tabs on the left, each with what it holds now — how many
 * bands, which preset, whether the Tone is on — and on the right the open
 * tab's tools, then Clear EQ, which undoes all three. It replaces the title
 * row that stood above the graph with the same tools in it.
 */
const EqLayerTabs = ({
  active,
  bandCount,
  isToneOn,
  tools,
}: IEqLayerTabsProps) => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { voicing } = useFluidEqLayers();
  const { catalog } = useDspPresetCatalog(t);
  const chosen = activeDspPresetId(settings, voicing);
  const presetName =
    chosen === undefined || chosen === NONE_CHAIN_ID
      ? t('voicing.none')
      : (catalog.find((preset) => preset.id === chosen)?.name ??
        t('dsp.eqPreset.custom'));
  const meta: Record<TEqLayerTab, string> = {
    bands: String(bandCount),
    preset: presetName,
    tone: t(isToneOn ? 'eq.tabs.toneOn' : 'eq.tabs.toneOff'),
  };
  const tabRefs = useRef<Partial<Record<TEqLayerTab, HTMLButtonElement>>>({});

  // The arrows walk the tabs and open the one they land on, as every tab row
  // does; Home and End go to either end.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = EQ_LAYER_TABS.indexOf(active);
    const last = EQ_LAYER_TABS.length - 1;
    const step: Record<string, number> = {
      ArrowRight: at === last ? 0 : at + 1,
      ArrowLeft: at === 0 ? last : at - 1,
      Home: 0,
      End: last,
    };
    const next = step[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    const tab = EQ_LAYER_TABS[next];
    setEqLayerTab(tab);
    tabRefs.current[tab]?.focus();
  };

  return (
    <div className="eq-layer-tabs">
      <div
        className="eq-layer-tabs__list"
        role="tablist"
        aria-label={t('eq.tabs.aria')}
      >
        {EQ_LAYER_TABS.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element ?? undefined;
            }}
            type="button"
            role="tab"
            id={eqLayerTabId(tab)}
            className="eq-layer-tabs__tab"
            aria-selected={tab === active}
            aria-controls={eqLayerPanelId(tab)}
            tabIndex={tab === active ? 0 : -1}
            onClick={() => setEqLayerTab(tab)}
            onKeyDown={onKeyDown}
          >
            <MenuIcon name={TAB_ICON[tab]} className="eq-layer-tabs__icon" />
            <span>{t(TAB_LABEL[tab])}</span>
            <span
              className={`eq-layer-tabs__meta${
                tab === 'tone' && !isToneOn ? ' is-off' : ''
              }`}
              title={meta[tab]}
            >
              {meta[tab]}
            </span>
          </button>
        ))}
      </div>
      {/* The output's rate stays where the page's title used to show it. */}
      <OutputRate />
      <div className="eq-layer-tabs__tools">
        {tools}
        <span className="eq-layer-tabs__rule" aria-hidden="true" />
        {/* Last: the one tool that undoes everything the others did. */}
        <ClearEqButton />
      </div>
    </div>
  );
};

export default EqLayerTabs;
