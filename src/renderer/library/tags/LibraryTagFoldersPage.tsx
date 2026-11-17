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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ILibraryFolderItem } from '../../../common/library/query';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import LibraryCoverArt from '../LibraryCoverArt';
import LibraryTagBack from './LibraryTagBack';
import { useTagEditor } from './TagEditorContext';

/** Folders asked for at a time, as the Library's own lists page. */
const PAGE = 100;

/** A folder's own songs, at most, for the editor. */
const MAX_FOLDER_SONGS = 5000;

/** "D:/Music/[Rock]/Avril Lavigne/X" under "D:/Music": "[Rock]/Avril Lavigne". */
const placeUnder = (folderId: string, parent: string): string => {
  const inner = folderId.startsWith(`${parent}/`)
    ? folderId.slice(parent.length + 1)
    : folderId;
  const steps = inner.split('/');
  return steps.slice(0, -1).join(' › ');
};

/**
 * A folder too big to edit at once: the folders in it that hold songs,
 * from the Library's index — no file is read until one is opened — a page
 * at a time as the list is scrolled, each with Fix and Edit. One opens in
 * the editor alone; Back and Save come back here, the saved one marked
 * (Ivan, 2026-11-17: "we need a better way to handle this type of request",
 * "save ram so it doesn't load all in memory and have same treatment as in
 * the library lists").
 */
const LibraryTagFoldersPage = () => {
  const { t } = useTranslation();
  const { view, openFromFolders, doneFolders } = useTagEditor();
  const list = view?.kind === 'folders' ? view : undefined;
  const [rows, setRows] = useState<ILibraryFolderItem[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [opening, setOpening] = useState<string | undefined>(undefined);
  const isLoading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const folderId = list?.folderId;

  const loadMore = useCallback(
    (offset: number) => {
      if (folderId === undefined || isLoading.current) {
        return;
      }
      isLoading.current = true;
      window.electron.ipcRenderer
        .queryLibrary({
          type: 'page',
          query: {
            shelf: 'folders',
            scope: { beneath: folderId, kind: 'audio' },
            direction: 'asc',
          },
          offset,
          limit: PAGE,
        })
        .then((page) => {
          isLoading.current = false;
          setTotal(page.total);
          const folders = page.items.filter(
            (item): item is ILibraryFolderItem => item.kind === 'folder',
          );
          setRows((current) =>
            offset === 0 ? folders : [...current, ...folders],
          );
          return undefined;
        })
        .catch(() => {
          isLoading.current = false;
        });
    },
    [folderId],
  );

  useEffect(() => {
    setRows([]);
    setTotal(undefined);
    loadMore(0);
  }, [loadMore]);

  // The next page when the list's foot comes into view: the Library's lists
  // read the same way, so a folder of a thousand albums holds only what is
  // on screen and a little more.
  useEffect(() => {
    const foot = sentinel.current;
    if (foot === null || total === undefined || rows.length >= total) {
      return undefined;
    }
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore(rows.length);
      }
    });
    watch.observe(foot);
    return () => watch.disconnect();
  }, [rows.length, total, loadMore]);

  if (list === undefined) {
    return null;
  }

  const open = (folder: ILibraryFolderItem, fix: boolean) => {
    setOpening(folder.id);
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'ids',
        query: {
          shelf: 'tracks',
          scope: { folder: folder.id, kind: 'audio' },
          natural: 'path',
          direction: 'asc',
        },
        offset: 0,
        limit: MAX_FOLDER_SONGS,
      })
      .then((ids) => {
        setOpening(undefined);
        if (ids.length > 0) {
          openFromFolders(list, folder.id, folder.name, ids, fix);
        }
        return undefined;
      })
      .catch(() => setOpening(undefined));
  };

  const isFix = list.mode === 'fix';
  return (
    <section className="library-tags-set library-tags-folders">
      <div className="library-tags-set__scroll">
        <div className="library-tags-set__top">
          <LibraryTagBack />
        </div>
        <header className="library-tags-folders__head">
          <div className="library-tags-set__eyebrow">
            <b>{t('library.tags.folders.eyebrow')}</b>
            {total !== undefined &&
              ` · ${t('library.tags.folders.count', { count: total })}`}
          </div>
          <h2>{list.title}</h2>
          <p>{t('library.tags.folders.lead')}</p>
        </header>
        <div className="library-tags-folders__list">
          {rows.map((folder) => {
            const isDone = doneFolders.has(folder.id);
            const place = placeUnder(folder.id, list.folderId);
            return (
              <div
                key={folder.id}
                className={`library-tags-folders__row${isDone ? ' is-done' : ''}`}
              >
                <span className="library-tags-folders__cover">
                  <LibraryCoverArt
                    artId={folder.artId}
                    label={folder.name}
                    size="row"
                  />
                </span>
                <span className="library-tags-folders__name">
                  <b title={folder.id}>{folder.name}</b>
                  <span>
                    {place !== '' && `${place} · `}
                    {folder.trackCount === 1
                      ? t('library.trackCountOne')
                      : t('library.trackCount', { count: folder.trackCount })}
                  </span>
                </span>
                {isDone && (
                  <span className="library-tags-folders__done">
                    <MenuIcon name="check" />
                    {t('library.tags.folders.saved')}
                  </span>
                )}
                <span className="library-tags-folders__actions">
                  <button
                    type="button"
                    className={`button small${isFix ? '' : ' subtle'}`}
                    disabled={opening !== undefined}
                    onClick={() => open(folder, true)}
                  >
                    {t('library.tags.fix.fixAlbum')}
                  </button>
                  <button
                    type="button"
                    className={`button small${isFix ? ' subtle' : ''}`}
                    disabled={opening !== undefined}
                    onClick={() => open(folder, false)}
                  >
                    {t('library.tags.folders.edit')}
                  </button>
                </span>
              </div>
            );
          })}
          <div ref={sentinel} className="library-tags-folders__foot" />
        </div>
      </div>
    </section>
  );
};

export default LibraryTagFoldersPage;
