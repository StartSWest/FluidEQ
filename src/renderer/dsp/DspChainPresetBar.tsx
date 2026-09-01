/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import {
  fromDspChainPresetFile,
  toDspChainPresetFile,
} from '../../common/dsp/dspChainPresetFile';
import {
  DSP_PRESETS,
  DSP_PRESET_GROUPS,
  dspPresetSettings,
  isDspPresetId,
} from '../../common/dsp/presets';
import { Translate } from '../../common/i18n';
import { TranslationKey } from '../../common/i18n/en';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import { exportDspChainPreset } from '../utils/equalizerApi';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import DspPresetImportDialog from './DspPresetImportDialog';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import { SAVED_GROUP, eqPresetGroupLabel } from './presetPickEntries';
import {
  IUserDspPreset,
  USER_DSP_PRESET_NAME_MAX,
  USER_DSP_PRESET_PREFIX,
  findUserDspPreset,
  readUserDspPresets,
  removeUserDspPreset,
  saveUserDspPreset,
} from './userDspPresets';

interface IDspChainPresetBarProps {
  settings: IDspSettings;
  disabled: boolean;
  onChange: (next: IDspSettings) => void;
  onCommit: () => void;
}

/** Names the audible stages a complete chain starts. */
const chainHint = (settings: IDspSettings, t: Translate): string =>
  [
    settings.normalizer.mode !== 'off' ? t('dsp.normalizer.title') : '',
    settings.denoise.enabled ? t('dsp.denoise.title') : '',
    settings.exciter.enabled ? t('dsp.exciter.title') : '',
    settings.bassForge.enabled ? t('dsp.bassForge.title') : '',
    settings.eq.enabled ? t('dsp.eq.title') : '',
    settings.bassPunch.enabled ? t('dsp.bassPunch.title') : '',
    settings.dimension.enabled ? t('dsp.dimension.title') : '',
    settings.compressor.enabled ? t('dsp.compressor.title') : '',
    settings.maximizer.enabled ? t('dsp.maximizer.title') : '',
    settings.master.enabled ? t('dsp.master.title') : '',
  ]
    .filter(Boolean)
    .join(' · ');

