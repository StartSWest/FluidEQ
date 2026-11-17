/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import type { TranslationKey } from '../../common/i18n/en';
import '../styles/EqLayers.scss';
import {
  NONE_CHAIN_ID,
  activeDspPresetId,
  useDspPresetCatalog,
} from '../dsp/dspPresetCatalog';
import { useDspSettings } from '../dsp/store';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { EQ_LAYER_TABS, setEqLayerTab, type TEqLayerTab } from './eqLayerTab';
import useToolRowFit from './useToolRowFit';

const TAB_LABEL: Record<TEqLayerTab, TranslationKey> = {
  bands: 'eq.tabs.bands',
  preset: 'eq.tabs.preset',
  tone: 'eq.tone',
};

/** The id each tab's page carries, for `aria-controls`. */
export const eqLayerPanelId = (tab: TEqLayerTab) => `eq-layer-panel-${tab}`;
export const eqLayerTabId = (tab: TEqLayerTab) => `eq-layer-tab-${tab}`;

interface IEqLayerTabsProps {
  active: TEqLayerTab;
  bandCount: number;
  /** Anything on the Tone tab in use: a dial, or a cut (`toneCuts.ts`). */
  isToneOn: boolean;
  /**
   * Where the cuts that are on stand ("20 Hz"), said instead of On when the
   * cuts are all the Tone is doing.
   */
  toneCutCorners?: string;
  /** The open tab's tools, Clear EQ among them (`EqPageView`). */
  tools: ReactNode;
}

/**
 * The row under the EQ page's divider (Ivan, 2026-11-16, "One pane, inset
 * cards"): the three tabs on the left, each with what it holds now — how many
 * bands, which preset, whether the Tone is on — and on the right the open
 * tab's tools. It replaces the title row that stood above the graph with the
 * same tools in it.
 *
 * The tools are flat, a glyph and a word with no edge (Ivan, 2026-11-17, B1:
 * "grouped by job"), and the row is one line at every width: as it narrows
 * the groups' captions go, then the tools' words (`useToolRowFit`).
 */
const EqLayerTabs = ({
  active,
  bandCount,
  isToneOn,
  toneCutCorners,
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
    tone: isToneOn
      ? (toneCutCorners ?? t('eq.tabs.toneOn'))
      : t('eq.tabs.toneOff'),
  };
  const tabRefs = useRef<Partial<Record<TEqLayerTab, HTMLButtonElement>>>({});
  const row = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const toolBox = useRef<HTMLDivElement>(null);
  useToolRowFit(row, slot, toolBox);

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
    <div className="eq-layer-tabs" ref={row}>
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
      {/* The room the tabs leave, and the tools at its end, as wide as
          their content: the two widths are what the fit compares. */}
      <div className="eq-layer-tabs__slot" ref={slot}>
        <div className="eq-layer-tabs__tools" ref={toolBox}>
          {tools}
        </div>
      </div>
    </div>
  );
};

export default EqLayerTabs;
