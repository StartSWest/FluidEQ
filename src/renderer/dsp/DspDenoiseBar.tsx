/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDenoiseSettings } from '../../common/dsp/chain';
import {
  DENOISE_PRESETS,
  DENOISE_PRESET_GROUPS,
  IDenoisePreset,
  denoisePresetSettings,
  isDenoisePresetId,
} from '../../common/dsp/denoisePresets';
import { Translate } from '../../common/i18n';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspDenoiseBarProps {
  denoise: IDenoiseSettings;
  onChange: (next: IDenoiseSettings) => void;
  onCommit: () => void;
}

/** The modules a profile actually starts, derived from the applied settings. */
const profileHint = (preset: IDenoisePreset, t: Translate): string => {
  const modules = [
    preset.settings.hiss.enabled ? t('dsp.denoise.hiss') : '',
    preset.settings.hum.enabled ? t('dsp.denoise.hum') : '',
    preset.settings.click.enabled ? t('dsp.denoise.click') : '',
  ].filter(Boolean);
  const source = t(
    preset.settings.profileSource === 'adaptive'
      ? 'dsp.denoise.adaptive'
      : 'dsp.denoise.scanned',
  );
  return [source, ...modules].join(' · ');
};

const DspDenoiseBar = ({
  denoise,
  onChange,
  onCommit,
}: IDspDenoiseBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = DENOISE_PRESET_GROUPS.flatMap((group) =>
    DENOISE_PRESETS.filter((preset) => preset.group === group).map(
      (preset) => ({
        id: preset.id,
        name: t(preset.labelKey as TranslationKey),
        hint: profileHint(preset, t),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      }),
    ),
  );
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (!isDenoisePresetId(id)) {
      return;
    }
    onChange(denoisePresetSettings(id, enable ? true : denoise.enabled));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    const current = ordered.indexOf(denoise.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-denoise-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={denoise.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
          title={t('dsp.eqPreset.previous')}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.next')}
          title={t('dsp.eqPreset.next')}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>
      <div className="dsp-eq-transfer dsp-eq-reset">
        <button
          type="button"
          className="button small subtle"
          onClick={() => applyPreset('default', false)}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
      </div>
    </div>
  );
};

export default DspDenoiseBar;
