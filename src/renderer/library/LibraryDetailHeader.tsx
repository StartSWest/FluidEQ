/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The drill-in's header: the record's picture, its name and where it lives,
 * how much is in it, what can be done with all of it at once, and the box
 * that narrows the table under it.
 */

import { useEffect, useRef, useState } from 'react';
import type { ILibraryTrack } from '../../common/library/types';
import { MAX_PLAYLIST_NAME_LENGTH } from '../../common/library/playlists';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import libraryFilterHistory from '../utils/libraryFilterHistory';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import TextInput from '../widgets/TextInput';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';
import LibrarySearchField from './LibrarySearchField';
import LibraryTrackMenu from './LibraryTrackMenu';

/** A playlist the reader may rename and remove — never Favourites. */
export interface IEditablePlaylist {
  id: string;
  name: string;
  rename: (name: string) => void;
  remove: () => void;
}

interface ILibraryDetailHeaderProps {
  title: string;
  subtitle: string;
  /** The one directory everything in the table lives in, when there is one. */
  recordFolder?: string;
  counts: string;
  /** Songs the toolbar's search lit inside a record it did not name. */
  matchedCount: number;
  isFolder: boolean;
  artId?: string;
  /** Anything to play: withheld for an empty playlist. */
  hasTracks: boolean;
  onPlay: () => void;
  /** Every id in the table, in its order, asked for when needed. */
  loadTrackIds: () => Promise<readonly string[]>;
  /** The one song, when the table holds exactly one. */
  onlyTrack?: ILibraryTrack;
  onQueueTracks?: (trackIds: readonly string[]) => void;
  openPlaylistId?: string;
  editablePlaylist?: IEditablePlaylist;
  onBack: () => void;
  filter: string;
  onFilter: (value: string) => void;
}

