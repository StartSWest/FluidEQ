/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  cleanTagValue,
  type ITrackTagSheet,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import {
  isFileNameTitle,
  titleFromFileName,
} from '../../../common/library/tagText';
import type { ILibraryTrack } from '../../../common/library/types';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import LibraryTagCover from './LibraryTagCover';
import LibraryTagField, { LibraryTagInput } from './LibraryTagField';
import LibraryTagFileFacts from './LibraryTagFileFacts';
import LibraryTagGenreField from './LibraryTagGenreField';
import LibraryTagMoreFields from './LibraryTagMoreFields';
import {
  type ITagDraft,
  emptyDraft,
  shownField,
  withExtra,
  withField,
} from './tagDrafts';
import { FIELD_LABEL_KEYS, formatBytes, imageKind } from './tagLabels';

interface ILibraryTagSongFormProps {
  sheet: ITrackTagSheet;
  track: ILibraryTrack | undefined;
  draft: ITagDraft | undefined;
  onDraft: (draft: ITagDraft) => void;
}

/**
 * One song's fields, grouped as the mockup groups them — the song, the
 * album, the details — then More fields and the file. Every change goes
 * straight into the song's draft; nothing is written from here.
 */
const LibraryTagSongForm = ({
  sheet,
  track,
  draft,
  onDraft,
}: ILibraryTagSongFormProps) => {
  const { t } = useTranslation();
  const current = draft ?? emptyDraft();
  const value = (key: TTagFieldKey) => shownField(sheet, draft, key);
  const set = (key: TTagFieldKey, next: string) =>
    onDraft(withField(current, sheet, key, next));
  const field = (
    key: TTagFieldKey,
    options: { placeholder?: string; isMultiline?: boolean } = {},
  ) => (
    <LibraryTagField
      label={t(FIELD_LABEL_KEYS[key])}
      value={value(key)}
      placeholder={options.placeholder}
      isMultiline={options.isMultiline}
      isEdited={draft?.fields[key] !== undefined}
      isInvalid={cleanTagValue(key, value(key)) === undefined}
      onChange={(next) => set(key, next)}
      onPutBack={() => set(key, sheet.fields[key] ?? '')}
    />
  );
  const numberPair = (first: TTagFieldKey, second: TTagFieldKey) => (
    <div
      className={`library-tags__row${
        draft?.fields[first] !== undefined ||
        draft?.fields[second] !== undefined
          ? ' is-edited'
          : ''
      }`}
    >
      <span className="library-tags__label">{t(FIELD_LABEL_KEYS[first])}</span>
      <div className="library-tags__pair">
        <LibraryTagInput
          value={value(first)}
          placeholder="—"
          isNumber
          ariaLabel={t(FIELD_LABEL_KEYS[first])}
          isEdited={false}
          isInvalid={cleanTagValue(first, value(first)) === undefined}
          onChange={(next) => set(first, next)}
        />
        <span className="library-tags__of">{t('library.tags.of')}</span>
        <LibraryTagInput
          value={value(second)}
          placeholder="—"
          isNumber
          ariaLabel={t(FIELD_LABEL_KEYS[second])}
          isEdited={false}
          isInvalid={cleanTagValue(second, value(second)) === undefined}
          onChange={(next) => set(second, next)}
        />
      </div>
    </div>
  );

  // The tip: a title that is really the file name, offered clean in place.
  const title = value('title');
  const cleaned =
    draft?.fields.title === undefined &&
    (title === '' || isFileNameTitle(title, sheet.fileName))
      ? titleFromFileName(sheet.fileName)
      : undefined;
  const tip =
    cleaned && cleaned.title !== '' && cleaned.title !== title
      ? cleaned
      : undefined;

  const coverCaption = () => {
    if (current.cover) {
      return t('library.tags.cover.new', {
        width: current.cover.width,
        height: current.cover.height,
      });
    }
    if (current.cover === null) {
      return t('library.tags.cover.removed');
    }
    if (sheet.cover === undefined) {
      return t('library.tags.cover.none');
    }
    const { width, height, mime, bytes } = sheet.cover;
    return width !== undefined && height !== undefined
      ? t('library.tags.cover.facts', {
          width,
          height,
          kind: imageKind(mime),
          size: formatBytes(bytes),
        })
      : t('library.tags.cover.factsShort', {
          kind: imageKind(mime),
          size: formatBytes(bytes),
        });
  };

  return (
    <>
      <div className="library-tags__who">
        <LibraryTagCover
          artId={track?.artId}
          label={title}
          draft={current.cover}
          size="panel"
          canRemove={sheet.cover !== undefined}
          onPick={(cover) => {
            if (current.cover && current.cover !== cover) {
              URL.revokeObjectURL(current.cover.url);
            }
            onDraft({
              ...current,
              cover:
                cover === null && sheet.cover === undefined ? undefined : cover,
            });
          }}
          caption={
            <div className="library-tags__who-text">
              <div className="library-tags__who-name">
                {title || sheet.fileName}
              </div>
              <div className="library-tags__who-sub">
                {[
                  value('artist') || t('library.tags.noArtist'),
                  value('album') || t('library.tags.noAlbum'),
                ].join(' · ')}
              </div>
              <div className="library-tags__who-cover">{coverCaption()}</div>
            </div>
          }
        />
      </div>
      {tip && (
        <div className="library-tags__tip">
          <MenuIcon name="pencil" />
          <span>
            {tip.trackNo !== undefined && value('trackNo') === ''
              ? t('library.tags.tip.fileNameTrack', {
                  title: tip.title,
                  track: tip.trackNo,
                })
              : t('library.tags.tip.fileName', { title: tip.title })}
          </span>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              let next = withField(current, sheet, 'title', tip.title);
              if (tip.trackNo !== undefined && value('trackNo') === '') {
                next = withField(next, sheet, 'trackNo', tip.trackNo);
              }
              onDraft(next);
            }}
          >
            {t('library.tags.tip.use')}
          </button>
        </div>
      )}

      <p className="library-tags__group">{t('library.tags.group.song')}</p>
      {field('title')}
      {field('artist')}
      {field('composer')}

      <p className="library-tags__group">{t('library.tags.group.album')}</p>
      {field('album')}
      {field('albumArtist', { placeholder: t('library.tags.sameAsArtist') })}
      {numberPair('trackNo', 'trackTotal')}
      {numberPair('discNo', 'discTotal')}
      {field('year', { placeholder: '—' })}
      <LibraryTagGenreField
        label={t(FIELD_LABEL_KEYS.genre)}
        value={value('genre')}
        placeholder="—"
        isEdited={draft?.fields.genre !== undefined}
        onChange={(next) => set('genre', next)}
        onPutBack={() => set('genre', sheet.fields.genre ?? '')}
      />

      <p className="library-tags__group">{t('library.tags.group.details')}</p>
      {field('bpm', { placeholder: '—' })}
      {field('comment', { isMultiline: true })}

      <LibraryTagMoreFields
        sheet={sheet}
        draft={draft}
        onField={set}
        onExtra={(code, next) => onDraft(withExtra(current, sheet, code, next))}
      />

      <p className="library-tags__group">{t('library.tags.group.file')}</p>
      <LibraryTagFileFacts
        sheet={sheet}
        track={track}
        draft={draft}
        onVersion={(version) => onDraft({ ...current, id3v2Version: version })}
        onKeepId3v1={(keep) => onDraft({ ...current, keepId3v1: keep })}
      />
    </>
  );
};

export default LibraryTagSongForm;
