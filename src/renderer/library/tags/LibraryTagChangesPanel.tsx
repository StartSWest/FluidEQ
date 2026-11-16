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

import { isPlaceholderName } from '../../../common/library/tagFix';
import { useTranslation } from '../../utils/I18nContext';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { useTagEditor } from './TagEditorContext';

const isNothing = (value: string) => value === '' || isPlaceholderName(value);

/** One change: an addition in green, or the old value struck beside the new. */
const Change = ({ before, after }: { before: string[]; after: string }) => {
  const { t } = useTranslation();
  const was = before.filter((value) => !isNothing(value));
  if (after === '') {
    return (
      <span className="library-tags-changes__value">
        <del>{was.join(', ')}</del>
        <span className="library-tags-changes__gone">
          {t('library.tags.changes.removed')}
        </span>
      </span>
    );
  }
  return (
    <span className="library-tags-changes__value">
      {was.length > 0 && <del>{was.join(', ')}</del>}
      <ins className={was.length === 0 ? 'is-added' : undefined}>{after}</ins>
    </span>
  );
};

/**
 * The side column while an album, a folder or a selection is being edited:
 * what a Save would do, in place of Up Next (Ivan, 2026-11-16: "instead of
 * Up Next, show the panel of the replacements that will be made, so there is
 * no confusion"). The album's values first, then each song's own; what fills
 * an empty field in green, what replaces a value with the old one struck.
 */
const LibraryTagChangesPanel = () => {
  const { t } = useTranslation();
  const { pageChanges } = useTagEditor();
  if (pageChanges === undefined) {
    return null;
  }
  const { album, songs, cover, count } = pageChanges;
  return (
    <aside
      className="library-tags-panel is-changes"
      aria-label={t('library.tags.changes.title')}
    >
      <header className="library-tags-panel__head">
        <h3>
          {t('library.tags.changes.title')}
          {count > 0 && <span>{count}</span>}
        </h3>
      </header>
      <div className="library-tags-panel__body library-tags-changes">
        {count === 0 && (
          <p className="library-tags-changes__none">
            {t('library.tags.changes.none')}
          </p>
        )}
        {(album.length > 0 || cover) && (
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
                  <ins
                    className={cover.kind === 'new' ? 'is-added' : undefined}
                  >
                    {cover.kind === 'new'
                      ? t('library.tags.changes.coverNew')
                      : t('library.tags.changes.coverRemoved')}
                  </ins>
                </span>
                <span className="library-tags-changes__songs">
                  {cover.songs === 1
                    ? t('library.trackCountOne')
                    : t('library.trackCount', { count: cover.songs })}
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
                  {change.songs === 1
                    ? t('library.trackCountOne')
                    : t('library.trackCount', { count: change.songs })}
                </span>
              </div>
            ))}
          </section>
        )}
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
      </div>
    </aside>
  );
};

export default LibraryTagChangesPanel;
