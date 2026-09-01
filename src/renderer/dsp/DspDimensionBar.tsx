/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDimensionSettings } from '../../common/dsp/chain';
import {
  DIMENSION_PRESETS,
  DIMENSION_PRESET_GROUPS,
  IDimensionPreset,
  dimensionPresetSettings,
  isDimensionPresetId,
} from '../../common/dsp/dimensionPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspDimensionBarProps {
  dimension: IDimensionSettings;
  onChange: (next: IDimensionSettings) => void;
  onCommit: () => void;
}

/**
 * The three widths and the spread, in the order the dials sit on the page.
 *
 * Derived rather than written out, for the reason every hint in this rack is:
 * a sentence describing a profile survives somebody changing the profile, and
 * the menu lies from then on. The crossover corners are deliberately left out —
 * they are the same in almost every profile and would push the part that
 * actually differs off the end of the line.
 */
const profileHint = (preset: IDimensionPreset): string =>
  [
    `${preset.settings.lowWidth.toFixed(2)}x`,
    `${preset.settings.midWidth.toFixed(2)}x`,
    `${preset.settings.highWidth.toFixed(2)}x`,
    `${Math.round(preset.settings.decorrelation * 100)}%`,
  ].join(' · ');

/**
 * Processor-local profiles, presented with the same picker as the EQ, the
 * Exciter and the Maximizer.
 *
 * Choosing one here starts the processor as well as loading the sound. The
 * shared preset builder still accepts bypass explicitly for whole-chain
 * recipes, which decide for themselves whether this stage participates.
 */
const DspDimensionBar = ({
  dimension,
  onChange,
  onCommit,
}: IDspDimensionBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = DIMENSION_PRESET_GROUPS.flatMap((group) =>
    DIMENSION_PRESETS.filter((preset) => preset.group === group).map(
      (preset) => ({
        id: preset.id,
        name: t(preset.labelKey as TranslationKey),
        hint: profileHint(preset),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      }),
    ),
  );
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (!isDimensionPresetId(id)) {
      return;
    }
    onChange(dimensionPresetSettings(id, enable ? true : dimension.enabled));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(dimension.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-dimension-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={dimension.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* The same plain directional controls the other three pickers have,
            and for the same reason: auditioning profiles is the one thing
            anybody does here repeatedly, and a menu makes that open-aim-click
            every time. */}
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

      {/* Reset goes to `neutral` rather than to the shipping default: on this
          stage the useful reference is the picture the record already had, and
          that is unity at every band. */}
      <div className="dsp-eq-transfer dsp-eq-reset">
        <button
          type="button"
          className="button small subtle"
          onClick={() => applyPreset('neutral', false)}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
      </div>

      <p className="dsp-dimension-note">{t('dsp.dimension.monoNote')}</p>
    </div>
  );
};

export default DspDimensionBar;
