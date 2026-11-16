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
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  cleanTagValue,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import Spinner from '../../icons/Spinner';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryTracks } from '../useLibraryTracks';
import LibraryTagSongForm from './LibraryTagSongForm';
import { useTagEditor } from './TagEditorContext';
import { countDraftChanges, type ITagDraft } from './tagDrafts';
import { useTagSheets } from './useTagSheets';

const ArrowGlyph = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d={up ? 'm3.5 10 4.5-4.5 4.5 4.5' : 'm3.5 6 4.5 4.5L12.5 6'} />
  </svg>
);

export const CloseGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

/** True when every value a draft holds is one main will take. */
const isDraftValid = (draft: ITagDraft): boolean =>
  (Object.keys(draft.fields) as TTagFieldKey[]).every(
    (key) => cleanTagValue(key, draft.fields[key] ?? '') !== undefined,
  );

/**
 * ONE SONG'S TAGS, beside the list (the mockup's section 2): the list stays
 * in view, so walking the album with ‹ › or Alt+↑↓ shows each edit land in
 * its row's neighbourhood. Edits wait per song while walking; the foot
 * counts them and one Save writes them all. Esc closes and keeps them.
 */
const LibraryTagSongPanel = () => {
  const { t } = useTranslation();
  const { view, walkTo, close, drafts, setDraft, discardDrafts, saveDrafts } =
    useTagEditor();
  const [didRefuse, setDidRefuse] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const ids = view?.kind === 'song' ? view.ids : [];
  const index = view?.kind === 'song' ? view.index : 0;
  const trackId = ids[index];
  const wanted = useMemo(
    () => (trackId === undefined ? [] : [trackId]),
    [trackId],
  );
  const sheets = useTagSheets(wanted);
  const tracks = useLibraryTracks(wanted);

  // Each song opens at its top, as a new page would.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    setDidRefuse(false);
  }, [trackId]);

  if (view?.kind !== 'song' || trackId === undefined) {
    return null;
  }
  const result = sheets.results.get(trackId);
  const track = tracks.get(trackId) ?? undefined;
  const draft = drafts.get(trackId);
  const changeCount = [...drafts.values()].reduce(
    (sum, each) => sum + countDraftChanges(each),
    0,
  );
  const songCount = drafts.size;
  const canSave = changeCount > 0 && [...drafts.values()].every(isDraftValid);

  const save = () => {
    if (!canSave) {
      return;
    }
    saveDrafts()
      .then((taken) => setDidRefuse(!taken))
      .catch(() => setDidRefuse(true));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.altKey &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      walkTo(index + (event.key === 'ArrowUp' ? -1 : 1));
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 's'
    ) {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const body = () => {
    if (result === undefined) {
      return (
        <div className="library-tags__state" role="status">
          <Spinner />
          <span>{t('library.tags.panel.reading')}</span>
        </div>
      );
    }
    if (result.state !== 'ok') {
      const key = {
        missing: 'library.tags.panel.missing',
        unsupported: 'library.tags.panel.unsupported',
        failed: 'library.tags.panel.readFailed',
      } as const;
      return (
        <p className="library-tags__state" role="alert">
          {t(key[result.state])}
        </p>
      );
    }
    return (
      <LibraryTagSongForm
        sheet={result.sheet}
        track={track}
        draft={draft}
        onDraft={(next) => setDraft(trackId, next)}
      />
    );
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the panel's keys (Alt+arrows, Ctrl+S, Esc) reach it from whichever field has the caret
    <aside
      className="library-tags-panel"
      aria-label={t('library.tags.panel.title')}
      onKeyDown={onKeyDown}
    >
      <header className="library-tags-panel__head">
        <h3>
          {t('library.tags.panel.title')}
          {ids.length > 1 && (
            <span>
              {t('library.tags.panel.position', {
                index: index + 1,
                count: ids.length,
              })}
            </span>
          )}
        </h3>
        {ids.length > 1 && (
          <>
            <button
              type="button"
              className="library-tags__icon-button"
              title={t('library.tags.panel.previous')}
              aria-label={t('library.tags.panel.previous')}
              disabled={index === 0}
              onClick={() => walkTo(index - 1)}
            >
              <ArrowGlyph up />
            </button>
            <button
              type="button"
              className="library-tags__icon-button"
              title={t('library.tags.panel.next')}
              aria-label={t('library.tags.panel.next')}
              disabled={index === ids.length - 1}
              onClick={() => walkTo(index + 1)}
            >
              <ArrowGlyph up={false} />
            </button>
          </>
        )}
        <button
          type="button"
          className="library-tags__icon-button"
          title={t('library.tags.panel.close')}
          aria-label={t('library.tags.panel.close')}
          onClick={close}
        >
          <CloseGlyph />
        </button>
      </header>
      <div className="library-tags-panel__body" ref={bodyRef}>
        {body()}
      </div>
      <footer className="library-tags-panel__foot">
        <div className="library-tags-panel__what" aria-live="polite">
          {changeCount > 0 ? (
            <>
              <b>
                {changeCount === 1
                  ? t('library.tags.foot.changesOne')
                  : t('library.tags.foot.changes', { count: changeCount })}
              </b>
              {songCount === 1
                ? t('library.tags.foot.inSongsOne')
                : t('library.tags.foot.inSongs', { count: songCount })}
            </>
          ) : (
            <>
              <b>{t('library.tags.foot.none')}</b>
              {t('library.tags.foot.noneHint')}
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
          disabled={changeCount === 0}
          onClick={() => discardDrafts()}
        >
          {t('library.tags.revert')}
        </button>
        <button
          type="button"
          className="button small"
          disabled={!canSave}
          onClick={save}
        >
          {songCount > 1
            ? t('library.tags.saveSongs', { count: songCount })
            : t('library.tags.save')}
        </button>
      </footer>
    </aside>
  );
};

export default LibraryTagSongPanel;
