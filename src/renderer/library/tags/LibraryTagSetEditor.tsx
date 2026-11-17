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

import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { isPlaceholderName } from '../../../common/library/tagFix';
import type { TTagFieldKey } from '../../../common/library/tagFields';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryPlayerSessionIfAny } from '../player/LibraryPlayerContext';
import { useLibraryTracks } from '../useLibraryTracks';
import {
  LibraryTagAlbumField,
  LibraryTagAlbumTitle,
} from './LibraryTagAlbumFields';
import LibraryTagBack from './LibraryTagBack';
import LibraryTagFixAlbumList from './LibraryTagFixAlbumList';
import LibraryTagSetCover from './LibraryTagSetCover';
import LibraryTagSetTools, { type IFindReplace } from './LibraryTagSetTools';
import LibraryTagSheet from './LibraryTagSheet';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { groupsOf } from './tagGroups';
import { useTagEditor } from './TagEditorContext';
import {
  changedFields,
  effectiveValue,
  fieldValues,
  findParts,
  initialSetState,
  isSetValid,
  type ISetState,
  requestOfSet,
  summarise,
  withCell,
  withShared,
} from './tagSetModel';
import { pendingChangesOf } from './tagChanges';
import { useEditorFix } from './useEditorFix';
import { albumSearchUrl, openInBrowser } from './tagWebSearch';
import { useTagSheets } from './useTagSheets';

/** Beside the cover, what most albums need. */
const MAIN_FIELDS: readonly TTagFieldKey[] = ['albumArtist', 'year', 'genre'];

/** Folded under "More fields": what fewer albums need. */
const MORE_FIELDS: readonly TTagFieldKey[] = [
  'artist',
  'trackTotal',
  'discNo',
  'publisher',
  'composer',
  'comment',
];

const WandGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="M2.5 13.5 10.5 5.5M9.5 2.5v2M12.5 3.5l-1.4 1.4M13.5 6.5h-2M7 2.8l.6.9" />
  </svg>
);

/**
 * AN ALBUM, A FOLDER OR A SELECTION, edited as the album page itself (the
 * 2026-11-16 mockup's design A, Ivan's pick): Back and Fix tags
 * automatically on one line; the cover (a press for a menu) beside the
 * album's name typed over the big title, its artist, year and genre, and the
 * rest folded; then the songs, with find & replace on their own line.
 * Nothing is written until Save, which shows only once there is something
 * to save; a write then runs from the shelf and the editor closes.
 */