const DspChainPresetBar = ({
  settings,
  disabled,
  onChange,
  onCommit,
}: IDspChainPresetBarProps) => {
  const { t } = useTranslation();
  const [notice, setNotice] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [userPresets, setUserPresets] = useState<IUserDspPreset[]>(() =>
    readUserDspPresets(),
  );

  const entries: IRichPickEntry[] = [
    ...userPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      hint: chainHint(preset.settings, t),
      group: SAVED_GROUP,
      icon: <VoicingIcon className="rich-pick__glyph" />,
    })),
    ...DSP_PRESET_GROUPS.flatMap((group) =>
      DSP_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
        id: preset.id,
        name: t(preset.labelKey as TranslationKey),
        hint: chainHint(preset.settings, t),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      })),
    ),
  ];
  const ordered = entries.map((entry) => entry.id);

  const applyUserPreset = (preset: IUserDspPreset) => {
    setNotice('');
    onChange(
      clampDspSettings({
        ...preset.settings,
        enabled: true,
        presetId: preset.id,
        crossfade: settings.crossfade,
      }),
    );
    onCommit();
  };

  const applyPreset = (id: string) => {
    if (id.startsWith(USER_DSP_PRESET_PREFIX)) {
      const saved = findUserDspPreset(id);
      if (saved) {
        applyUserPreset(saved);
      }
      return;
    }
    if (!isDspPresetId(id)) {
      return;
    }
    const next = dspPresetSettings(id, settings);
    if (!next) {
      return;
    }
    setNotice('');
    onChange(next);
    onCommit();
  };

  const step = (direction: -1 | 1) => {
    if (ordered.length === 0) {
      return;
    }
    const current = ordered.indexOf(settings.presetId);
    const id =
      current < 0
        ? ordered[direction > 0 ? 0 : ordered.length - 1]
        : ordered[(current + direction + ordered.length) % ordered.length];
    applyPreset(id);
  };

  const reset = () => {
    setNotice('');
    onChange(
      clampDspSettings({
        ...DSP_DEFAULTS,
        enabled: settings.enabled,
        crossfade: settings.crossfade,
      }),
    );
    onCommit();
  };

  const handleSave = (name: string) => {
    const saved = saveUserDspPreset(name, settings);
    setUserPresets(readUserDspPresets());
    setIsNaming(false);
    onChange({ ...settings, presetId: saved.id });
    onCommit();
    setNotice(t('dsp.eqSave.saved', { name: saved.name }));
  };

  const handleDelete = () => {
    const saved = findUserDspPreset(settings.presetId);
    if (!saved) {
      return;
    }
    removeUserDspPreset(saved.id);
    setUserPresets(readUserDspPresets());
    onChange({ ...settings, presetId: '' });
    onCommit();
    setNotice(t('dsp.eqSave.deleted', { name: saved.name }));
  };

  const handleImport = (text: string) => {
    const imported = fromDspChainPresetFile(text);
    if (!imported) {
      setNotice(t('dsp.chainImport.invalid'));
      return;
    }
    const saved = saveUserDspPreset(imported.name, imported.settings);
    setUserPresets(readUserDspPresets());
    setIsImporting(false);
    applyUserPreset(saved);
    setNotice(t('dsp.eqSave.imported', { name: saved.name }));
  };

  const handleExport = async () => {
    const saved = findUserDspPreset(settings.presetId);
    const factory = DSP_PRESETS.find(
      (preset) => preset.id === settings.presetId,
    );
    const name =
      saved?.name ??
      (factory ? t(factory.labelKey as TranslationKey) : undefined) ??
      t('dsp.eqPreset.custom');
    setNotice('');
    setIsExporting(true);
    try {
      const exported = await exportDspChainPreset(
        name,
        toDspChainPresetFile(name, settings),
      );
      if (exported) {
        setNotice(t('dsp.eqShare.saved'));
      }
    } catch {
      setNotice(t('dsp.eqShare.failed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="dsp-presets dsp-eq-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.presets')}</span>
        <RichPick
          entries={entries}
          groupLabel={(group) => eqPresetGroupLabel(group, t)}
          activeId={settings.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.presets')}
          triggerTitle={t('dsp.presets')}
          disabled={disabled}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
          title={t('dsp.eqPreset.previous')}
          disabled={disabled}
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
          disabled={disabled}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="dsp-eq-transfer dsp-eq-reset dsp-chain-transfer">
        <button
          type="button"
          className="button small subtle"
          disabled={disabled}
          onClick={reset}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.chainSave.hint')}
          disabled={disabled}
          onClick={() => setIsNaming(true)}
        >
          <DspBarIcon name="save" />
          {t('dsp.eqSave.save')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.chainShare.hint')}
          disabled={disabled || isExporting}
          onClick={handleExport}
        >
          <DspBarIcon name="share" />
          {t('dsp.eqPreset.export')}
        </button>
        <button
          type="button"
          className="button small subtle"
          disabled={disabled}
          onClick={() => {
            setNotice('');
            setIsImporting(true);
          }}
        >
          <DspBarIcon name="import" />
          {t('dsp.eqPreset.import')}
        </button>
        {settings.presetId.startsWith(USER_DSP_PRESET_PREFIX) && (
          <button
            type="button"
            className="button small subtle"
            disabled={disabled}
            onClick={handleDelete}
          >
            <DspBarIcon name="delete" />
            {t('dsp.eqSave.delete')}
          </button>
        )}
      </div>

      {notice !== '' && (
        <p className="dsp-eq-notice" role="status">
          {notice}
        </p>
      )}

      {isImporting && (
        <DspPresetImportDialog
          titleKey="dsp.chainImport.title"
          hintKey="dsp.chainImport.hint"
          placeholderKey="dsp.chainImport.placeholder"
          accept=".json,.fluideq-dsp.json,application/json"
          error={notice}
          onImport={handleImport}
          onClose={() => setIsImporting(false)}
        />
      )}

      {isNaming && (
        <DspPresetSaveDialog
          existing={userPresets.map((preset) => preset.name)}
          titleKey="dsp.chainSave.title"
          hintKey="dsp.chainSave.hint"
          placeholderKey="dsp.eqSave.placeholder"
          nameMax={USER_DSP_PRESET_NAME_MAX}
          onSave={handleSave}
          onClose={() => setIsNaming(false)}
        />
      )}
    </div>
  );
};

export default DspChainPresetBar;
