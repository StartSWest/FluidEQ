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

import { useMemo } from 'react';
import {
  countTagItems,
  type ITagJobItem,
} from '../../../common/library/tagFields';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
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

/**
 * The files a write could not finish, each with what can be done about it:
 * a song playing in FluidEQ waits for its end and asks nothing; a file
 * another program holds gets Retry and Skip; a read-only one is asked,
 * never forced — Make writable and write, or Skip.
 */
const LibraryTagProblemsPanel = () => {
  const { t } = useTranslation();
  const { job, isProblemsOpen, setIsProblemsOpen, answer } = useTagEditor();
  const items = useMemo(
    () => (job?.items ?? []).filter((item) => NEEDS_LOOK.has(item.state)),
    [job],
  );
  const ids = useMemo(() => items.map((item) => item.trackId), [items]);
  const tracks = useLibraryTracks(ids);

  if (!isProblemsOpen || job === undefined) {
    return null;
  }
  const counts = countTagItems(job.items);
  const open = counts.needYou;
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
        return t('library.tags.problems.failed');
    }
  };

  const actions = (item: ITagJobItem) => {
    if (item.state === 'locked') {
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
    if (item.state === 'held') {
      return (
        <span className="library-tags__note">
          {t('library.tags.problems.nothingToDo')}
        </span>
      );
    }
    return null;
  };

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
          return (
            <div key={item.trackId} className="library-tags-problem">
              <div className="library-tags-problem__top">
                <LibraryCoverArt
                  artId={track?.artId}
                  label={track?.title ?? item.fileName}
                  size="row"
                />
                <div className="library-tags-problem__name">
                  <b>{track?.title ?? item.fileName}</b>
                  <span>{item.fileName}</span>
                </div>
              </div>
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
                .filter(
                  (item) =>
                    item.state === 'locked' || item.state === 'read-only',
                )
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
