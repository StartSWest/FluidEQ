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

import { useEffect, useMemo, useState } from 'react';
import {
  countTagItems,
  type ITagJobItem,
  type TTagFailReason,
} from '../../../common/library/tagFields';
import type { TranslationKey } from '../../../common/i18n';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import LibraryCoverArt from '../LibraryCoverArt';
import { useLibraryTracks } from '../useLibraryTracks';
import { CloseGlyph } from './LibraryTagSongPanel';
import { useTagEditor } from './TagEditorContext';

const NEEDS_LOOK = new Set([
  'held',
  'locked',
  'read-only',
  'failed',
  'missing',
]);

/** Why a file failed, said so it can be acted on rather than shrugged at. */
const FAIL_KEYS: Record<TTagFailReason, TranslationKey> = {
  copy: 'library.tags.problems.failedCopy',
  tags: 'library.tags.problems.failedTags',
  check: 'library.tags.problems.failedCheck',
  undo: 'library.tags.problems.failedUndo',
  place: 'library.tags.problems.failedPlace',
};

/** States a file can be tried again from, or let go. */
const ANSWERABLE = new Set(['locked', 'read-only', 'failed']);

/**
 * The files a write could not finish, each with what can be done about it
 * (Ivan, 2026-11-17: "need a way to resolve conflicts ... if I click on the
 * conflict ... I want to have options"): a song playing in FluidEQ waits
 * for its end and asks nothing; a file another program holds, or one that
 * failed, gets Retry and Skip and says why it failed; a read-only one is
 * asked, never forced. A press on a file opens its options: its tags in
 * the song panel, the file in Explorer, Retry, Skip.
 */
