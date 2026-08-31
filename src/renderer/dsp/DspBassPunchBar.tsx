/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBassPunchSettings } from '../../common/dsp/chain';
import {
  BASS_PUNCH_PRESETS,
  BASS_PUNCH_PRESET_GROUPS,
  IBassPunchPreset,
  bassPunchPresetSettings,
  isBassPunchPresetId,
} from '../../common/dsp/bassPunchPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspBassPunchBarProps {
  bassPunch: IBassPunchSettings;
  onChange: (next: IBassPunchSettings) => void;
  onCommit: () => void;
}

/**
 * A bipolar figure with its sign always shown, so `0` reads as a centre.
 *
 * `+0.60` and `-0.15` are two directions from one rest position; `0.60` and
 * `-0.15` read as an amount next to a correction. Two decimals because the
 * catalogue uses them — `rock` sits at -0.15 and `dnb` at 0.9, and one decimal
 * would round the first into the second's neighbourhood.
 */
const signed = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

/**
 * The four figures that separate one profile from another.
 *
 * Derived rather than written out, for the reason every hint in this rack is:
 * a sentence describing a profile survives somebody changing the profile, and
 * the menu lies from then on.
 *
 * Attack and sustain carry an explicit sign, which is the one thing a reader
 * has to see here: they are the only bipolar figures in any of these
 * catalogues, and `0.60 · -0.15` says at a glance that `rock` hits harder and
 * decays shorter, where `0.60 · 0.15` would read as two amounts.
 *
 * `splitHz` is absent for the same reason Forge's is — the whole catalogue
 * sits at 90, 100 or 110, and a column that says the same thing fourteen times
 * would push the parts that actually differ off the end of the line. Bloom's
 * decay is absent too, but for a different reason: it is inert wherever the
 * amount is 0, and four of these profiles set exactly that.
 */
const profileHint = (preset: IBassPunchPreset): string =>
  [
    signed(preset.settings.attack),
    signed(preset.settings.sustain),
    `${Math.round(preset.settings.bloomAmount * 100)}%`,
    `${Math.round(preset.settings.duck * 100)}%`,
  ].join(' · ');

/**
 * Processor-local profiles, presented with the same picker as the EQ, the
 * Exciter, the Maximizer, Dimension and Bass Forge.
 *
 * Applying one preserves bypass, which is what lets a chain preset reference a
 * profile by id and still decide for itself whether this stage participates.
 */
const DspBassPunchBar = ({
  bassPunch,
  onChange,
  onCommit,
}: IDspBassPunchBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = BASS_PUNCH_PRESET_GROUPS.flatMap((group) =>
    BASS_PUNCH_PRESETS.filter((preset) => preset.group === group).map(
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

  const applyPreset = (id: string) => {
    if (!isBassPunchPresetId(id)) {
      return;
    }
    onChange(bassPunchPresetSettings(id, bassPunch.enabled));
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(bassPunch.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-bass-punch-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={bassPunch.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* The same plain directional controls the other five pickers have,
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
          shipping DSP defaults put attack and sustain at 0 and bloom and duck
          at nothing, so resetting to them would leave a stage that is switched
          on and shaping nothing. */}
      <div className="dsp-eq-transfer dsp-eq-reset">
        <button
          type="button"
          className="button small subtle"
          onClick={() => applyPreset('default')}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
      </div>

      {/* What the processor is, as the bar's own last line rather than as the
          card's description — the same arrangement the Exciter's, Maximizer's,
          Dimension's and Forge's bars use, so the headers read alike. */}
      <p className="dsp-bass-punch-note">{t('dsp.bassPunch.description')}</p>
    </div>
  );
};

export default DspBassPunchBar;
