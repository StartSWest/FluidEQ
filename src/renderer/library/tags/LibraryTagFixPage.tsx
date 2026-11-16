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

import { useMemo, useState } from 'react';
import {
  fieldsOfLines,
  type IFixLine,
  type IFixRules,
  proposeFixes,
  type TFixKind,
} from '../../../common/library/tagFix';
import {
  cleanTagValue,
  type ITagEdit,
} from '../../../common/library/tagFields';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryPlayerSessionIfAny } from '../player/LibraryPlayerContext';
import LibraryTagFixRow from './LibraryTagFixRow';
import LibraryTagFixRules from './LibraryTagFixRules';
import { useTagEditor } from './TagEditorContext';
import { groupsOf, type ISheetGroup } from './tagGroups';
import { readFixRules, writeFixRules } from './tagFixPrefs';
import { useTagSheets } from './useTagSheets';

type TFilter = 'all' | TFixKind;

const GROUPS: Array<{
  kind: TFixKind;
  title: TranslationKey;
  sub: TranslationKey;
  filter: TranslationKey;
}> = [
  {
    kind: 'clean',
    title: 'library.tags.fix.group.clean',
    sub: 'library.tags.fix.group.cleanSub',
    filter: 'library.tags.fix.kind.clean',
  },
  {
    kind: 'unify',
    title: 'library.tags.fix.group.unify',
    sub: 'library.tags.fix.group.unifySub',
    filter: 'library.tags.fix.kind.unify',
  },
  {
    kind: 'fill',
    title: 'library.tags.fix.group.fill',
    sub: 'library.tags.fix.group.fillSub',
    filter: 'library.tags.fix.kind.fill',
  },
];

interface IAlbumLines {
  group: ISheetGroup;
  lines: IFixLine[];
}

/**
 * "FIX THIS ALBUM" (the mockup's section 4): one list of before → after,
 * grouped by kind, every line ticked and saying where it came from, every
 * new value open to a correction by hand. Nothing is written until the
 * primary "Write N changes". A folder is one album at a time, each listed
 * with what it would change, and one write for all of them.
 */