const LibraryTagSetEditor = () => {
  const { t } = useTranslation();
  const {
    view,
    close,
    write,
    openFix,
    leavePage,
    setPageHasChanges,
    setPageChanges,
  } = useTagEditor();
  const ids = useMemo(() => (view?.kind === 'set' ? view.ids : []), [view]);
  const sheets = useTagSheets(ids);
  const tracks = useLibraryTracks(ids);
  const session = useLibraryPlayerSessionIfAny();
  const [state, setState] = useState<ISetState>(() => initialSetState(ids));
  const [finding, setFinding] = useState<IFindReplace>({
    find: '',
    replace: '',
  });
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
  const summary = useMemo(
    () => summarise(state, ordered, changes),
    [state, ordered, changes],
  );
  const hasChanges = summary.changeCount > 0;
  const isFolder = view?.kind === 'set' && view.scope === 'folder';
  const groups = useMemo(
    () => groupsOf(ordered, isFolder),
    [ordered, isFolder],
  );
  const fix = useEditorFix({
    ids,
    ordered,
    groups,
    isComplete: sheets.isComplete,
    isFixOpen: view?.kind === 'set' && view.fix === true,
    setState,
  });
  // A view or shelf pressed while there are edits asks before leaving.
  useEffect(() => {
    setPageHasChanges(hasChanges);
  }, [hasChanges, setPageHasChanges]);
  useEffect(() => () => setPageHasChanges(false), [setPageHasChanges]);
  // The side column lists what a Save would do, in place of Up Next.
  useEffect(() => {
    setPageChanges(pendingChangesOf(state, ordered, changes));
  }, [state, ordered, changes, setPageChanges]);
  useEffect(() => () => setPageChanges(undefined), [setPageChanges]);
  if (view?.kind !== 'set') {
    return null;
  }
  const canSave =
    hasChanges && sheets.isComplete && isSetValid(changes) && !isSaving;
  const found =
    finding.find === ''
      ? 0
      : ordered.filter((sheet) =>
          findParts(effectiveValue(state, sheet, 'title'), finding.find).some(
            (part) => part.isMatch,
          ),
        ).length;

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

  const onShared = (key: TTagFieldKey, value: string | undefined) =>
    setState((current) => withShared(current, key, value));
  // What most of the songs' artist says, when more than half agree on it.
  const [topArtist] = fieldValues(ordered, 'artist');
  const majorityArtist =
    topArtist &&
    topArtist.value !== '' &&
    !isPlaceholderName(topArtist.value) &&
    topArtist.count * 2 > ordered.length
      ? topArtist.value
      : undefined;
  // The album as the page has it now, typed or read, for a search opened
  // in the browser: a value the songs share, never a placeholder.
  const sharedValue = (key: TTagFieldKey): string | undefined => {
    const typed = state.shared[key];
    if (typed !== undefined) {
      return typed;
    }
    const [top] = fieldValues(ordered, key);
    return top && top.value !== '' && !isPlaceholderName(top.value)
      ? top.value
      : undefined;
  };
  const search = {
    artist: sharedValue('albumArtist') ?? sharedValue('artist'),
    album: sharedValue('album'),
  };
  const unreadable = sheets.readCount - ordered.length;
  const moreLabel = MORE_FIELDS.map((key) => t(FIELD_LABEL_KEYS[key])).join(
    ', ',
  );
  const fixLabel = t('library.tags.set.fixAuto');

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Ctrl+S saves from whichever field or cell has the caret
    <section
      className="library-tags-set"
      aria-label={view.title}
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
        <div className="library-tags-set__top">
          <LibraryTagBack />
          {fix.isChoosing && (
            <button
              type="button"
              className="button small subtle"
              onClick={fix.stopChoosing}
            >
              {t('library.tags.fix.editByHand')}
            </button>
          )}
          {!fix.isChoosing && (
            <button
              type="button"
              className="button small subtle library-tags-set__web"
              disabled={
                search.album === undefined && search.artist === undefined
              }
              title={t('library.tags.set.searchWebNote')}
              onClick={() =>
                openInBrowser(albumSearchUrl(search.artist, search.album))
              }
            >
              <MenuIcon name="external" />
              {t('library.tags.set.searchWeb')}
            </button>
          )}
          {!fix.isChoosing && (
            <button
              type="button"
              className="button small subtle library-tags-set__fix"
              disabled={!sheets.isComplete}
              onClick={fix.run}
            >
              <WandGlyph />
              {fixLabel}
            </button>
          )}
        </div>
        {fix.note !== undefined && !fix.isChoosing && (
          <p
            className={`library-tags-set__fixed${fix.note === 'nothing' ? ' is-nothing' : ''}`}
            role="status"
          >
            <WandGlyph />
            <span>
              {fix.note === 'nothing'
                ? t('library.tags.fix.nothingFound')
                : t('library.tags.fix.filled')}
              {fix.note === 'noPicture' &&
                ` ${t('library.tags.fix.noPicture')}`}
            </span>
          </p>
        )}
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
            {/* Leaving stops the reading; nothing was written. */}
            <button
              type="button"
              className="button small subtle"
              onClick={() => leavePage()}
            >
              {t('library.tags.set.cancelReading')}
            </button>
          </div>
        )}
        {unreadable > 0 && (
          <p className="library-tags__note is-warning">
            {t('library.tags.set.unreadable', { count: unreadable })}
          </p>
        )}
        {fix.isChoosing && (
          <LibraryTagFixAlbumList
            albums={fix.albums}
            onFix={(group) =>
              openFix(
                'album',
                group.sheets.map((sheet) => sheet.trackId),
                group.label ?? view.title,
                view.place,
              )
            }
          />
        )}
        {ordered.length > 0 && !fix.isChoosing && !fix.isPending && (
          <>
            <div className="library-tags-album">
              <LibraryTagSetCover
                sheets={ordered}
                tracks={tracks}
                cover={state.cover}
                search={search}
                onCover={(cover) =>
                  setState((current) => ({ ...current, cover }))
                }
              />
              <div className="library-tags-album__side">
                <LibraryTagAlbumTitle
                  fieldKey="album"
                  sheets={ordered}
                  state={state}
                  onShared={onShared}
                />
                <div className="library-tags-album__facts">
                  {MAIN_FIELDS.map((key) => (
                    <LibraryTagAlbumField
                      key={key}
                      fieldKey={key}
                      sheets={ordered}
                      state={state}
                      onShared={onShared}
                      suggestion={
                        key === 'albumArtist' ? majorityArtist : undefined
                      }
                    />
                  ))}
                </div>
                <details
                  className="library-tags-album__more"
                  // Open while it holds an edit, so a value Fix typed in
                  // there is never folded out of sight.
                  open={
                    MORE_FIELDS.some(
                      (key) => state.shared[key] !== undefined,
                    ) || undefined
                  }
                >
                  <summary>
                    {t('library.tags.set.moreFields', { fields: moreLabel })}
                  </summary>
                  <div className="library-tags-album__more-grid">
                    {MORE_FIELDS.map((key) => (
                      <LibraryTagAlbumField
                        key={key}
                        fieldKey={key}
                        sheets={ordered}
                        state={state}
                        onShared={onShared}
                      />
                    ))}
                  </div>
                </details>
              </div>
            </div>
            <LibraryTagSetTools
              groups={groups}
              ordered={ordered}
              finding={finding}
              onFinding={setFinding}
              found={found}
              onState={(update) => setState((current) => update(current))}
            />
            <LibraryTagSheet
              groups={groups}
              state={state}
              tracks={tracks}
              finding={finding}
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
      {(hasChanges || didRefuse) && (
        <footer className="library-tags-set__foot">
          <div className="library-tags-set__what" aria-live="polite">
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
            {didRefuse && (
              <span className="library-tags__note is-warning" role="alert">
                {t('library.tags.saveFailed')}
              </span>
            )}
          </div>
          <div className="library-tags-set__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={!hasChanges}
              onClick={() => {
                setState(initialSetState(ids));
                fix.clearNote();
              }}
            >
              {t('library.tags.set.discard')}
            </button>
            <button
              type="button"
              className="button small"
              disabled={!canSave}
              onClick={save}
            >
              {t('library.tags.save')}
            </button>
          </div>
        </footer>
      )}
    </section>
  );
};

export default LibraryTagSetEditor;
