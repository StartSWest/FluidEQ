/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { IDspSettings } from '../../common/dsp/chain';
import {
  fromDspChainPresetFile,
  toDspChainPresetFile,
} from '../../common/dsp/dspChainPresetFile';
import { DSP_PRESETS, DSP_PRESET_GROUPS } from '../../common/dsp/presets';
import { dspVoicingCurve } from '../../common/dsp/presetVoicing';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { exportDspChainPreset } from '../utils/equalizerApi';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import DspPresetImportDialog from './DspPresetImportDialog';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import {
  DSP_PRESETS_CHANGED,
  readFavouriteDspPresets,
  toggleFavouriteDspPreset,
} from './favouriteDspPresets';
import { SAVED_GROUP, eqPresetGroupLabel } from './presetPickEntries';
import { useDspPresetSelection } from './useDspPresetSelection';
import {
  DEFAULT_CHAIN_ID,
  NONE_CHAIN_ID,
  QUICK_DSP_PRESETS,
  dspPresetHint as chainHint,
  dspPresetName,
} from './dspPresetCatalog';
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

/** None's own place, first and without a heading. */
const NONE_GROUP = '';

/** Where the starred presets file: above the listener's own, under None. */
const FAVOURITE_GROUP = 'favourites';

/**
 * Where the usual chains file, straight under the starred ones: the same
 * chains in the same order, under the same heading, as the quick pick on the
 * equaliser's page (`QUICK_DSP_PRESETS`).
 */
const QUICK_GROUP = 'quick';

const DspChainPresetBar = ({
  settings,
  disabled,
  onChange,
  onCommit,
}: IDspChainPresetBarProps) => {
  const { t } = useTranslation();
  const { voicing } = useFluidEqLayers();
  const [notice, setNotice] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  // A source change can disable the rack with a preset dialog still open.
  // Those dialogs are portals, so disabling their trigger does not close them.
  if (disabled && (isImporting || isNaming)) {
    setIsImporting(false);
    setIsNaming(false);
  }
  const [isExporting, setIsExporting] = useState(false);
  const [userPresets, setUserPresets] = useState<IUserDspPreset[]>(() =>
    readUserDspPresets(),
  );

  const [favourites, setFavourites] = useState<string[]>(() =>
    readFavouriteDspPresets(),
  );

  const filed: IRichPickEntry[] = [
    ...userPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      hint: chainHint(preset, t),
      group: SAVED_GROUP,
      icon: <VoicingIcon className="rich-pick__glyph" />,
    })),
    ...DSP_PRESET_GROUPS.flatMap((group) =>
      DSP_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
        id: preset.id,
        name: dspPresetName(preset, t),
        hint: chainHint(preset, t),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      })),
    ),
  ];
  // The starred ones first, in the order they were starred, then the usual
  // ones in the order the equaliser's quick pick gives them, each under a
  // heading of its own — once each: a preset listed twice is two rows lit at
  // once and an arrow that visits it twice. `ordered` follows, so the arrows
  // beside the pill walk what the menu shows.
  const lifted = (ids: readonly string[], group: string): IRichPickEntry[] =>
    ids.flatMap((id) => {
      const entry = filed.find((one) => one.id === id);
      return entry ? [{ ...entry, group }] : [];
    });
  // None above all of them, the starred ones included, with no heading and no
  // star, as on the equaliser's picker: it is the absence of a choice, and
  // a star it was given before it stood here is not a second place for it.
  const starred = favourites.filter((id) => id !== NONE_CHAIN_ID);
  const usual = QUICK_DSP_PRESETS.filter((id) => !starred.includes(id));
  const entries: IRichPickEntry[] = [
    ...lifted([NONE_CHAIN_ID], NONE_GROUP),
    ...lifted(starred, FAVOURITE_GROUP),
    ...lifted(usual, QUICK_GROUP),
    ...filed.filter(
      (entry) =>
        entry.id !== NONE_CHAIN_ID &&
        !starred.includes(entry.id) &&
        !usual.includes(entry.id),
    ),
  ];
  const ordered = entries.map((entry) => entry.id);

  const { apply: selectPreset, selecting } = useDspPresetSelection(
    settings,
    onChange,
    onCommit,
  );
  const applyPreset = (id: string) => {
    setNotice('');
    selectPreset(id);
  };
  const applyUserPreset = (preset: IUserDspPreset) => applyPreset(preset.id);
  useEffect(() => {
    const changed = () => {
      setUserPresets(readUserDspPresets());
      setFavourites(readFavouriteDspPresets());
    };
    window.addEventListener(DSP_PRESETS_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(DSP_PRESETS_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);

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

  // Reset is the Default chain, picked: its rack and its curve, the way the
  // list puts it on (Ivan, 2026-09-22: "reset set default profile"). It was
  // the bare defaults — no stage on, no curve, the last preset's tone left
  // playing in the main EQ — which is no preset at all, and since None
  // arrived it sounded like None. A pick keeps what is the listener's and
  // not the sound's: the crossfade, the surround switch, the head.
  const reset = () => applyPreset(DEFAULT_CHAIN_ID);

  // A chain is saved and shared as it is heard: the rack, and the tone the
  // Preset layer is playing in the main EQ (`presetCurve.ts`).
  const handleSave = (name: string) => {
    const saved = saveUserDspPreset(name, settings, dspVoicingCurve(voicing));
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
    // Its star goes with it, rather than waiting in storage for an id that
    // will never be shown again.
    if (favourites.includes(saved.id)) {
      setFavourites(
        toggleFavouriteDspPreset(
          saved.id,
          ordered.filter((id) => id !== saved.id),
        ),
      );
    }
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
    const saved = saveUserDspPreset(
      imported.name,
      imported.settings,
      imported.curve,
    );
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
      (factory ? dspPresetName(factory, t) : undefined) ??
      t('dsp.eqPreset.custom');
    setNotice('');
    setIsExporting(true);
    try {
      const exported = await exportDspChainPreset(
        name,
        toDspChainPresetFile(name, settings, dspVoicingCurve(voicing)),
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
          menuClassName="dsp-chain-preset-menu"
          entries={entries}
          groupLabel={(group) => {
            if (group === NONE_GROUP) {
              return '';
            }
            if (group === FAVOURITE_GROUP) {
              return t('library.playlist.favorites');
            }
            return group === QUICK_GROUP
              ? t('dsp.quick.classics')
              : eqPresetGroupLabel(group, t);
          }}
          favourites={{
            ids: favourites,
            onToggle: (id) =>
              setFavourites(toggleFavouriteDspPreset(id, ordered)),
            addLabel: t('library.playlist.addToFavorites'),
            removeLabel: t('library.playlist.removeFromFavorites'),
            exclude: [NONE_CHAIN_ID],
          }}
          activeId={settings.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.presets')}
          triggerTitle={t('dsp.presets')}
          disabled={disabled || selecting}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
          title={t('dsp.eqPreset.previous')}
          disabled={disabled || selecting}
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
          disabled={disabled || selecting}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="dsp-eq-transfer dsp-chain-transfer">
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.eqPreset.reset')}
          disabled={disabled || selecting}
          onClick={reset}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.chainSave.hint')}
          disabled={disabled || selecting}
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
          title={t('dsp.eqPreset.import')}
          disabled={disabled || selecting}
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
            title={t('dsp.eqSave.delete')}
            disabled={disabled || selecting}
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
