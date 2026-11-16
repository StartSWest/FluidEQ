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
  fieldsOfLines,
  type IFixLine,
  type IFixRules,
  isPlaceholderName,
  proposeFixes,
} from '../../../common/library/tagFix';
import {
  cleanTagValue,
  type ITagEdit,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { useLibraryPlayerSessionIfAny } from '../player/LibraryPlayerContext';
import LibraryTagBack from './LibraryTagBack';
import LibraryTagFixAlbum, { type IFixEntry } from './LibraryTagFixAlbum';
import LibraryTagFixAlbumList, {
  type IAlbumLines,
} from './LibraryTagFixAlbumList';
import LibraryTagFixRules from './LibraryTagFixRules';
import LibraryTagFixSongs, { type IFixSongRow } from './LibraryTagFixSongs';
import { useTagEditor } from './TagEditorContext';
import { groupsOf } from './tagGroups';
import { readFixRules, writeFixRules } from './tagFixPrefs';
import { useTagSheets } from './useTagSheets';

/** A proposal as shown: `proposed` is its value before any typing, which
 * keeps a row's identity while its box is being typed into. */
type IShownLine = IFixLine & { proposed: string };

interface IShownAlbum extends IAlbumLines {
  lines: IShownLine[];
}

/** The album card's order: what an album is called first. */
const ALBUM_ORDER: readonly TTagFieldKey[] = [
  'album',
  'artist',
  'albumArtist',
  'year',
  'genre',
  'discNo',
  'trackTotal',
];

const orderOf = (field: TTagFieldKey): number => {
  const index = ALBUM_ORDER.indexOf(field);
  return index === -1 ? ALBUM_ORDER.length : index;
};

/**
 * "FIX TAGS": what FluidEQ would write, read from the songs' own tags, file
 * names and folders, as two plain cards — the album's values, then each
 * song's number and title — every value already in a box to correct by
 * hand. Nothing is written until Save. The rules the proposals follow (how
 * a file name reads, capitals, text to take out) wait folded at the foot.
 *
 * It replaced a page of filters, groups and word diffs that Ivan could not
 * read ("no entiendo nada", 2026-11-16).
 */
const LibraryTagFixPage = () => {
  const { t } = useTranslation();
  const { view, close, write, leavePage, setPageHasChanges } = useTagEditor();
  const session = useLibraryPlayerSessionIfAny();
  const ids = useMemo(() => (view?.kind === 'fix' ? view.ids : []), [view]);
  const sheets = useTagSheets(ids);
  const [rules, setRules] = useState<IFixRules>(readFixRules);
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());
  const [hand, setHand] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
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
  const albums = useMemo<IShownAlbum[]>(
    () =>
      groupsOf(ordered, isFolder).map((group) => ({
        group,
        lines: proposeFixes(
          group.sheets.map((sheet) => ({
            trackId: sheet.trackId,
            fileName: sheet.fileName,
            folder: sheet.folder,
            fields: sheet.fields,
          })),
          rules,
        ).map((line): IShownLine => {
          // A value changed by hand is the line's new value and source.
          const typed = hand.get(line.id);
          return typed === undefined
            ? { ...line, proposed: line.after }
            : { ...line, after: typed, source: 'hand', proposed: line.after };
        }),
      })),
    [ordered, isFolder, rules, hand],
  );
  // Only what was typed by hand is lost by leaving; proposals come back.
  useEffect(() => {
    setPageHasChanges(hand.size > 0);
  }, [hand, setPageHasChanges]);
  useEffect(() => () => setPageHasChanges(false), [setPageHasChanges]);

  if (view?.kind !== 'fix') {
    return null;
  }
  const changeRules = (next: IFixRules) => {
    setRules(next);
    writeFixRules(next);
  };
  const isOff = (line: IFixLine) => off.has(line.id);
  const toggle = (lines: readonly IFixLine[], isOn: boolean) =>
    setOff((current) => {
      const next = new Set(current);
      lines.forEach((line) =>
        isOn ? next.delete(line.id) : next.add(line.id),
      );
      return next;
    });
  const edit = (lines: readonly IFixLine[], value: string) => {
    setHand((current) => {
      const next = new Map(current);
      lines.forEach((line) => next.set(line.id, value));
      return next;
    });
    toggle(lines, true);
  };
  const putBack = (lines: readonly IFixLine[]) =>
    setHand((current) => {
      const next = new Map(current);
      lines.forEach((line) => next.delete(line.id));
      return next;
    });

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

  // One row per value: "Artist → Marea Alta" for song 4 (a spelling) and
  // for song 8 (missing) is one decision, not two rows of the same name.
  const albumEntries: IFixEntry[] = shown
    .flatMap((album) => {
      const rows = new Map<string, IShownLine[]>();
      album.lines
        .filter((line) => line.field !== 'title' && line.field !== 'trackNo')
        .forEach((line) => {
          const key = JSON.stringify([
            album.group.key,
            line.field,
            line.proposed,
          ]);
          rows.set(key, [...(rows.get(key) ?? []), line]);
        });
      return [...rows.entries()].map(([key, lines]): IFixEntry => {
        const ids = new Set(lines.flatMap((line) => line.trackIds));
        if (ids.size === album.group.sheets.length) {
          return { key, lines };
        }
        const numbers = album.group.sheets
          .flatMap((sheet, index) =>
            ids.has(sheet.trackId)
              ? [sheet.fields.trackNo ?? String(index + 1)]
              : [],
          )
          .join(' · ');
        return {
          key,
          lines,
          songs:
            ids.size === 1
              ? t('library.tags.fix.onlySong', { songs: numbers })
              : t('library.tags.fix.onlySongs', { songs: numbers }),
        };
      });
    })
    .sort((a, b) => orderOf(a.lines[0].field) - orderOf(b.lines[0].field));
  const songRows: IFixSongRow[] = shown.flatMap((album) =>
    album.group.sheets.flatMap((sheet) => {
      const own = album.lines.filter(
        (line) =>
          line.trackIds.length === 1 && line.trackIds[0] === sheet.trackId,
      );
      const title = own.find((line) => line.field === 'title');
      const trackNo = own.find((line) => line.field === 'trackNo');
      return title || trackNo ? [{ sheet, title, trackNo }] : [];
    }),
  );
  const spellingLines = shown
    .flatMap((album) => album.lines)
    .filter(
      (line) =>
        line.kind === 'unify' &&
        (line.field === 'artist' ||
          line.field === 'albumArtist' ||
          line.field === 'composer'),
    );

  const save = () => {
    if (ticked.length === 0 || isSaving || !isValid) {
      return;
    }
    const edits: ITagEdit[] = [...fieldsOfLines(ticked).entries()].map(
      ([trackId, fields]) => ({ trackId, fields }),
    );
    const playing = session?.track?.id;
    setIsSaving(true);
    write({
      edits,
      heldTrackIds:
        playing !== undefined && edits.some((e) => e.trackId === playing)
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
    return t('library.tags.fix.intro');
  };
  // "<Desconocido>" names nothing: the album's folder says more.
  const folderName = ordered[0]?.folder.split(/[\\/]/).pop() ?? '';
  const title =
    view.title !== '' && !isPlaceholderName(view.title)
      ? view.title
      : folderName;

  return (
    <section className="library-tags-set library-tags-fix" aria-label={title}>
      <div className="library-tags-set__scroll">
        <div className="library-tags-fix__page">
          <div className="library-tags-fix__top">
            <LibraryTagBack />
            {isFolder && albumKey !== undefined && albums.length > 1 && (
              <button
                type="button"
                className="button small subtle"
                onClick={() => setAlbumKey(undefined)}
              >
                {t('library.tags.fix.allAlbums')}
              </button>
            )}
          </div>
          <header className="library-tags-fix__head">
            <div className="library-tags-set__eyebrow">
              <b>{t('library.tags.hero.fix')}</b>
              {' · '}
              {ids.length === 1
                ? t('library.trackCountOne')
                : t('library.trackCount', { count: ids.length })}
            </div>
            <h2>{title}</h2>
            <p className="library-tags-fix__lead">{lead()}</p>
          </header>
          {!sheets.isComplete && (
            <span className="library-tags__bar library-tags-fix__reading">
              <i
                style={{
                  width: `${(sheets.readCount / Math.max(1, ids.length)) * 100}%`,
                }}
              />
            </span>
          )}

          {showsAlbumList && (
            <LibraryTagFixAlbumList
              albums={albums}
              isOff={isOff}
              onReview={setAlbumKey}
            />
          )}
          {!showsAlbumList && albumEntries.length > 0 && (
            <LibraryTagFixAlbum
              entries={albumEntries}
              isOff={isOff}
              onToggle={toggle}
              onEdit={edit}
              onPutBack={putBack}
            />
          )}
          {!showsAlbumList && songRows.length > 0 && (
            <LibraryTagFixSongs
              rows={songRows}
              isOff={isOff}
              onToggle={toggle}
              onEdit={edit}
              onPutBack={putBack}
            />
          )}
          {!showsAlbumList && sheets.isComplete && (
            <details className="library-tags-fix__settings">
              <summary>{t('library.tags.fix.settings')}</summary>
              <LibraryTagFixRules
                rules={rules}
                onRules={changeRules}
                sheets={shown.flatMap((album) => album.group.sheets)}
                spellingLines={spellingLines}
              />
            </details>
          )}
        </div>
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
          <button
            type="button"
            className="button small subtle"
            onClick={() => leavePage()}
          >
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