const LibraryTagFixPage = () => {
  const { t } = useTranslation();
  const { view, close, write } = useTagEditor();
  const session = useLibraryPlayerSessionIfAny();
  const ids = useMemo(() => (view?.kind === 'fix' ? view.ids : []), [view]);
  const sheets = useTagSheets(ids);
  const [rules, setRules] = useState<IFixRules>(readFixRules);
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());
  const [hand, setHand] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [filter, setFilter] = useState<TFilter>('all');
  const [albumKey, setAlbumKey] = useState<string | undefined>(undefined);
  const [didRefuse, setDidRefuse] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const ordered = useMemo(
    () =>
      ids.flatMap((id) => {
        const result = sheets.results.get(id);
        return result?.state === 'ok' ? [result.sheet] : [];
      }),
    [ids, sheets.results],
  );
  const isFolder = view?.kind === 'fix' && view.scope === 'folder';
  const albums = useMemo<IAlbumLines[]>(
    () =>
      groupsOf(ordered, isFolder).map((group) => ({
        group,
        lines: proposeFixes(
          group.sheets.map((sheet) => ({
            trackId: sheet.trackId,
            fileName: sheet.fileName,
            fields: sheet.fields,
          })),
          rules,
        ).map((line) => {
          // A value changed by hand is the line's new value and source.
          const typed = hand.get(line.id);
          return typed === undefined
            ? line
            : { ...line, after: typed, source: 'hand' };
        }),
      })),
    [ordered, isFolder, rules, hand],
  );

  if (view?.kind !== 'fix') {
    return null;
  }
  const changeRules = (next: IFixRules) => {
    setRules(next);
    writeFixRules(next);
  };
  const allLines = albums.flatMap((album) => album.lines);
  const ticked = allLines.filter((line) => !off.has(line.id));
  const fileCount = new Set(ticked.flatMap((line) => line.trackIds)).size;
  // A value typed by hand that main would refuse holds the whole write back.
  const isValid = ticked.every(
    (line) => cleanTagValue(line.field, line.after) !== undefined,
  );
  const shown =
    isFolder && albumKey !== undefined
      ? albums.filter((album) => album.group.key === albumKey)
      : albums;
  const showsAlbumList =
    isFolder && albumKey === undefined && albums.length > 1;
  const shownLines = shown.flatMap((album) => album.lines);
  const sheetsById = new Map(ordered.map((sheet) => [sheet.trackId, sheet]));

  const songsOf = (line: IFixLine, group: ISheetGroup): string => {
    if (
      line.trackIds.length === group.sheets.length &&
      group.sheets.length > 1
    ) {
      return t('library.tags.fix.songsAll', { count: group.sheets.length });
    }
    return line.trackIds
      .map(
        (id) =>
          sheetsById.get(id)?.fields.trackNo ??
          String(group.sheets.findIndex((s) => s.trackId === id) + 1),
      )
      .join(' · ');
  };

  const toggle = (lineIds: readonly string[], isOn: boolean) =>
    setOff((current) => {
      const next = new Set(current);
      lineIds.forEach((id) => (isOn ? next.delete(id) : next.add(id)));
      return next;
    });

  const save = () => {
    if (ticked.length === 0 || isSaving || !isValid) {
      return;
    }
    const edits: ITagEdit[] = [...fieldsOfLines(ticked).entries()].map(
      ([trackId, fields]) => ({
        trackId,
        fields,
      }),
    );
    const playing = session?.track?.id;
    setIsSaving(true);
    write({
      edits,
      heldTrackIds:
        playing !== undefined && edits.some((edit) => edit.trackId === playing)
          ? [playing]
          : [],
    })
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

  const countOf = (kind: TFilter) =>
    shownLines.filter(
      (line) => (kind === 'all' || line.kind === kind) && !off.has(line.id),
    ).length;
  const spellingLines = shownLines.filter(
    (line) =>
      line.kind === 'unify' &&
      (line.field === 'artist' ||
        line.field === 'albumArtist' ||
        line.field === 'composer'),
  );
  const lead = () => {
    if (!sheets.isComplete) {
      return t('library.tags.set.reading', {
        done: sheets.readCount,
        count: ids.length,
      });
    }
    if (allLines.length === 0) {
      return t('library.tags.fix.leadNone');
    }
    return allLines.length === 1
      ? t('library.tags.fix.leadOne')
      : t('library.tags.fix.lead', { count: allLines.length });
  };

  return (
    <section
      className="library-tags-set library-tags-fix"
      aria-label={view.title}
    >
      <div className="library-tags-set__scroll">
        <header className="library-tags-set__head">
          <div className="library-tags-set__heading">
            <div className="library-tags-set__eyebrow">
              <b>{t('library.tags.hero.fix')}</b>
              {view.place ? ` · ${view.place}` : ''}
            </div>
            <h2>{view.title || ordered[0]?.fields.album || ''}</h2>
            <p className="library-tags-fix__lead">
              <b>{lead()}</b>
              {sheets.isComplete && (
                <span>{t('library.tags.fix.offline')}</span>
              )}
            </p>
          </div>
          {isFolder && albumKey !== undefined && albums.length > 1 && (
            <button
              type="button"
              className="button small subtle"
              onClick={() => setAlbumKey(undefined)}
            >
              {t('library.tags.fix.allAlbums')}
            </button>
          )}
        </header>
        {!sheets.isComplete && (
          <div className="library-tags-set__reading" role="status">
            <span className="library-tags__bar">
              <i
                style={{
                  width: `${(sheets.readCount / Math.max(1, ids.length)) * 100}%`,
                }}
              />
            </span>
          </div>
        )}

        {showsAlbumList ? (
          <div className="library-tags-fix__albums">
            <p className="library-tags__group">
              {t('library.tags.fix.albums', { count: albums.length })}
            </p>
            {albums.map((album) => {
              const on = album.lines.filter((line) => !off.has(line.id)).length;
              return (
                <div key={album.group.key} className="library-tags-fix__album">
                  <div className="library-tags-fix__album-name">
                    <b>{album.group.label}</b>
                    <span>
                      {album.group.sheets.length === 1
                        ? t('library.trackCountOne')
                        : t('library.trackCount', {
                            count: album.group.sheets.length,
                          })}
                    </span>
                  </div>
                  <span className="library-tags-fix__album-state">
                    {on === 0 && t('library.tags.fix.albumNothing')}
                    {on === 1 && t('library.tags.fix.albumChangesOne')}
                    {on > 1 &&
                      t('library.tags.fix.albumChanges', { count: on })}
                  </span>
                  {album.lines.length > 0 && (
                    <button
                      type="button"
                      className="button small subtle"
                      onClick={() => setAlbumKey(album.group.key)}
                    >
                      {t('library.tags.fix.review')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <span
              className="segmented library-tags-fix__filters"
              role="radiogroup"
            >
              {(['all', 'clean', 'unify', 'fill'] as TFilter[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={filter === kind}
                  className={`segmented__option${filter === kind ? ' is-selected' : ''}`}
                  onClick={() => setFilter(kind)}
                >
                  {t(
                    kind === 'all'
                      ? 'library.tags.fix.kind.all'
                      : (GROUPS.find((g) => g.kind === kind)?.filter ??
                          'library.tags.fix.kind.all'),
                  )}
                  <span className="library-tags-fix__filter-count">
                    {countOf(kind)}
                  </span>
                </button>
              ))}
            </span>
            <div className="library-tags-fix__grid">
              <LibraryTagFixRules
                rules={rules}
                onRules={changeRules}
                sheets={shown.flatMap((album) => album.group.sheets)}
                spellingLines={spellingLines}
              />
              <div className="library-tags-fix__diff">
                {GROUPS.filter(
                  (group) => filter === 'all' || filter === group.kind,
                ).map((group) => {
                  const entries = shown.flatMap((album) =>
                    album.lines
                      .filter((line) => line.kind === group.kind)
                      .map((line) => ({ line, album })),
                  );
                  if (entries.length === 0) {
                    return null;
                  }
                  const on = entries.filter(
                    ({ line }) => !off.has(line.id),
                  ).length;
                  const title = t(group.title);
                  return (
                    <div key={group.kind} className="library-tags-fix__group">
                      <div className="library-tags-fix__group-head">
                        <input
                          type="checkbox"
                          checked={on === entries.length}
                          ref={(box) => {
                            if (box) {
                              // eslint-disable-next-line no-param-reassign -- a DOM property React has no attribute for
                              box.indeterminate = on > 0 && on < entries.length;
                            }
                          }}
                          aria-label={t('library.tags.fix.applyGroup', {
                            group: title,
                          })}
                          onChange={() =>
                            toggle(
                              entries.map(({ line }) => line.id),
                              on !== entries.length,
                            )
                          }
                        />
                        <h4>{title}</h4>
                        <span className="library-tags-fix__group-sub">
                          {t(group.sub)}
                        </span>
                        <span className="library-tags-fix__group-count">
                          {t('library.tags.fix.groupCount', {
                            on,
                            count: entries.length,
                          })}
                        </span>
                      </div>
                      {entries.map(({ line, album }) => (
                        <LibraryTagFixRow
                          key={line.id}
                          line={line}
                          isOn={!off.has(line.id)}
                          songs={songsOf(line, album.group)}
                          onToggle={() => toggle([line.id], off.has(line.id))}
                          onEdit={(value) => {
                            setHand((current) =>
                              new Map(current).set(line.id, value),
                            );
                            toggle([line.id], true);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <footer className="library-tags-set__foot">
        <div className="library-tags-set__what" aria-live="polite">
          {ticked.length > 0 ? (
            <>
              <b>
                {ticked.length === 1
                  ? t('library.tags.fix.changesOne')
                  : t('library.tags.fix.changes', { count: ticked.length })}
              </b>
              <span>
                {fileCount === 1
                  ? t('library.tags.fix.filesOne')
                  : t('library.tags.fix.files', { count: fileCount })}
              </span>
            </>
          ) : (
            <>
              <b>{t('library.tags.fix.nothing')}</b>
              <span>{t('library.tags.fix.nothingHint')}</span>
            </>
          )}
          {didRefuse && (
            <span className="library-tags__note is-warning" role="alert">
              {t('library.tags.saveFailed')}
            </span>
          )}
        </div>
        <div className="library-tags-set__actions">
          <button type="button" className="button small subtle" onClick={close}>
            {t('library.tags.fix.cancel')}
          </button>
          <button
            type="button"
            className="button small"
            disabled={
              ticked.length === 0 || isSaving || !isValid || !sheets.isComplete
            }
            onClick={save}
          >
            {ticked.length === 1
              ? t('library.tags.fix.writeOne')
              : t('library.tags.fix.write', { count: ticked.length })}
          </button>
        </div>
      </footer>
    </section>
  );
};

export default LibraryTagFixPage;
