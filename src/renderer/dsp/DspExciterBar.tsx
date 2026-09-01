/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  EXCITER_PRESETS,
  EXCITER_PRESET_GROUPS,
  exciterPresetSettings,
  isExciterPresetId,
} from '../../common/dsp/exciterPresets';
import {
  EQ_STEREO_MODES,
  IExciterSettings,
  TEqStereo,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import SegmentedControl from '../widgets/SegmentedControl';

interface IDspExciterBarProps {
  exciter: IExciterSettings;
  onChange: (next: IExciterSettings) => void;
  onCommit: () => void;
}

const BAND_LABELS: readonly TranslationKey[] = [
  'dsp.exciter.band.low',
  'dsp.exciter.band.mid',
  'dsp.exciter.band.high',
];

/** A preset's audible sections, derived from the settings that are applied. */
const profileHint = (
  preset: (typeof EXCITER_PRESETS)[number],
  t: ReturnType<typeof useTranslation>['t'],
): string => {
  if (preset.id === 'none') {
    return t('dsp.eqPreset.reset');
  }
  const parts = preset.settings.bands.flatMap((band, index) =>
    band.enabled && BAND_LABELS[index] ? [t(BAND_LABELS[index])] : [],
  );
  if (preset.settings.stereo !== 'stereo') {
    parts.unshift(
      t(`dsp.eqStereo.${preset.settings.stereo}` as TranslationKey),
    );
  }
  if (preset.settings.organic.enabled) {
    parts.push(t('dsp.exciter.organic'));
  }
  if (preset.settings.align.enabled) {
    parts.push(t('dsp.exciter.align'));
  }
  return parts.join(' · ');
};

/**
 * Processor-local profiles, presented with the same picker as the EQ.
 *
 * Choosing one here starts the processor as well as loading the sound. The
 * shared preset builder still accepts an explicit bypass state so a whole-chain
 * recipe can omit this stage without changing the local picker contract.
 */
const DspExciterBar = ({
  exciter,
  onChange,
  onCommit,
}: IDspExciterBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = EXCITER_PRESET_GROUPS.flatMap((group) =>
    EXCITER_PRESETS.filter((preset) => preset.group === group).map(
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

  const applyPreset = (id: string) => {
    if (!isExciterPresetId(id)) {
      return;
    }
    onChange(exciterPresetSettings(id, true));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(exciter.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-exciter-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={exciter.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* Same plain directional controls as the EQ preset picker. */}
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
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">{t('dsp.eqStereo.label')}</span>
        <SegmentedControl
          name={t('dsp.eqStereo.label')}
          value={exciter.stereo}
          options={EQ_STEREO_MODES.map((mode) => ({
            value: mode,
            label: t(`dsp.eqStereo.${mode}` as TranslationKey),
          }))}
          onChange={(next: string) => {
            onChange({
              ...exciter,
              stereo: next as TEqStereo,
              presetId: '',
            });
            onCommit();
          }}
        />
      </div>

      {/* What the processor is, as the bar's own last line rather than as the
          card's description. As a description it was 441px of prose holding the
          position the EQ gives its preset picker, and it left this bar's two
          controls wrapping onto a second row in the space that was left. */}
      <p className="dsp-exciter-note">{t('dsp.exciter.description')}</p>
    </div>
  );
};

export default DspExciterBar;
