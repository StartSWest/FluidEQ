/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The preset pick of a Mic tab stage of its own (the low cut, the cleaner,
 * the gate, Voice level): the DSP stages' bar, its picker and its arrows,
 * with the stage's mic presets alone in it. It shows the preset the stage's
 * dials are on, or Custom once one moves (`micStagePresetOf`).
 */

import {
  IMicStagePreset,
  IMicStageValues,
  MIC_STAGE_PRESETS,
  micStagePresetOf,
  TMicPresetStage,
} from '../../common/mic/micStagePresets';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';

interface IMicPresetBarProps<S extends TMicPresetStage> {
  stage: S;
  values: IMicStageValues[S];
  /** The figures that tell one preset from another, for its hint. */
  hint: (values: IMicStageValues[S]) => string;
  onPick: (values: IMicStageValues[S]) => void;
}

const MicPresetBar = <S extends TMicPresetStage>({
  stage,
  values,
  hint,
  onPick,
}: IMicPresetBarProps<S>) => {
  const { t } = useTranslation();
  const presets = MIC_STAGE_PRESETS[stage] as readonly IMicStagePreset<S>[];
  const active = micStagePresetOf(stage, values);
  const entries: IRichPickEntry[] = presets.map((preset) => ({
    id: preset.id,
    name: t(preset.labelKey),
    hint: hint(preset.values),
    group: 'mic',
    icon: <VoicingIcon className="rich-pick__glyph" />,
  }));

  const pick = (id: string) => {
    const found = presets.find((preset) => preset.id === id);
    if (found) {
      onPick(found.values);
    }
  };
  const step = (direction: -1 | 1) => {
    const at = active ? presets.indexOf(active) : -1;
    const next =
      at < 0
        ? presets[direction > 0 ? 0 : presets.length - 1]
        : presets[(at + direction + presets.length) % presets.length];
    if (next) {
      onPick(next.values);
    }
  };

  return (
    <div className="dsp-eq-bar mic-preset-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={() => t('dsp.eqPresetGroup.mic')}
          activeId={active?.id ?? ''}
          onPick={pick}
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
    </div>
  );
};

export default MicPresetBar;
