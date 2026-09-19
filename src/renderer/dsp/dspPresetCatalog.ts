/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { IDspSettings, clampDspSettings } from '../../common/dsp/chain';
import {
  DSP_PRESETS,
  chainRoom,
  dspPresetSettings,
} from '../../common/dsp/presets';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';
import {
  DSP_PRESETS_CHANGED,
  readFavouriteDspPresets,
} from './favouriteDspPresets';
import { findUserDspPreset, readUserDspPresets } from './userDspPresets';

export interface IDspCatalogEntry {
  id: string;
  name: string;
  settings: IDspSettings;
  group: string;
}

export const dspPresetCatalog = (t: Translate): IDspCatalogEntry[] => [
  ...readUserDspPresets().map((preset) => ({ ...preset, group: 'saved' })),
  ...DSP_PRESETS.map((preset) => ({
    ...preset,
    name: `${t(preset.labelKey as TranslationKey)}${preset.withRoom ? ` · ${t('dsp.room.title')}` : ''}`,
  })),
];

export const dspPresetHint = (settings: IDspSettings, t: Translate): string =>
  [
    settings.normalizer.mode !== 'off' ? t('dsp.normalizer.title') : '',
    settings.denoise.enabled ? t('dsp.denoise.title') : '',
    settings.exciter.enabled ? t('dsp.exciter.title') : '',
    settings.bassForge.enabled ? t('dsp.bassForge.title') : '',
    settings.eq.enabled ? t('dsp.eq.title') : '',
    settings.bassPunch.enabled ? t('dsp.bassPunch.title') : '',
    settings.room.enabled ? t('dsp.room.title') : '',
    settings.dimension.enabled ? t('dsp.dimension.title') : '',
    settings.compressor.enabled ? t('dsp.compressor.title') : '',
    settings.maximizer.enabled ? t('dsp.maximizer.title') : '',
    settings.master.enabled ? t('dsp.master.title') : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** Both pickers resolve the same saved chain, preserving listener preferences. */
export const resolveDspPreset = (
  id: string,
  current: IDspSettings,
): IDspSettings | undefined => {
  if (id === 'none') {
    return { ...current, enabled: false, gameMode: false };
  }
  const saved = findUserDspPreset(id);
  return saved
    ? clampDspSettings({
        ...saved.settings,
        enabled: true,
        presetId: saved.id,
        gameMode: saved.settings.gameMode,
        crossfade: current.crossfade,
        surround: current.surround,
        room: chainRoom(current.room, saved.settings.room),
      })
    : dspPresetSettings(id, current);
};

export const useDspPresetCatalog = (t: Translate) => {
  const [, invalidate] = useState(0);
  useEffect(() => {
    const changed = () => invalidate((revision) => revision + 1);
    window.addEventListener(DSP_PRESETS_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(DSP_PRESETS_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);
  const catalog = dspPresetCatalog(t);
  const favorites = readFavouriteDspPresets().flatMap((id) => {
    const preset = catalog.find((one) => one.id === id);
    return preset ? [preset] : [];
  });
  return { catalog, favorites };
};
