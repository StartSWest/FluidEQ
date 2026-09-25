/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_PRESETS } from '../../../common/dsp/presets';
import type { TranslationKey } from '../../../common/i18n';
import { NONE_CHAIN_ID, dspPresetName } from '../../dsp/dspPresetCatalog';
import GenreCurve from '../../dsp/GenreCurve';
import { GenreFigures, GenreWhys } from '../../dsp/GenreNotesParts';
import { genreNoteKey, genreNotesFor } from '../../dsp/genreNotesModel';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The picker filed as both pages file it: None on its own above everything,
 * then the chains the listener starred, the classics and the genres, under
 * the equaliser's own headings.
 */
const PICKER: { group?: TranslationKey; ids: string[] }[] = [
  { ids: [NONE_CHAIN_ID] },
  { group: 'dsp.favorites.title', ids: ['rock', 'gaming'] },
  { group: 'dsp.quick.classics', ids: ['music', 'music-room', 'movie'] },
  { group: 'voicing.groupGenre', ids: ['metal', 'pop', 'hiphop', 'jazz'] },
];
/** The row pointed at, whose notes stand beside the list. */
const CHOSEN = 'rock';

const presetById = (id: string) =>
  DSP_PRESETS.find((preset) => preset.id === id);

/**
 * The presets picker as it opens now: the list, and beside it the notes of
 * the style under the pointer.
 *
 * The notes are drawn by their own parts — Rock's curve with its numbered
 * points, what each point is, what the chain measured — exactly as the
 * picker's column draws them, so the picture says what the app says and
 * changes when the notes do. Only their sizes are the slide's
 * (`_tour-presets.scss`).
 */
export default function PresetsVisual() {
  const { t } = useTranslation();
  const notes = genreNotesFor(CHOSEN);
  const name = notes ? t(notes.labelKey as TranslationKey) : '';
  return (
    <div
      className="presets-visual"
      role="img"
      aria-label={t('tour.presets.imageAlt')}
    >
      <div className="presets-visual__list">
        <span className="presets-visual__search">
          <MenuIcon name="configure" />
          {t('dsp.presets')}
        </span>
        {PICKER.map((section) => (
          <div
            key={section.group ?? NONE_CHAIN_ID}
            className="presets-visual__section"
          >
            {section.group && (
              <span className="presets-visual__group">{t(section.group)}</span>
            )}
            <ul>
              {section.ids.map((id) => {
                const preset = presetById(id);
                if (!preset) {
                  return null;
                }
                // None is the equaliser's own row: its word and its plain
                // glyph, never a star.
                const isNone = id === NONE_CHAIN_ID;
                return (
                  <li
                    key={id}
                    className={id === CHOSEN ? 'is-chosen' : undefined}
                  >
                    <VoicingIcon
                      profileId={isNone ? undefined : id}
                      className="presets-visual__icon"
                    />
                    <span>
                      {isNone ? t('voicing.none') : dspPresetName(preset, t)}
                    </span>
                    {/* The real list shows a row's star under the pointer
                        only; the chosen row is drawn as if pointed at. */}
                    {id === CHOSEN && (
                      <MenuIcon name="star" className="presets-visual__star" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {notes && (
        <div className="presets-visual__notes genre-preview">
          <div className="genre-preview__head">
            <strong>{name}</strong>
            <span>{t(genreNoteKey(notes.id, 'hook'))}</span>
          </div>
          {notes.curve && (
            <GenreCurve
              curve={notes.curve}
              pins={notes.note.pins}
              name={name}
              isLabelled={false}
            />
          )}
          <GenreWhys notes={notes} withWhy={false} />
          <GenreFigures notes={notes} asTiles={false} />
          <span className="presets-visual__full">{t('genre.notes.full')}</span>
        </div>
      )}
    </div>
  );
}