const LibraryDetailHeader = ({
  title,
  subtitle,
  recordFolder,
  counts,
  matchedCount,
  isFolder,
  artId,
  hasTracks,
  onPlay,
  loadTrackIds,
  onlyTrack,
  onQueueTracks,
  openPlaylistId,
  editablePlaylist,
  onBack,
  filter,
  onFilter,
}: ILibraryDetailHeaderProps) => {
  const { t } = useTranslation();
  /** The rename field while it is open. Empty is a legitimate half-typed
   * name, so "is it open" cannot be asked of the text. */
  const [draftName, setDraftName] = useState<string | undefined>(undefined);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  // The header's own "more" menu — the row menu, handed the whole record.
  const containerMenuRef = useRef<HTMLButtonElement | null>(null);
  const [menuTrackIds, setMenuTrackIds] = useState<readonly string[]>([]);
  const [isContainerMenuOpen, setIsContainerMenuOpen] = useState(false);

  // Closes on a click elsewhere and on Escape, the pattern every other
  // `AnchoredMenu` here uses.
  useEffect(() => {
    if (!isContainerMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        event.target !== containerMenuRef.current
      ) {
        setIsContainerMenuOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsContainerMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isContainerMenuOpen]);

  /** The menu is about the whole table: its ids are asked for as it opens,
   * and it opens once they are here — a menu over a record whose songs it
   * does not know yet would act on none of them. */
  const toggleContainerMenu = () => {
    if (isContainerMenuOpen) {
      setIsContainerMenuOpen(false);
      return;
    }
    loadTrackIds()
      .then((ids) => {
        setMenuTrackIds(ids);
        setIsContainerMenuOpen(true);
        return undefined;
      })
      .catch(() => undefined);
  };

  const submitName = (value: string) => {
    if (editablePlaylist && value.trim()) {
      editablePlaylist.rename(value.trim());
    }
    setDraftName(undefined);
  };

  return (
    <div className="library-detail__header">
      {isFolder ? (
        <LibraryFolderArt artId={artId} label={title} size="cover" />
      ) : (
        <LibraryCoverArt artId={artId} label={title} size="cover" />
      )}
      <div className="library-detail__info">
        {/* The name becomes the field it is edited in, in place. A modal for
            one text box would cover the very list that says which playlist
            this is. */}
        {draftName !== undefined ? (
          <div className="library-detail__rename">
            <TextInput
              value={draftName}
              ariaLabel={t('library.playlist.newName')}
              isDisabled={false}
              errorMessage=""
              formatInput={(value) => value.slice(0, MAX_PLAYLIST_NAME_LENGTH)}
              handleChange={setDraftName}
              handleSubmit={submitName}
              handleEscape={() => setDraftName(undefined)}
            />
            <button
              type="button"
              className="button small"
              disabled={draftName.trim().length === 0}
              onClick={() => submitName(draftName)}
            >
              {t('library.playlist.rename')}
            </button>
          </div>
        ) : (
          <h2 className="library-detail__title">{title}</h2>
        )}
        {subtitle && <p className="library-detail__subtitle">{subtitle}</p>}
        {recordFolder !== undefined && (
          <p className="library-detail__where" title={recordFolder}>
            <MenuIcon name="folder" className="library-detail__where-icon" />
            <span>{recordFolder}</span>
          </p>
        )}
        <p className="library-detail__counts">
          {/* How many of how many, when the search named songs inside rather
              than this record: the honest answer to "why is this compilation
              on screen at all". */}
          {matchedCount > 0 && (
            <>
              <b className="library-detail__matched">{matchedCount}</b>
              <span aria-hidden="true"> / </span>
            </>
          )}
          {counts}
        </p>
        <div className="library-detail__actions">
          {/* Emphasis follows recommendation: the one filled button on the
              screen. Withheld for an empty playlist — a Play that starts
              nothing is the click-that-does-nothing this project treats as a
              bug. */}
          {hasTracks && (
            <button
              type="button"
              className="button small library-detail__play"
              onClick={onPlay}
            >
              <MenuIcon name="play" className="library-detail__play-icon" />
              <span>{t('library.play')}</span>
            </button>
          )}
          {/* The quiet one beside it: play this after what is already going.
              With nothing playing the two do the same thing. */}
          {onQueueTracks && hasTracks && (
            <button
              type="button"
              className="button small subtle library-detail__queue"
              onClick={() => {
                loadTrackIds()
                  .then((ids) => {
                    onQueueTracks(ids);
                    return undefined;
                  })
                  .catch(() => undefined);
              }}
            >
              {t('library.queueAdd')}
            </button>
          )}
          {/* THE WHOLE RECORD, filed in one press — the menu a row opens,
              handed every song on the page. */}
          {hasTracks && (
            <>
              <button
                type="button"
                ref={containerMenuRef}
                className="button small subtle library-detail__more"
                aria-label={t('library.trackMenu')}
                title={t('library.trackMenu')}
                aria-haspopup="menu"
                aria-expanded={isContainerMenuOpen}
                onClick={toggleContainerMenu}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3" cy="8" r="1.4" />
                  <circle cx="8" cy="8" r="1.4" />
                  <circle cx="13" cy="8" r="1.4" />
                </svg>
              </button>
              <LibraryTrackMenu
                anchor={containerMenuRef.current}
                isOpen={isContainerMenuOpen}
                trackIds={menuTrackIds}
                track={onlyTrack}
                openPlaylistId={openPlaylistId}
                onQueueTracks={onQueueTracks}
                // Show in Explorer is only ever offered for one song, and a
                // record of one is the only way this fires.
                onReveal={(trackId) => {
                  window.electron.ipcRenderer
                    .revealLibraryTrack(trackId)
                    .catch(() => undefined);
                  setIsContainerMenuOpen(false);
                }}
                onClose={() => setIsContainerMenuOpen(false)}
              />
            </>
          )}
          {/* Absent for Favourites rather than disabled: it is not a thing you
              may not do to it today, it is a thing that is never true of it. */}
          {editablePlaylist && draftName === undefined && (
            <>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  setDraftName(editablePlaylist.name);
                }}
              >
                {t('library.playlist.rename')}
              </button>
              {isConfirmingDelete ? (
                <span
                  className="library-detail__confirm"
                  role="alertdialog"
                  aria-label={t('library.playlist.delete')}
                >
                  <span>
                    {t('library.playlist.deleteConfirm', {
                      name: editablePlaylist.name,
                    })}
                  </span>
                  {/* The decline wears the quiet style and the action the
                      reader already asked for wears the loud one. */}
                  <button
                    type="button"
                    className="button small"
                    onClick={() => {
                      editablePlaylist.remove();
                      setIsConfirmingDelete(false);
                      onBack();
                    }}
                  >
                    {t('library.playlist.delete')}
                  </button>
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    {t('library.playlist.keep')}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  {t('library.playlist.delete')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Over the table it narrows, on the line the sleeve ends on. It
          filters this record and nothing else; the toolbar's own box is
          withheld while a drill-in is open, so there is one search on screen
          and it does what the screen it is on suggests. */}
      <div className="library-detail__search">
        <LibrarySearchField
          value={filter}
          onChange={onFilter}
          label={t('library.filterHere')}
          history={libraryFilterHistory}
        />
      </div>
    </div>
  );
};

export default LibraryDetailHeader;
