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
import CompactFrame from '../components/CompactFrame';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';
import LibrarySearchField from './LibrarySearchField';
import LibraryTrackMenu from './LibraryTrackMenu';
import LibraryHeroSound from './LibraryHeroSound';
import { type TTagSetScope, useTagEditorIfAny } from './tags/TagEditorContext';

/** A playlist the reader may rename and remove — never Favourites. */
export interface IEditablePlaylist {
  id: string;
  name: string;
  rename: (name: string) => void;
  remove: () => void;
}

interface ILibraryDetailHeaderProps {
  /** What kind of record this is, the line over the title: "Album · Soul". */
  kind: string;
  title: string;
  /** Who made it, or where it is: the line under the title. */
  subtitle: string;
  /** The one directory everything in the table lives in, when there is one. */
  recordFolder?: string;
  /** The meta line: year, songs, length, format. */
  counts: string;
  /** Songs the toolbar's search lit inside a record it did not name. */
  matchedCount: number;
  isFolder: boolean;
  artId?: string;
  /** Anything to play: withheld for an empty playlist. */
  hasTracks: boolean;
  onPlay: () => void;
  /** The record from a song drawn at random, the player's Shuffle on. */
  onShuffle?: () => void;
  /** Show the record's one folder in Explorer; absent when it has several. */
  onReveal?: () => void;
  /** The player's shuffle is on: the Shuffle button is lit and turns it off. */
  isShuffled?: boolean;
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
  /** What "Edit tags" edits from this header: the album, the folder, or the
   * record's songs as a selection (an artist, a genre, a playlist). */
  tagScope?: { scope: TTagSetScope; title: string; place?: string };
  /** The album the record is, for its sound (Auto EQ). */
  album?: { key: string; title: string; artist: string };
  /** "Has a saved sound", narrowing the table (Auto EQ). */
  soundFilter?: { isOn: boolean; onToggle: () => void };
}

/**
 * THE RECORD'S HERO (the "A + C" design, Ivan 2026-11-14): the cover at
 * 136px, what kind of record it is, its name at 30px, who made it, one line
 * of facts, and the actions — Play the one loud button, Shuffle, Add to Up
 * Next, Show in Explorer, and the record's menu.
 */
