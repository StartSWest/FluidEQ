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

import { useState } from 'react';
import { countTagItems } from '../../../common/library/tagFields';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { useTagEditor } from './TagEditorContext';
import { CloseGlyph } from './LibraryTagSongPanel';
import { PutBackGlyph } from './LibraryTagField';

/**
 * A write, from its first file to its result (the mockup's section 5):
 * progress with the file being written, Continue in background and Cancel;
 * then what came of it — every file updated, some that need an answer, or
 * a stop — with Undo for all of it. In the background it folds to one line
 * at the foot of the shelf.
 */
const LibraryTagWriteCard = () => {
  const { t } = useTranslation();
  const {
    job,
    undoable,
    cancel,
    undo,
    isProblemsOpen,
    setIsProblemsOpen,
    isJobInBackground,
    setIsJobInBackground,
  } = useTagEditor();
  const [dismissed, setDismissed] = useState<string | undefined>(undefined);
  // Undo rewrites every file the write touched: it asks first (Ivan,
  // 2026-11-16: "deshacer también necesita confirmación").
  const [isAskingUndo, setIsAskingUndo] = useState(false);

  if (job === undefined || job.items.length === 0 || dismissed === job.jobId) {
    return null;
  }
  const counts = countTagItems(job.items);
  const done = counts.total - counts.waiting;
  const isUndo = job.kind === 'undo';
  const current = job.items.find((item) => item.state === 'writing');
  const needYou = counts.needYou + counts.held;
  const percent = counts.total === 0 ? 0 : (done / counts.total) * 100;

  if (!job.isSettled && isJobInBackground) {
    return (
      <div className="library-tags-line" role="status">
        <span className="library-tags-line__spin" aria-hidden="true" />
        <span className="library-tags-line__text">
          {t(
            isUndo
              ? 'library.tags.write.undoing'
              : 'library.tags.write.progress',
            {
              done,
              count: counts.total,
            },
          )}
        </span>
        <span className="library-tags__bar is-line">
          <i style={{ width: `${percent}%` }} />
        </span>
        <button
          type="button"
          className="button small subtle"
          onClick={() => setIsJobInBackground(false)}
        >
          {t('library.tags.write.show')}
        </button>
      </div>
    );
  }

  if (!job.isSettled) {
    return (
      <div className="library-tags-card" role="status" aria-live="polite">
        <div className="library-tags-card__top">
          <span className="library-tags-line__spin" aria-hidden="true" />
          <b>
            {t(
              isUndo
                ? 'library.tags.write.undoing'
                : 'library.tags.write.progress',
              {
                done: Math.min(done + 1, counts.total),
                count: counts.total,
              },
            )}
          </b>
          {current && (
            <span className="library-tags-card__file">{current.fileName}</span>
          )}
        </div>
        <span className="library-tags__bar">
          <i style={{ width: `${percent}%` }} />
        </span>
        <div className="library-tags-card__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => setIsJobInBackground(true)}
          >
            {t('library.tags.write.background')}
          </button>
          {!isUndo && (
            <button
              type="button"
              className="button small subtle"
              onClick={cancel}
            >
              {t('library.tags.write.cancel')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const stopped = job.isCancelled && counts.skipped > 0;
  let title: string;
  let note: string;
  if (isUndo) {
    title = t('library.tags.write.undone');
    note = t('library.tags.write.undoneNote');
  } else if (stopped) {
    title = t('library.tags.write.stopped', {
      done: counts.written,
      count: counts.total,
    });
    note = t('library.tags.write.stoppedNote');
  } else if (needYou > 0) {
    title = t('library.tags.write.written', {
      done: counts.written,
      count: counts.total,
    });
    note = t('library.tags.write.needYou', { count: needYou });
  } else {
    title =
      counts.written === 1
        ? t('library.tags.write.doneOne')
        : t('library.tags.write.done', { count: counts.written });
    note = t('library.tags.write.doneNote');
  }

  return (
    <div
      className={`library-tags-card is-settled${counts.failed > 0 ? ' has-failed' : ''}`}
      role="status"
    >
      <MenuIcon
        name={needYou > 0 || counts.failed > 0 ? 'alert' : 'check'}
        className="library-tags-card__icon"
      />
      <div className="library-tags-card__text">
        <b>{title}</b>
        <span>{note}</span>
        {counts.failed > 0 && (
          <span className="library-tags-card__failed">
            {counts.failed === 1
              ? t('library.tags.write.failedOne')
              : t('library.tags.write.failed', { count: counts.failed })}
          </span>
        )}
      </div>
      <div className="library-tags-card__actions">
        {(needYou > 0 || counts.failed > 0) && !isProblemsOpen && (
          <button
            type="button"
            className="button small"
            onClick={() => setIsProblemsOpen(true)}
          >
            {needYou + counts.failed === 1
              ? t('library.tags.write.reviewOne')
              : t('library.tags.write.review', {
                  count: needYou + counts.failed,
                })}
          </button>
        )}
        {undoable !== undefined && !isUndo && !isAskingUndo && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => setIsAskingUndo(true)}
          >
            <PutBackGlyph />
            {t('library.tags.write.undo')}
          </button>
        )}
        {undoable !== undefined && !isUndo && isAskingUndo && (
          <span className="library-tags-card__ask" role="alert">
            <span>
              {counts.written === 1
                ? t('library.tags.write.undoAskOne')
                : t('library.tags.write.undoAsk', { count: counts.written })}
            </span>
            <button
              type="button"
              className="button small subtle"
              onClick={() => setIsAskingUndo(false)}
            >
              {t('library.tags.write.undoKeep')}
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={() => {
                setIsAskingUndo(false);
                undo();
              }}
            >
              {t('library.tags.write.undoConfirm')}
            </button>
          </span>
        )}
        <button
          type="button"
          className="library-tags__icon-button"
          title={t('library.tags.write.dismiss')}
          aria-label={t('library.tags.write.dismiss')}
          onClick={() => {
            setDismissed(job.jobId);
            setIsProblemsOpen(false);
          }}
        >
          <CloseGlyph />
        </button>
      </div>
    </div>
  );
};

export default LibraryTagWriteCard;
