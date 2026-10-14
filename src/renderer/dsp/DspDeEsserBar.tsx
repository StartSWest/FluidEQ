/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDeEsserSettings, TDeEsserMode } from '../../common/dsp/deEsser';
import {
  DE_ESSER_PRESET_GROUPS,
  IDeEsserPreset,
  TDeEsserPresetGroup,
} from '../../common/dsp/deEsserPresets';
import { DE_ESSER_CATALOGUE } from '../../common/dsp/stageCatalogues';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import useStagePresets from './useStagePresets';

interface IDspDeEsserBarProps {
  deEsser: IDeEsserSettings;
  onChange: (next: IDeEsserSettings) => void;
  onCommit: () => void;
}

/** Written out whole: the dead-keys guard reads keys, not templates. */
const GROUP_KEYS: Record<TDeEsserPresetGroup, TranslationKey> = {
  music: 'dsp.deEsserPresetGroup.music',
  speech: 'dsp.deEsserPresetGroup.speech',
};

export const DE_ESSER_MODE_KEYS: Record<TDeEsserMode, TranslationKey> = {
  spectral: 'dsp.deEsser.mode.spectral',
  treble: 'dsp.deEsser.mode.treble',
  whole: 'dsp.deEsser.mode.whole',
};

const isGroup = (group: string | undefined): group is TDeEsserPresetGroup =>
  (DE_ESSER_PRESET_GROUPS as readonly string[]).includes(group ?? '');

/**
 * Processor-local profiles, on the same picker as every other stage.
 *
 * Choosing one starts the stage as well as loading its sound; the chains
 * that set this stage decide for themselves whether it runs.
 */
const DspDeEsserBar = ({
  deEsser,
  onChange,
  onCommit,
}: IDspDeEsserBarProps) => {
  const { t } = useTranslation();
  const saved = useStagePresets('deEsser', deEsser, onChange, onCommit);

  /**
   * The three things that tell one profile from another, derived rather than
   * written as a sentence, so the menu cannot go on describing a profile
   * after somebody retunes it: how deep it may cut (the figure each is known
   * by), how, and where it listens.
   */
  const profileHint = (preset: IDeEsserPreset): string =>
    [
      t('dsp.deEsser.upTo', {
        db: `−${preset.settings.rangeDb.toFixed(0)} dB`,
      }),
      t(DE_ESSER_MODE_KEYS[preset.settings.mode]),
      preset.settings.centreOnly
        ? t('dsp.deEsser.where.centre')
        : t('dsp.deEsser.where.all'),
    ].join(' · ');

  const factoryEntries: IRichPickEntry[] = DE_ESSER_PRESET_GROUPS.flatMap(
    (group) =>
      DE_ESSER_CATALOGUE.profiles
        .filter((preset) => preset.group === group)
        .map((preset) => ({
          id: preset.id,
          name: t(preset.labelKey as TranslationKey),
          hint: profileHint(preset),
          group,
          icon: <VoicingIcon className="rich-pick__glyph" />,
        })),
  );
  // Saved profiles first, as the EQ lists its own.
  const entries: IRichPickEntry[] = [...saved.entries, ...factoryEntries];
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (saved.apply(id)) {
      return;
    }
    const next = DE_ESSER_CATALOGUE.settings(
      id,
      enable ? true : deEsser.enabled,
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
    const current = ordered.indexOf(deEsser.presetId);
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
      <div className="dsp-eq-bar dsp-de-esser-bar">
        <div className="dsp-eq-preset dsp-eq-preset-first">
          <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
          <RichPick
            entries={entries}
            groupLabel={(group) =>
              saved.savedGroupLabel(group) ??
              (isGroup(group) ? t(GROUP_KEYS[group]) : '')
            }
            activeId={deEsser.presetId}
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

        {/* Reset goes to Vocal music, which is the stage's own defaults: the
            sound switching the stage on gives. It keeps the switch as it is. */}
        <div className="dsp-eq-transfer">
          <button
            type="button"
            className="button small subtle"
            onClick={() => applyPreset('vocalMusic', false)}
          >
            <DspBarIcon name="reset" />
            {t('dsp.eqPreset.reset')}
          </button>
          {saved.buttons}
        </div>
      </div>

      <p className="dsp-de-esser-note">{t('dsp.deEsser.description')}</p>

      {saved.notice}

      {saved.dialog}
    </>
  );
};

export default DspDeEsserBar;