const LibraryTagProblemsPanel = () => {
  const { t } = useTranslation();
  const { job, isProblemsOpen, setIsProblemsOpen, answer, openSong } =
    useTagEditor();
  const items = useMemo(
    () => (job?.items ?? []).filter((item) => NEEDS_LOOK.has(item.state)),
    [job],
  );
  const ids = useMemo(() => items.map((item) => item.trackId), [items]);
  const tracks = useLibraryTracks(ids);
  const [menu, setMenu] = useState<
    { trackId: string; anchor: HTMLElement } | undefined
  >(undefined);

  // Closes on a press elsewhere and on Escape, as the Library's menus do.
  useEffect(() => {
    if (menu === undefined) {
      return undefined;
    }
    const onDown = (event: MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target) && event.target !== menu.anchor) {
        setMenu(undefined);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(undefined);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (!isProblemsOpen || job === undefined) {
    return null;
  }
  const counts = countTagItems(job.items);
  // A file that failed still needs a look: "all handled" over one was the
  // panel saying the opposite of what its own line said.
  const open = counts.needYou + counts.failed;
  let headline = t('library.tags.problems.title', { count: open });
  if (open === 0) {
    headline = t('library.tags.problems.allHandled');
  } else if (open === 1) {
    headline = t('library.tags.problems.titleOne');
  }

  const why = (item: ITagJobItem) => {
    switch (item.state) {
      case 'held':
        return t('library.tags.problems.held');
      case 'locked':
        return t('library.tags.problems.locked');
      case 'read-only':
        return t('library.tags.problems.readOnly');
      case 'missing':
        return t('library.tags.problems.missing');
      default:
        return item.reason
          ? t(FAIL_KEYS[item.reason])
          : t('library.tags.problems.failed');
    }
  };

  const actions = (item: ITagJobItem) => {
    if (item.state === 'read-only') {
      return (
        <>
          <button
            type="button"
            className="button small"
            onClick={() => answer(item.trackId, 'make-writable')}
          >
            {t('library.tags.problems.makeWritable')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => answer(item.trackId, 'skip')}
          >
            {t('library.tags.problems.skip')}
          </button>
        </>
      );
    }
    if (item.state === 'locked' || item.state === 'failed') {
      return (
        <>
          <button
            type="button"
            className="button small"
            onClick={() => answer(item.trackId, 'retry')}
          >
            {t('library.tags.problems.retry')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => answer(item.trackId, 'skip')}
          >
            {t('library.tags.problems.skip')}
          </button>
        </>
      );
    }
    if (item.state === 'held') {
      return (
        <span className="library-tags__note">
          {t('library.tags.problems.nothingToDo')}
        </span>
      );
    }
    return null;
  };

  const menuItem = menu
    ? items.find((item) => item.trackId === menu.trackId)
    : undefined;

  return (
    <aside
      className="library-tags-panel is-problems"
      aria-label={t('library.tags.problems.allHandled')}
    >
      <header className="library-tags-panel__head">
        <h3>
          {headline}
          {counts.held > 0 && (
            <span>
              {counts.held === 1
                ? t('library.tags.problems.waitingOne')
                : t('library.tags.problems.waiting', { count: counts.held })}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="library-tags__icon-button"
          aria-label={t('library.tags.write.dismiss')}
          title={t('library.tags.write.dismiss')}
          onClick={() => setIsProblemsOpen(false)}
        >
          <CloseGlyph />
        </button>
      </header>
      <div className="library-tags-panel__body">
        {items.map((item) => {
          const track = tracks.get(item.trackId) ?? undefined;
          const isBad =
            item.state === 'read-only' ||
            item.state === 'failed' ||
            item.state === 'missing';
          const isMenuOpen = menu?.trackId === item.trackId;
          return (
            <div key={item.trackId} className="library-tags-problem">
              <button
                type="button"
                className="library-tags-problem__top"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                title={t('library.tags.problems.options')}
                onClick={(event) => {
                  const anchor = event.currentTarget;
                  setMenu((current) =>
                    current?.trackId === item.trackId
                      ? undefined
                      : { trackId: item.trackId, anchor },
                  );
                }}
              >
                <LibraryCoverArt
                  artId={track?.artId}
                  label={track?.title ?? item.fileName}
                  size="row"
                />
                <span className="library-tags-problem__name">
                  <b>{track?.title ?? item.fileName}</b>
                  <span>{item.fileName}</span>
                </span>
                <MenuIcon name="menu" className="library-tags-problem__more" />
              </button>
              <p
                className={`library-tags-problem__why${isBad ? ' is-bad' : ''}`}
              >
                <MenuIcon
                  name={item.state === 'read-only' ? 'lock' : 'alert'}
                />
                <span>{why(item)}</span>
              </p>
              <div className="library-tags-problem__actions">
                {actions(item)}
              </div>
            </div>
          );
        })}
      </div>
      <AnchoredMenu
        anchor={menu?.anchor ?? null}
        isOpen={menuItem !== undefined}
        className="library-list__menu"
        ariaLabel={t('library.tags.problems.options')}
      >
        {menuItem && (
          <>
            <button
              type="button"
              onClick={() => {
                setMenu(undefined);
                setIsProblemsOpen(false);
                openSong([menuItem.trackId], menuItem.trackId);
              }}
            >
              <MenuIcon name="pencil" className="library-list__menu-icon" />
              <span>{t('library.tags.problems.openTags')}</span>
            </button>
            {menuItem.state !== 'missing' && (
              <button
                type="button"
                onClick={() => {
                  setMenu(undefined);
                  window.electron.ipcRenderer
                    .revealLibraryTrack(menuItem.trackId)
                    .catch(() => undefined);
                }}
              >
                <MenuIcon name="folder" className="library-list__menu-icon" />
                <span>{t('library.tags.problems.reveal')}</span>
              </button>
            )}
            {ANSWERABLE.has(menuItem.state) && (
              <>
                <div className="library-list__menu-rule" role="none" />
                <button
                  type="button"
                  onClick={() => {
                    setMenu(undefined);
                    answer(
                      menuItem.trackId,
                      menuItem.state === 'read-only'
                        ? 'make-writable'
                        : 'retry',
                    );
                  }}
                >
                  <MenuIcon
                    name="restart"
                    className="library-list__menu-icon"
                  />
                  <span>
                    {menuItem.state === 'read-only'
                      ? t('library.tags.problems.makeWritable')
                      : t('library.tags.problems.retry')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(undefined);
                    answer(menuItem.trackId, 'skip');
                  }}
                >
                  <MenuIcon name="clear" className="library-list__menu-icon" />
                  <span>{t('library.tags.problems.skip')}</span>
                </button>
              </>
            )}
          </>
        )}
      </AnchoredMenu>
      <footer className="library-tags-panel__foot">
        <div className="library-tags-panel__what">
          <b>{t('library.tags.problems.everythingElse')}</b>
          {t('library.tags.problems.undoCovers')}
        </div>
        {open > 0 && (
          <button
            type="button"
            className="button small subtle"
            onClick={() =>
              items
                .filter((item) => ANSWERABLE.has(item.state))
                .forEach((item) => answer(item.trackId, 'skip'))
            }
          >
            {t('library.tags.problems.skipAll')}
          </button>
        )}
      </footer>
    </aside>
  );
};

export default LibraryTagProblemsPanel;