const LibraryDetailHeader = ({
  kind,
  title,
  subtitle,
  recordFolder,
  counts,
  matchedCount,
  isFolder,
  artId,
  hasTracks,
  onPlay,
  onShuffle,
  onReveal,
  isShuffled = false,
  loadTrackIds,
  onlyTrack,
  onQueueTracks,
  openPlaylistId,
  editablePlaylist,
  onBack,
  filter,
  onFilter,
  tagScope,
  album,
  soundFilter,
}: ILibraryDetailHeaderProps) => {
  const { t } = useTranslation();
  const tagEditor = useTagEditorIfAny();
  /** The record's songs on the tag editor page. */
  const editRecordTags = (trackIds: readonly string[]) => {
    if (tagEditor && tagScope && trackIds.length > 0) {
      tagEditor.openSet(
        tagScope.scope,
        trackIds,
        tagScope.title,
        tagScope.place,
      );
    }
  };
  /** The record in the editor, with Fix's proposals filled in. */
  const fixRecordTags = (trackIds: readonly string[]) => {
    if (tagEditor && tagScope && trackIds.length > 0) {
      tagEditor.openFix(
        tagScope.scope,
        trackIds,
        tagScope.title,
        tagScope.place,
      );
    }
  };

  // Ctrl+I on the record's page edits the whole record, unless a row (which
  // answers Ctrl+I itself) or a text box has the keys.
  useEffect(() => {
    if (!tagEditor || !tagScope || !hasTracks) {
      return undefined;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'i' ||
        tagEditor.view !== undefined ||
        target?.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      event.preventDefault();
      // Ctrl+Shift+I fixes; Ctrl+I edits.
      const open = event.shiftKey ? tagEditor.openFix : tagEditor.openSet;
      loadTrackIds()
        .then((ids) => {
          if (ids.length > 0) {
            open(tagScope.scope, ids, tagScope.title, tagScope.place);
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tagEditor, tagScope, hasTracks, loadTrackIds]);
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
    <div className="library-hero">
      {isFolder ? (
        <LibraryFolderArt artId={artId} label={title} size="cover" />
      ) : (
        <LibraryCoverArt artId={artId} label={title} size="cover" />
      )}
      <div className="library-hero__info">
        {kind && <div className="library-hero__kind">{kind}</div>}
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
          <h2 className="library-hero__title" title={title}>
            {title}
          </h2>
        )}
        {subtitle && (
          <div className="library-hero__who" title={subtitle}>
            {subtitle}
          </div>
        )}
        <div className="library-hero__meta">
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
          {/* One plain button, and nothing counted: what Fix finds is
              worked out on the press, never in the background (Ivan,
              2026-11-15: no "N fixes found" unasked). */}
          {tagEditor &&
            tagScope &&
            tagScope.scope !== 'selection' &&
            hasTracks && (
              <>
                <span className="library-hero__meta-dot" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="library-hero__fix"
                  onClick={() => {
                    loadTrackIds()
                      .then(fixRecordTags)
                      .catch(() => undefined);
                  }}
                >
                  <MenuIcon
                    name="checkAll"
                    className="library-hero__fix-icon"
                  />
                  {t('library.tags.hero.fix')}
                </button>
              </>
            )}
        </div>
        <div className="library-hero__actions">
          {/* Emphasis follows recommendation: the one loud button on the
              screen. Withheld for an empty playlist — a Play that starts
              nothing is a click that does nothing. */}
          {hasTracks && (
            <button
              type="button"
              className="library-hero__button is-go"
              onClick={onPlay}
            >
              <MenuIcon
                name="playSolid"
                className="library-hero__button-icon"
              />
              <span>{t('library.play')}</span>
            </button>
          )}
          {hasTracks && onShuffle && (
            <button
              type="button"
              className={`library-hero__button${isShuffled ? ' is-on' : ''}`}
              aria-pressed={isShuffled}
              onClick={onShuffle}
            >
              <MenuIcon name="shuffle" className="library-hero__glyph" />
              <span>{t('library.shuffle')}</span>
            </button>
          )}
          {/* Play this after what is already going. With nothing playing
              the two do the same thing. */}
          {onQueueTracks && hasTracks && (
            <button
              type="button"
              className="library-hero__button"
              onClick={() => {
                loadTrackIds()
                  .then((ids) => {
                    onQueueTracks(ids);
                    return undefined;
                  })
                  .catch(() => undefined);
              }}
            >
              <MenuIcon name="queueAdd" className="library-hero__glyph" />
              <span>{t('library.queueAdd')}</span>
            </button>
          )}
          {/* Where the record lives, when all of it lives in one folder:
              shown through its first song, so main is only ever handed an id
              it knows and never a path. It was in the menu below alone. */}
          {onReveal && (
            <button
              type="button"
              className="library-hero__button"
              onClick={onReveal}
            >
              <MenuIcon name="folder" className="library-hero__glyph" />
              <span>{t('library.reveal')}</span>
            </button>
          )}
          {/* THE WHOLE RECORD, filed in one press — the menu a row opens,
              handed every song on the page. */}
          {hasTracks && (
            <>
              <button
                type="button"
                ref={containerMenuRef}
                className="library-hero__button is-icon"
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
                album={album}
                track={onlyTrack}
                openPlaylistId={openPlaylistId}
                // Add to up next and Show in Explorer are buttons beside this
                // menu, so the menu leaves them out rather than offering each
                // twice (Ivan, 2026-11-15: "options are duplicated"). Shown
                // in the menu only where the header has no button for it.
                onReveal={
                  onReveal
                    ? undefined
                    : (trackId) => {
                        window.electron.ipcRenderer
                          .revealLibraryTrack(trackId)
                          .catch(() => undefined);
                        setIsContainerMenuOpen(false);
                      }
                }
                // The record's folder, when all of it lives in one.
                onRevealFolder={
                  !onReveal &&
                  recordFolder !== undefined &&
                  menuTrackIds[0] !== undefined
                    ? () => {
                        window.electron.ipcRenderer
                          .revealLibraryTrack(menuTrackIds[0])
                          .catch(() => undefined);
                        setIsContainerMenuOpen(false);
                      }
                    : undefined
                }
                onEditTags={tagEditor && tagScope ? editRecordTags : undefined}
                editTagsLabel={
                  tagScope?.scope === 'album'
                    ? t('library.tags.menu.editAlbum')
                    : undefined
                }
                onFixTags={tagEditor && tagScope ? fixRecordTags : undefined}
                fixTagsLabel={
                  tagScope?.scope === 'album'
                    ? t('library.tags.menu.fixAlbum')
                    : undefined
                }
                onChangeCover={
                  tagEditor && tagScope && tagScope.scope !== 'selection'
                    ? () => editRecordTags(menuTrackIds)
                    : undefined
                }
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
                className="library-hero__button"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  setDraftName(editablePlaylist.name);
                }}
              >
                {t('library.playlist.rename')}
              </button>
              {/* Stays while its question is open: the question floats
                  from it, and the row must not change length under it. */}
              <button
                type="button"
                className="library-hero__button"
                aria-expanded={isConfirmingDelete}
                onClick={() => setIsConfirmingDelete(true)}
              >
                {t('library.playlist.delete')}
              </button>
            </>
          )}
          {hasTracks && (
            <LibraryHeroSound
              album={album}
              loadTrackIds={loadTrackIds}
              soundFilter={soundFilter}
            />
          )}
          {/* The record's own filter, at the far end of the actions: it
              narrows this record and nothing else, where the top bar's
              search looks through the whole library. */}
          <div className="library-hero__filter">
            <LibrarySearchField
              value={filter}
              onChange={onFilter}
              label={t('library.filterHere')}
              history={libraryFilterHistory}
            />
          </div>
        </div>
        {/* Two steps, no modal: the question floats under the buttons, over
            the table, and nothing moves while it asks. */}
        {editablePlaylist && draftName === undefined && isConfirmingDelete && (
          <CompactFrame
            className="library-detail__confirm"
            aria-modal="false"
            tone="danger"
            icon={<MenuIcon name="trash" />}
            title={t('library.playlist.deleteConfirm', {
              name: editablePlaylist.name,
            })}
            titleId="library-detail-delete-title"
            closeLabel={t('support.close')}
            onClose={() => setIsConfirmingDelete(false)}
            actions={
              <>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  {t('library.playlist.keep')}
                </button>
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => {
                    editablePlaylist.remove();
                    setIsConfirmingDelete(false);
                    onBack();
                  }}
                >
                  {t('library.playlist.delete')}
                </button>
              </>
            }
          />
        )}
      </div>
    </div>
  );
};

export default LibraryDetailHeader;
