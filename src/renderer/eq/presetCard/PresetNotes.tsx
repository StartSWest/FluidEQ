/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import genreRecordingUrl from '../../../common/dsp/genreRecordings';
import type { TranslationKey } from '../../../common/i18n/en';
import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import GenreCurve from '../../dsp/GenreCurve';
import { GenreFigures, GenreWhys } from '../../dsp/GenreNotesParts';
import { genreNoteKey, genreNotesFor } from '../../dsp/genreNotesModel';
import { openGenreNotes } from '../../dsp/genreNotesStore';
import { presetStageRows } from '../../dsp/presetStageRows';
import { useTranslation } from '../../utils/I18nContext';
import PresetCurveSpark from '../ownPresets/PresetCurveSpark';
import '../../styles/GenreNotes.scss';

interface IPresetNotesProps {
  preset: Pick<IDspCatalogEntry, 'id' | 'name' | 'settings' | 'curve'>;
}

/**
 * What a preset is made of, in one view beside the Preset tab's grid, for
 * every preset — factory or the listener's own (Ivan, 2026-11-26: "show a
 * combined view: the DSP filters applied and the notes for the genres; we
 * show that pane also for classic presets"): its curve, a genre's with the
 * frequencies it was tuned around; what its rack runs, stage by stage, each
 * with the figures its picker on the DSP page prints and, for a genre, the
 * line its notes give that stage, then what the genre left off; and a
 * genre's measurements and the records to hear it in. A preset with no
 * genre notes — a classic one, or one of the listener's own, a copy of a
 * genre's included, which no longer plays the genre's measured sound — shows
 * its curve and its stages alone.
 */
export const PresetNotesBody = ({ preset }: IPresetNotesProps) => {
  const { t } = useTranslation();
  const notes = genreNotesFor(preset.id);
  const rows = presetStageRows(preset, t);
  const genreName = notes ? t(notes.labelKey as TranslationKey) : '';
  return (
    <>
      {notes?.curve && (
        <div className="preset-notes__genre-curve">
          <GenreCurve
            curve={notes.curve}
            pins={notes.note.pins}
            name={genreName}
            isLabelled={false}
          />
          <GenreWhys notes={notes} withWhy={false} />
        </div>
      )}
      {!notes?.curve && preset.curve && (
        <div className="own-preset-notes__curve">
          <PresetCurveSpark curve={preset.curve} size="wide" />
        </div>
      )}
      {(rows.length > 0 || notes) && (
        <section className="preset-notes__rack">
          <span className="eq-preset-tab__eyebrow">{t('eq.preset.rack')}</span>
          <ul className="preset-notes__stages">
            {rows.map((row) => {
              const figures = [row.profile, row.figures]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={row.key}>
                  <strong>{row.title}</strong>
                  {figures && (
                    <span className="preset-notes__figures">{figures}</span>
                  )}
                  {row.line && (
                    <span className="preset-notes__line">{row.line}</span>
                  )}
                </li>
              );
            })}
            {notes && (
              <li className="is-off">
                <strong>{t('genre.notes.leftOff')}</strong>
                <span className="preset-notes__line">
                  {t(genreNoteKey(notes.id, 'off'))}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}
      {notes && <GenreFigures notes={notes} asTiles={false} />}
      {notes && notes.note.listen.length > 0 && (
        <section className="preset-notes__listen">
          <span className="eq-preset-tab__eyebrow">
            {t('genre.notes.listen')}
          </span>
          <ul className="genre-listen">
            {notes.note.listen.map((record) => (
              <li key={record}>
                <a
                  href={genreRecordingUrl(record)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${t('video.openInBrowser')} · YouTube`}
                >
                  {record}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

interface IFactoryPresetNotesProps extends IPresetNotesProps {
  isDisabled: boolean;
  onEditCopy: () => void;
}

/**
 * Beside the grid, for a factory preset: its name and what it is — a
 * genre's hook, or that it is built in and how to make it one's own — then
 * Edit a copy, and a genre's Full notes, over the body every preset shares.
 * Both quiet: what a factory preset is for is playing it, which its tile
 * does.
 */
export const FactoryPresetNotes = ({
  preset,
  isDisabled,
  onEditCopy,
}: IFactoryPresetNotesProps) => {
  const { t } = useTranslation();
  const notes = genreNotesFor(preset.id);
  return (
    <>
      <div className="eq-preset-tab__about">
        <strong>{preset.name}</strong>
        <span>
          {notes
            ? t(genreNoteKey(notes.id, 'hook'))
            : t('eq.preset.factoryAbout')}
        </span>
      </div>
      <div className="own-preset-notes__actions">
        <button
          type="button"
          className="button small subtle"
          disabled={isDisabled}
          onClick={onEditCopy}
        >
          {t('eq.own.editCopy')}
        </button>
        {notes && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => openGenreNotes(preset.id)}
          >
            {t('genre.notes.full')}
          </button>
        )}
      </div>
      <PresetNotesBody preset={preset} />
    </>
  );
};
