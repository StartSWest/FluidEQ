/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBassForgeSettings } from '../../common/dsp/chain';
import {
  BASS_FORGE_PRESETS,
  BASS_FORGE_PRESET_GROUPS,
  IBassForgePreset,
  bassForgePresetSettings,
  isBassForgePresetId,
} from '../../common/dsp/bassForgePresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspBassForgeBarProps {
  bassForge: IBassForgeSettings;
  onChange: (next: IBassForgeSettings) => void;
  onCommit: () => void;
}

/**
 * The five figures that separate one profile from another.
 *
 * Derived rather than written out, for the reason every hint in this rack is:
 * a sentence describing a profile survives somebody changing the profile, and
 * the menu lies from then on.
 *
 * `splitHz` is deliberately absent — the whole catalogue sits at 80, 90 or 100
 * and a column that says the same thing eighteen times would push the parts
 * that actually differ off the end of the line. Texture is NOT absent, even
 * though it looks like a variant of drive: it picks the recipe the presence
 * harmonics are built from, drive pushes whatever that recipe produced into
 * the saturator, and `hot` against `round` is exactly the pair that cannot be
 * told apart without both numbers.
 */
const profileHint = (preset: IBassForgePreset): string =>
  [
    // Sub and Presence are plain numbers rather than percentages, and Mix
    // stays a percentage, because that is what each one is: the two amounts
    // reach 2 and say how much content the generators make relative to the
    // band, while Mix is a fraction of what they made. Rendering `1.85` as
    // "185%" both reads as a mistake and disagrees with the dial beneath it.
    preset.settings.subAmount.toFixed(2),
    preset.settings.presenceAmount.toFixed(2),
    preset.settings.texture.toFixed(2),
    `+${preset.settings.driveDb.toFixed(1)} dB`,
    `${Math.round(preset.settings.mix * 100)}%`,
  ].join(' · ');

/**
 * Processor-local profiles, presented with the same picker as the EQ, the
 * Exciter, the Maximizer and Dimension.
 *
 * Choosing one here starts the processor as well as loading the sound. The
 * shared preset builder still accepts bypass explicitly for whole-chain
 * recipes, which decide for themselves whether this stage participates.
 */
const DspBassForgeBar = ({
  bassForge,
  onChange,
  onCommit,
}: IDspBassForgeBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = BASS_FORGE_PRESET_GROUPS.flatMap((group) =>
    BASS_FORGE_PRESETS.filter((preset) => preset.group === group).map(
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
    if (!isBassForgePresetId(id)) {
      return;
    }
    onChange(bassForgePresetSettings(id, enable ? true : bassForge.enabled));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(bassForge.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-bass-forge-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={bassForge.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* The same plain directional controls the other four pickers have,
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

      {/* Reset goes to `default`, which is this catalogue's own baseline: the
          shipping DSP defaults are every amount at zero, so resetting to them
          would leave a stage that is switched on and doing nothing. */}
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

      {/* What the processor is, as the bar's own last line rather than as the
          card's description — the same arrangement the Exciter's, Maximizer's
          and Dimension's bars use, so the headers read alike. */}
      <p className="dsp-bass-forge-note">{t('dsp.bassForge.description')}</p>
    </div>
  );
};

export default DspBassForgeBar;
