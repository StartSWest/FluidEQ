/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_DEFAULTS,
  IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import {
  DYNAMICS_PRESET_GROUPS,
  IDynamicsPreset,
} from '../../common/dsp/dynamicsPresets';
import { DYNAMICS_CATALOGUE } from '../../common/dsp/stageCatalogues';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import { scopedGroups, useDspPresetScope } from './presetScope';
import useStagePresets from './useStagePresets';

interface IDspDynamicsBarProps {
  dynamics: IDynamicsSettings;
  onChange: (next: IDynamicsSettings) => void;
  onCommit: () => void;
}

/**
 * What a profile does, from its own numbers so it cannot go stale: the
 * largest lift any band takes and the strongest hold, then the timing.
 */
const profileHint = (preset: IDynamicsPreset): string => {
  const { bands, attackMs, releaseMs } = preset.settings;
  const lift = Math.max(
    ...bands.map((band) => (band.upRatio > 1 ? band.upMaxDb : 0)),
  );
  const hold = Math.max(...bands.map((band) => band.downRatio));
  return [
    lift > 0 ? `↑ ${lift} dB` : '',
    hold > 1 ? `↓ ${hold}:1` : '',
    `${attackMs}/${releaseMs} ms`,
  ]
    .filter(Boolean)
    .join(' · ');
};

/**
 * Dynamics' profiles on the picker every stage has: the DSP page's
 * everyday ones there, the gaming ones on the Gaming tab (`presetScope`).
 */
const DspDynamicsBar = ({
  dynamics,
  onChange,
  onCommit,
}: IDspDynamicsBarProps) => {
  const { t } = useTranslation();
  const saved = useStagePresets('dynamics', dynamics, onChange, onCommit);
  const scope = useDspPresetScope();
  const factoryEntries: IRichPickEntry[] = scopedGroups(
    DYNAMICS_PRESET_GROUPS,
    scope,
  ).flatMap((group) =>
    DYNAMICS_CATALOGUE.profiles
      .filter((preset) => preset.group === group)
      .map((preset) => ({
        id: preset.id,
        name: t(preset.labelKey as TranslationKey),
        hint: profileHint(preset),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      })),
  );
  // Saved profiles first, as the EQ lists its own.
  const entries: IRichPickEntry[] = [...saved.entries, ...factoryEntries];
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string) => {
    if (saved.apply(id)) {
      return;
    }
    const next = DYNAMICS_CATALOGUE.settings(id, true);
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
    const current = ordered.indexOf(dynamics.presetId);
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
      <div className="dsp-eq-bar dsp-dynamics-bar">
        <div className="dsp-eq-preset dsp-eq-preset-first">
          <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
          <RichPick
            entries={entries}
            groupLabel={(group) =>
              saved.savedGroupLabel(group) ??
              (group ? t(`dsp.eqPresetGroup.${group}` as TranslationKey) : '')
            }
            activeId={dynamics.presetId}
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

        {/* Reset is every band at one: the stage doing nothing, its switch
            left as it is. */}
        <div className="dsp-eq-transfer">
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              onChange({ ...DYNAMICS_DEFAULTS, enabled: dynamics.enabled });
              onCommit();
            }}
          >
            <DspBarIcon name="reset" />
            {t('dsp.eqPreset.reset')}
          </button>
          {saved.buttons}
        </div>
      </div>

      <p className="dsp-dynamics-note">{t('dsp.dynamics.description')}</p>
      {saved.notice}
      {saved.dialog}
    </>
  );
};

export default DspDynamicsBar;
