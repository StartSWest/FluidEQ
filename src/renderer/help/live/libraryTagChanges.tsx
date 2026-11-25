/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { isPlaceholderName } from 'common/library/tagFix';
import type { IPendingChanges } from '../../library/tags/tagChanges';
import { FIELD_LABEL_KEYS } from '../../library/tags/tagLabels';
import { useTranslation } from '../../utils/I18nContext';

/**
 * What a Save would do, beside the album page in Help's tag editor drawing
 * (`libraryTagFigure`): `LibraryTagChangesPanel`'s markup, class for class,
 * given the changes the drawing worked out — the panel itself reads them
 * from the editor's context, which acts. The album's values, then each
 * song's own, then the files' new names.
 */

const isNothing = (value: string) => value === '' || isPlaceholderName(value);

/** One change: an addition in green, or the old value struck beside it. */
const Change = ({ before, after }: { before: string[]; after: string }) => {
  const was = before.filter((value) => !isNothing(value));
  return (
    <span className="library-tags-changes__value">
      {was.length > 0 && <del>{was.join(', ')}</del>}
      <ins className={was.length === 0 ? 'is-added' : undefined}>{after}</ins>
    </span>
  );
};

const TagChangesPanel = ({ changes }: { changes: IPendingChanges }) => {
  const { t } = useTranslation();
  const { album, songs, cover, files, count } = changes;
  const songCount = (songsChanged: number) =>
    songsChanged === 1
      ? t('library.trackCountOne')
      : t('library.trackCount', { count: songsChanged });
  return (
    <aside
      className="library-tags-panel is-changes"
      aria-label={t('library.tags.changes.title')}
    >
      <header className="library-tags-panel__head">
        <h3>
          {t('library.tags.changes.title')}
          <span>{count}</span>
        </h3>
      </header>
      <div className="library-tags-panel__body library-tags-changes">
        <section>
          <h4 className="library-tags__group">
            {t('library.tags.changes.album')}
          </h4>
          {cover && (
            <div className="library-tags-changes__row">
              <span className="library-tags-changes__field">
                {t('library.tags.changes.cover')}
              </span>
              <span className="library-tags-changes__value">
                <ins className="is-added">
                  {t('library.tags.changes.coverNew')}
                </ins>
              </span>
              <span className="library-tags-changes__songs">
                {songCount(cover.songs)}
              </span>
            </div>
          )}
          {album.map((change) => (
            <div key={change.field} className="library-tags-changes__row">
              <span className="library-tags-changes__field">
                {t(FIELD_LABEL_KEYS[change.field])}
              </span>
              <Change before={change.before} after={change.after} />
              <span className="library-tags-changes__songs">
                {songCount(change.songs)}
              </span>
            </div>
          ))}
        </section>
        {songs.length > 0 && (
          <section>
            <h4 className="library-tags__group">
              {t('library.tags.changes.songs')}
            </h4>
            {songs.map((song) => (
              <div key={song.trackId} className="library-tags-changes__song">
                <b>{song.name}</b>
                {song.fields.map((field) => (
                  <div
                    key={field.field}
                    className="library-tags-changes__row is-song"
                  >
                    <span className="library-tags-changes__field">
                      {t(FIELD_LABEL_KEYS[field.field])}
                    </span>
                    <Change before={[field.before]} after={field.after} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
        {files.length > 0 && (
          <section>
            <h4 className="library-tags__group">
              {t('library.tags.files.title')}
            </h4>
            {files.map((file) => (
              <div key={file.trackId} className="library-tags-changes__file">
                <del title={file.before}>{file.before}</del>
                <ins title={file.after}>{file.after}</ins>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
};

export default TagChangesPanel;
