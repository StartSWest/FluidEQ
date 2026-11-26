/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMaximizerSettings } from '../../common/dsp/chain';
import { MAXIMIZER_PRESET_GROUPS } from '../../common/dsp/maximizerPresets';
import { MAXIMIZER_CATALOGUE } from '../../common/dsp/stageCatalogues';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import { maximizerFigures } from './stageFigures';
import useStagePresets from './useStagePresets';
import { scopedGroups, useDspPresetScope } from './presetScope';

interface IDspMaximizerBarProps {
  maximizer: IMaximizerSettings;
  onChange: (next: IMaximizerSettings) => void;
  onCommit: () => void;
}

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
  const saved = useStagePresets('maximizer', maximizer, onChange, onCommit);
  const scope = useDspPresetScope();
  const factoryEntries: IRichPickEntry[] = scopedGroups(
    MAXIMIZER_PRESET_GROUPS,
    scope,
  ).flatMap((group) =>
    MAXIMIZER_CATALOGUE.profiles
      .filter((preset) => preset.group === group)
      .map((preset) => ({
        id: preset.id,
        name: t(preset.labelKey as TranslationKey),
        hint: maximizerFigures(preset.settings),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      })),
  );
  // Saved profiles first, as the EQ lists its own.
  const entries: IRichPickEntry[] = [...saved.entries, ...factoryEntries];
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (saved.apply(id)) {
      return;
    }
    const next = MAXIMIZER_CATALOGUE.settings(
      id,
      enable ? true : maximizer.enabled,
    );
    if (next === undefined) {
      return;
    }
    onChange(next);
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
    <>
      <div className="dsp-eq-bar dsp-maximizer-bar">
        <div className="dsp-eq-preset dsp-eq-preset-first">
          <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
          <RichPick
            entries={entries}
            groupLabel={(group) =>
              saved.savedGroupLabel(group) ??
              (group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : '')
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

        <div className="dsp-eq-transfer">
          <button
            type="button"
            className="button small subtle"
            title={t('dsp.eqPreset.reset')}
            onClick={() => applyPreset('safety', false)}
          >
            <DspBarIcon name="reset" />
            {t('dsp.eqPreset.reset')}
          </button>
          {saved.buttons}
        </div>
      </div>

      {/* What the processor is, on a full line under the controls rather than
          as the card's description — the same arrangement the Exciter's bar
          uses, so the two headers read alike. */}
      <p className="dsp-maximizer-note">{t('dsp.maximizer.description')}</p>
      {saved.notice}
      {saved.dialog}
    </>
  );
};

export default DspMaximizerBar;
