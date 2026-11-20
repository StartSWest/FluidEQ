/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { IDspSettings } from '../../common/dsp/chain';
import {
  fromDspChainPresetFile,
  toDspChainPresetFile,
} from '../../common/dsp/dspChainPresetFile';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { dspVoicingCurve } from '../../common/dsp/presetVoicing';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { exportDspChainPreset } from '../utils/equalizerApi';
import RichPick from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import DspPresetImportDialog from './DspPresetImportDialog';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import GenreNotesPreview from './GenreNotesPreview';
import { InfoMark } from './GenreNotesParts';
import { genreNotesFor } from './genreNotesModel';
import { openGenreNotes } from './genreNotesStore';
import { toggleFavouriteDspPreset } from './favouriteDspPresets';
import { useDspPresetScope } from './presetScope';
import { useDspPresetSelection } from './useDspPresetSelection';
import useDspChainEntries from './useDspChainEntries';
import {
  DEFAULT_CHAIN_ID,
  NONE_CHAIN_ID,
  dspPresetName,
} from './dspPresetCatalog';
import {
  IUserDspPreset,
  USER_DSP_PRESET_NAME_MAX,
  findUserDspPreset,
  saveUserDspPreset,
} from './userDspPresets';
import { removeOwnPreset } from '../eq/ownPresets/ownPresetRemoval';
import { editedPresetName } from '../eq/ownPresets/presetEditSession';
import type { ErrorDescription } from '../../common/errors';

interface IDspChainPresetBarProps {
  settings: IDspSettings;
  disabled: boolean;
  onChange: (next: IDspSettings) => void;
  onCommit: () => void;
}

const DspChainPresetBar = ({
  settings,
  disabled,
  onChange,
  onCommit,
}: IDspChainPresetBarProps) => {
  const { t } = useTranslation();
  const scope = useDspPresetScope();
  const { voicing, setGlobalError } = useFluidEqLayers();
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
  const {
    entries,
    ordered,
    groupLabel,
    userPresets,
    refreshUserPresets,
    favourites,
    setFavourites,
  } = useDspChainEntries(scope);

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

  // The chosen chain's notes, where it is a genre's. The button stays in the
  // row for every other chain, dimmed: coming and going as the arrows step
  // through the list, it shoved the file actions beside it along the row the
  // way the picker's own width once did.
  const notes = genreNotesFor(settings.presetId);
  const notesName = notes ? t(notes.labelKey as TranslationKey) : undefined;

  // A chain is saved and shared as it is heard: the rack, and the tone the
  // Preset layer is playing in the main EQ (`presetCurve.ts`).
  const handleSave = async (name: string) => {
    setIsNaming(false);
    try {
      const saved = await saveUserDspPreset(
        name,
        settings,
        dspVoicingCurve(voicing),
      );
      refreshUserPresets();
      onChange({ ...settings, presetId: saved.id });
      onCommit();
      setNotice(t('dsp.eqSave.saved', { name: saved.name }));
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  // The chain on now is the one deleted, so it is taken off first, the same
  // as from the EQ page's Preset tab (`removeOwnPreset`): None, rather than
  // a rack and a curve left playing under a name that is gone.
  const handleDelete = async () => {
    const saved = findUserDspPreset(settings.presetId);
    if (!saved) {
      return;
    }
    try {
      await removeOwnPreset(saved.id, () => selectPreset('none'));
      refreshUserPresets();
      setNotice(t('dsp.eqSave.deleted', { name: saved.name }));
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
  };

  const handleImport = async (text: string) => {
    const imported = fromDspChainPresetFile(text);
    if (!imported) {
      setNotice(t('dsp.chainImport.invalid'));
      return;
    }
    try {
      const saved = await saveUserDspPreset(
        imported.name,
        imported.settings,
        imported.curve,
      );
      refreshUserPresets();
      setIsImporting(false);
      applyUserPreset(saved);
      setNotice(t('dsp.eqSave.imported', { name: saved.name }));
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    }
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
        {/* "Whole chain", where it said "Presets": the stage's head under the
            bar has a preset too, and the caption is what says this one is
            every stage's at once. */}
        <span className="dsp-eq-preset-label">{t('dsp.wholeChain')}</span>
        <RichPick
          menuClassName="dsp-chain-preset-menu"
          entries={entries}
          groupLabel={groupLabel}
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
          // A preset being made is in no list yet: its own name, not Custom.
          placeholder={
            editedPresetName(settings.presetId) ?? t('dsp.eqPreset.custom')
          }
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.presets')}
          triggerTitle={t('dsp.presets')}
          disabled={disabled || selecting}
          renderPreview={(id, close) => (
            <GenreNotesPreview chainId={id} closeMenu={close} />
          )}
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
        {/* Only where there are notes to open: a greyed button beside every
            chain that has none read as broken (Ivan, 2026-09-25). */}
        {notesName !== undefined && (
          <button
            type="button"
            className="button small subtle genre-about"
            aria-label={t('genre.notes.about', { name: notesName })}
            title={t('genre.notes.about', { name: notesName })}
            onClick={() => openGenreNotes(settings.presetId)}
          >
            <InfoMark />
            <span className="genre-about__label">
              {t('genre.notes.aboutShort')}
            </span>
          </button>
        )}
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
        {/* Kept ones only: a preset still being made has nothing to delete. */}
        {findUserDspPreset(settings.presetId) && (
          <button
            type="button"
            className="button small subtle"
            title={t('dsp.eqSave.delete')}
            disabled={disabled || selecting}
            onClick={() => {
              handleDelete().catch(() => undefined);
            }}
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
          onImport={(text) => {
            handleImport(text).catch(() => undefined);
          }}
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
          onSave={(name) => {
            handleSave(name).catch(() => undefined);
          }}
          onClose={() => setIsNaming(false)}
        />
      )}
    </div>
  );
};

export default DspChainPresetBar;
