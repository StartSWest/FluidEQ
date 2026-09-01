/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMaximizerSettings } from '../../common/dsp/chain';
import {
  IMaximizerPreset,
  MAXIMIZER_PRESETS,
  MAXIMIZER_PRESET_GROUPS,
  isMaximizerPresetId,
  maximizerPresetSettings,
} from '../../common/dsp/maximizerPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspMaximizerBarProps {
  maximizer: IMaximizerSettings;
  onChange: (next: IMaximizerSettings) => void;
  onCommit: () => void;
}

/**
 * The four figures, in the order the dials sit on the page.
 *
 * Derived rather than written out, for the reason every hint in this rack is:
 * a sentence describing a profile survives somebody changing the profile, and
 * the menu simply lies from then on. These cannot be wrong unless the profile
 * is. They are also what actually separates two entries here — a limiter has
 * no curve to look at, so the numbers ARE the difference.
 */
const profileHint = (preset: IMaximizerPreset): string =>
  [
    `${preset.settings.driveDb > 0 ? '+' : ''}${preset.settings.driveDb.toFixed(1)} dB`,
    `${preset.settings.ceilingDb.toFixed(1)} dBTP`,
    `${preset.settings.lookAheadMs} ms`,
    `${preset.settings.releaseMs} ms`,
  ].join(' · ');

/**
 * Processor-local profiles, presented with the same picker as the EQ and the
 * Exciter.
 *
 * Choosing one here starts the processor as well as loading the sound. The
 * shared preset builder still accepts bypass explicitly for whole-chain
 * recipes, which decide for themselves whether this stage participates.
 */
const DspMaximizerBar = ({
  maximizer,
  onChange,
  onCommit,
}: IDspMaximizerBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = MAXIMIZER_PRESET_GROUPS.flatMap((group) =>
    MAXIMIZER_PRESETS.filter((preset) => preset.group === group).map(
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
    if (!isMaximizerPresetId(id)) {
      return;
    }
    onChange(maximizerPresetSettings(id, enable ? true : maximizer.enabled));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(maximizer.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-maximizer-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={maximizer.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* Same plain directional controls as the other two pickers, and for
            the same reason: auditioning profiles is the one thing anybody does
            here repeatedly, and a menu makes that open-aim-click every time. */}
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
          onClick={() => applyPreset('safety', false)}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
      </div>

      {/* What the processor is, as the bar's own last line rather than as the
          card's description — the same arrangement the Exciter's bar uses, so
          the two headers read alike. */}
      <p className="dsp-maximizer-note">{t('dsp.maximizer.description')}</p>
    </div>
  );
};

export default DspMaximizerBar;
