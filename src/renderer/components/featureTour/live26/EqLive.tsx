/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, useState } from 'react';
import type { TranslationKey } from '../../../../common/i18n';
import { DSP_PRESETS } from '../../../../common/dsp/presets';
import {
  dspPresetName,
  dspPresetRowHint,
  type IDspCatalogEntry,
} from '../../../dsp/dspPresetCatalog';
import PresetTile from '../../../eq/presetCard/PresetTile';
import usePresetCurveDesign from '../../../eq/presetCard/usePresetCurveDesign';
import MenuIcon, { type MenuIconName } from '../../../icons/MenuIcon';
import { useTranslation } from '../../../utils/I18nContext';
import useTourFrames from '../useTourFrames';

const nothing = () => undefined;

/** The factory presets shown, in the order the cards stand. */
const SHOWN = [
  'warm',
  'punch',
  'clarity',
  'music',
  'expansive',
  'movie',
  'car',
];
/** A pick every few seconds, walking the cards as a listener would. */
const PICK_SECONDS = 2.6;
const PICKED = ['punch', 'clarity', 'warm', 'expansive'];

/** The tab's groups down its side, with made-up counts of the reader's own. */
const GROUPS: readonly { id: string; label: TranslationKey; count: number }[] =
  [
    { id: 'saved', label: 'dsp.eqPreset.saved', count: 3 },
    { id: 'favorites', label: 'dsp.favorites.title', count: 5 },
    { id: 'classic', label: 'dsp.quick.classics', count: 17 },
    { id: 'genre', label: 'voicing.groupGenre', count: 96 },
  ];

const TABS: readonly {
  id: string;
  icon: MenuIconName;
  label: TranslationKey;
}[] = [
  { id: 'bands', icon: 'eqBars', label: 'eq.tabs.bands' },
  { id: 'preset', icon: 'genre', label: 'eq.tabs.preset' },
  { id: 'tone', icon: 'waveform', label: 'eq.tone' },
];

/**
 * The EQ page's Preset tab under its row of three tabs: the groups down its
 * side, Yours first, where New preset is, and the classics' cards, each
 * drawing its curve along its foot, with a pick walking from card to card
 * and the Preset tab naming what plays. The cards are the page's own
 * (`PresetTile`), drawn in the reader's curve design; the presets are the
 * factory's only, never the reader's own. The tab row and the groups are
 * the page's markup, because the page's own read the reader's presets.
 */
export default function EqLive() {
  const { t } = useTranslation();
  const design = usePresetCurveDesign();
  const presets = useMemo<IDspCatalogEntry[]>(
    () =>
      SHOWN.flatMap((id) => {
        const preset = DSP_PRESETS.find((one) => one.id === id);
        return preset ? [{ ...preset, name: dspPresetName(preset, t) }] : [];
      }),
    [t],
  );
  const [picked, setPicked] = useState(PICKED[0]);
  useTourFrames(
    (seconds) => {
      const next = PICKED[Math.floor(seconds / PICK_SECONDS) % PICKED.length];
      setPicked((before) => (before === next ? before : next));
    },
    { fps: 4, still: 0 },
  );
  const playing = presets.find((preset) => preset.id === picked);
  const meta: Record<string, string> = {
    bands: '15',
    preset: playing?.name ?? '',
    tone: t('eq.tabs.toneOff'),
  };

  return (
    <div className="tour-live26-eq">
      <div className="eq-layer-tabs">
        <div className="eq-layer-tabs__list" role="tablist">
          {TABS.map((tab) => (
            <span
              key={tab.id}
              role="tab"
              className="eq-layer-tabs__tab"
              aria-selected={tab.id === 'preset'}
            >
              <MenuIcon name={tab.icon} className="eq-toolbar__icon" />
              <span className="eq-layer-tabs__word">{t(tab.label)}</span>
              <span
                className={`eq-layer-tabs__meta${
                  tab.id === 'tone' ? ' is-off' : ''
                }`}
              >
                {meta[tab.id]}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="eq-preset-tab">
        <nav className="eq-preset-tab__groups">
          {GROUPS.map((group) => (
            <span
              key={group.id}
              className="eq-preset-tab__group"
              aria-pressed={group.id === 'classic'}
            >
              <span>{t(group.label)}</span>
              <span className="eq-preset-tab__count">{group.count}</span>
            </span>
          ))}
        </nav>
        <div className="eq-preset-tab__list">
          <div className="eq-preset-tab__head">
            <strong>{t('dsp.quick.classics')}</strong>
            <span>{t('eq.preset.count', { count: presets.length })}</span>
          </div>
          <div className="eq-preset-tab__grid">
            {presets.map((preset) => (
              <PresetTile
                key={preset.id}
                preset={preset}
                hint={dspPresetRowHint(preset, t)}
                isPlaying={preset.id === picked}
                isDisabled={false}
                isFavourite={preset.id === 'warm'}
                starLabel={t('library.playlist.addToFavorites')}
                design={design}
                onToggleStar={nothing}
                onApply={nothing}
                onPoint={nothing}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
