/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMasterSettings } from '../../common/dsp/chain';
import {
  IMasterPreset,
  MASTER_PRESETS,
  isMasterPresetId,
  masterPresetSettings,
} from '../../common/dsp/masterPresets';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';

interface IDspMasterBarProps {
  master: IMasterSettings;
  onChange: (next: IMasterSettings) => void;
  onCommit: () => void;
}

/**
 * The three figures a destination is, derived rather than written out.
 *
 * The same rule as the Maximizer's picker beside it: a sentence describing a
 * profile survives somebody changing the profile, and the menu lies from then
 * on. These cannot be wrong unless the profile is — and here the numbers ARE
 * the difference, because a delivery target has no curve to look at.
 */
const destinationHint = (preset: IMasterPreset): string =>
  [
    `${preset.settings.loudnessTargetLufs.toFixed(1)} LUFS`,
    `${preset.settings.ceilingDb.toFixed(1)} dBTP`,
    `${preset.settings.peakLimitingDb.toFixed(0)} dB`,
  ].join(' · ');

/**
 * Where the finished record is going, picked the way every other profile is.
 *
 * Applying one keeps the output gain, the release and matched listen: those are
 * how the stage is being used, not where the result is headed.
 */
const DspMasterBar = ({ master, onChange, onCommit }: IDspMasterBarProps) => {
  const { t } = useTranslation();
  const entries: IRichPickEntry[] = MASTER_PRESETS.map((preset) => ({
    id: preset.id,
    name: t(preset.labelKey as TranslationKey),
    hint: destinationHint(preset),
    group: preset.group,
    icon: <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />,
  }));
  const ordered = entries.map((entry) => entry.id);

  const applyPreset = (id: string, enable = true) => {
    if (!isMasterPresetId(id)) {
      return;
    }
    onChange({
      ...masterPresetSettings(id, master),
      enabled: enable ? true : master.enabled,
    });
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(master.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    if (id) {
      applyPreset(id);
    }
  };

  return (
    <div className="dsp-eq-bar dsp-master-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">
          {t('dsp.masterPreset.label')}
        </span>
        <RichPick
          entries={entries}
          groupLabel={(group) =>
            group ? t(`dsp.masterPresetGroup.${group}` as TranslationKey) : ''
          }
          activeId={master.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.masterPreset.label')}
          triggerTitle={t('dsp.masterPreset.label')}
        />
        {/* The same plain directional controls the other pickers carry, for the
            same reason: comparing two destinations is the thing done here
            repeatedly, and a menu makes that open-aim-click every time. */}
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

      {/* The way back from an experiment, in the place the Maximizer's page
          puts it. Reset applies the Default destination rather than switching
          the stage off: those are different intentions, and the toggle in the
          card header already does the second one. */}
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

      <p className="dsp-maximizer-note">{t('dsp.master.description')}</p>
    </div>
  );
};

export default DspMasterBar;
