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

import { type KeyboardEvent, useMemo, useState } from 'react';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryPlayerSessionIfAny } from '../player/LibraryPlayerContext';
import { useLibraryTracks } from '../useLibraryTracks';
import LibraryTagSetCover from './LibraryTagSetCover';
import LibraryTagSharedFields from './LibraryTagSharedFields';
import LibraryTagSheet, { type ISheetGroup } from './LibraryTagSheet';
import LibraryTagSetTools from './LibraryTagSetTools';
import { useTagEditor } from './TagEditorContext';
import {
  changedFields,
  initialSetState,
  isSetValid,
  type ISetState,
  requestOfSet,
  summarise,
  withCell,
  withShared,
} from './tagSetModel';
import { useTagSheets } from './useTagSheets';

/** A folder's songs grouped by album, each group in the editor's order. */
const groupsOf = (
  ordered: readonly ITrackTagSheet[],
  isFolder: boolean,
): ISheetGroup[] => {
  if (!isFolder) {
    return [{ key: 'all', sheets: [...ordered] }];
  }
  const groups = new Map<string, ISheetGroup>();
  ordered.forEach((sheet) => {
    // One album however its artist is spelled: grouped by the album's name
    // (and its album artist where it has one), case aside; a song with no
    // album stands with the others of its folder.
    const album = sheet.fields.album ?? '';
    const albumArtist = sheet.fields.albumArtist ?? '';
    const key =
      album === ''
        ? `folder\u001f${sheet.folder}`
        : `${albumArtist.toLocaleLowerCase()}\u001f${album.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      label:
        [albumArtist || sheet.fields.artist, album]
          .filter(Boolean)
          .join(' — ') || sheet.folder,
      sheets: [],
    };
    group.sheets.push(sheet);
    groups.set(key, group);
  });
  return [...groups.values()];
};

/**
 * AN ALBUM, A FOLDER OR A SELECTION, edited on the page itself (the mockup's
 * section 3): the shared fields and one cover above, a spreadsheet of the
 * songs below. Nothing is written until Save; a write then runs from the
 * shelf with its progress there, and the editor closes.
 */
const LibraryTagSetEditor = () => {
  const { t } = useTranslation();
  const { view, close, write } = useTagEditor();
  const ids = useMemo(() => (view?.kind === 'set' ? view.ids : []), [view]);
  const sheets = useTagSheets(ids);
  const tracks = useLibraryTracks(ids);
  const session = useLibraryPlayerSessionIfAny();
  const [state, setState] = useState<ISetState>(() => initialSetState(ids));
  const [isLeaving, setIsLeaving] = useState(false);
  const [didRefuse, setDidRefuse] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const ordered = useMemo(
    () =>
      state.order.flatMap((id) => {
        const result = sheets.results.get(id);
        return result?.state === 'ok' ? [result.sheet] : [];
      }),
    [state.order, sheets.results],
  );
  const changes = useMemo(
    () => changedFields(state, ordered),
    [state, ordered],
  );
  if (view?.kind !== 'set') {
    return null;
  }
  const isFolder = view.scope === 'folder';
  const groups = groupsOf(ordered, isFolder);
  const summary = summarise(state, ordered, changes);
  const hasChanges = summary.changeCount > 0;
  const canSave =
    hasChanges && sheets.isComplete && isSetValid(changes) && !isSaving;

  const saveLabel = () => {
    if (summary.fileCount === 0) {
      return t('library.tags.save');
    }
    return summary.fileCount === 1
      ? t('library.tags.set.saveToOne')
      : t('library.tags.set.saveTo', { count: summary.fileCount });
  };

  const save = () => {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    write(requestOfSet(state, ordered, session?.track?.id))
      .then((taken) => {
        setIsSaving(false);
        if (taken) {
          close();
        } else {
          setDidRefuse(true);
        }
        return undefined;
      })
      .catch(() => {
        setIsSaving(false);
        setDidRefuse(true);
      });
  };

  const titles = ordered.map((sheet) => sheet.fields.title || sheet.fileName);
  let { title } = view;
  if (title === '') {
    if (titles.length > 2) {
      title = t('library.tags.set.selectionTitle', {
        first: titles[0],
        second: titles[1],
        count: titles.length - 2,
      });
    } else {
      title = titles.join(' · ');
    }
  }
  const scopeName = {
    album: t('library.tags.set.album'),
    folder: t('library.tags.set.folder'),
    selection: t('library.tags.set.selection'),
  }[view.scope];
  const unreadable = sheets.readCount - ordered.length;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Ctrl+S saves from whichever field or cell has the caret
    <section
      className="library-tags-set"
      aria-label={title}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 's'
        ) {
          event.preventDefault();
          save();
        }
      }}
    >
      <div className="library-tags-set__scroll">
        <header className="library-tags-set__head">
          <div className="library-tags-set__heading">
            <div className="library-tags-set__eyebrow">
              <b>
                {ids.length === 1
                  ? t('library.trackCountOne')
                  : t('library.trackCount', { count: ids.length })}
              </b>
              {' · '}
              {scopeName}
              {view.place ? ` · ${view.place}` : ''}
            </div>
            <h2>{title}</h2>
          </div>
          <div className="library-tags-set__head-side">
            {isLeaving ? (
              <div className="library-tags-set__leave" role="alert">
                <span>{t('library.tags.set.leaveAsk')}</span>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => setIsLeaving(false)}
                >
                  {t('library.tags.set.keepEditing')}
                </button>
                <button
                  type="button"
                  className="button small danger"
                  onClick={close}
                >
                  {t('library.tags.set.discard')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button small subtle"
                onClick={() => (hasChanges ? setIsLeaving(true) : close())}
              >
                {t('library.tags.set.back')}
              </button>
            )}
            <p className="library-tags__note">
              {t('library.tags.set.mixedNote')}
            </p>
          </div>
        </header>
        {!sheets.isComplete && (
          <div className="library-tags-set__reading" role="status">
            <span>
              {t('library.tags.set.reading', {
                done: sheets.readCount,
                count: ids.length,
              })}
            </span>
            <span className="library-tags__bar">
              <i
                style={{
                  width: `${(sheets.readCount / Math.max(1, ids.length)) * 100}%`,
                }}
              />
            </span>
          </div>
        )}
        {unreadable > 0 && (
          <p className="library-tags__note is-warning">
            {t('library.tags.set.unreadable', { count: unreadable })}
          </p>
        )}
        {ordered.length > 0 && (
          <>
            <div className="library-tags-set__shared">
              <LibraryTagSetCover
                sheets={ordered}
                tracks={tracks}
                cover={state.cover}
                onCover={(cover) =>
                  setState((current) => ({ ...current, cover }))
                }
              />
              <LibraryTagSharedFields
                sheets={ordered}
                state={state}
                onShared={(key, value) =>
                  setState((current) => withShared(current, key, value))
                }
                onVersion={(version) =>
                  setState((current) => ({ ...current, version }))
                }
              />
            </div>
            <LibraryTagSetTools
              groups={groups}
              ordered={ordered}
              onState={(update) => setState((current) => update(current))}
            />
            <LibraryTagSheet
              groups={groups}
              state={state}
              tracks={tracks}
              onCell={(sheet, key, value) =>
                setState((current) => withCell(current, sheet, key, value))
              }
              onMove={(fromId, beforeId) =>
                setState((current) => {
                  const order = current.order.filter((id) => id !== fromId);
                  order.splice(order.indexOf(beforeId), 0, fromId);
                  return { ...current, order };
                })
              }
            />
            <p className="library-tags__note">
              {t('library.tags.set.sheetHint')}
            </p>
          </>
        )}
      </div>
      <footer className="library-tags-set__foot">
        <div className="library-tags-set__what" aria-live="polite">
          {hasChanges ? (
            <>
              <b>
                {summary.changeCount === 1
                  ? t('library.tags.set.changesOne')
                  : t('library.tags.set.changes', {
                      count: summary.changeCount,
                    })}
              </b>
              <span>
                {summary.fileCount === 1
                  ? t('library.tags.set.filesOne')
                  : t('library.tags.set.files', { count: summary.fileCount })}
              </span>
            </>
          ) : (
            <>
              <b>{t('library.tags.foot.none')}</b>
              <span>{t('library.tags.set.noChanges')}</span>
            </>
          )}
          {didRefuse && (
            <span className="library-tags__note is-warning" role="alert">
              {t('library.tags.saveFailed')}
            </span>
          )}
        </div>
        <button
          type="button"
          className="button small subtle"
          disabled={!hasChanges}
          onClick={() => setState(initialSetState(ids))}
        >
          {t('library.tags.set.discard')}
        </button>
        <button
          type="button"
          className="button small"
          disabled={!canSave}
          onClick={save}
        >
          {saveLabel()}
        </button>
      </footer>
    </section>
  );
};

export default LibraryTagSetEditor;
