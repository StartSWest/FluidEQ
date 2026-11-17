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

import { type KeyboardEvent, useRef, useState } from 'react';
import {
  cleanTagValue,
  type ITrackTagSheet,
  TAG_NUMBER_LIMITS,
  type TTagFieldKey,
} from '../../../common/library/tagFields';
import { isPlaceholderName } from '../../../common/library/tagFix';
import type { ILibraryTrack } from '../../../common/library/types';
import { useTranslation } from '../../utils/I18nContext';
import LibraryCoverArt from '../LibraryCoverArt';
import { FIELD_LABEL_KEYS } from './tagLabels';
import { formatDuration } from './tagTime';
import type { IFindReplace } from './LibraryTagSetTools';
import {
  effectiveValue,
  findParts,
  type ISetState,
  SHEET_FIELDS,
} from './tagSetModel';
import type { ISheetGroup } from './tagGroups';
import type { IFileRename } from './tagFileNames';

interface ILibraryTagSheetProps {
  groups: readonly ISheetGroup[];
  state: ISetState;
  tracks: ReadonlyMap<string, ILibraryTrack | null>;
  onCell: (sheet: ITrackTagSheet, key: TTagFieldKey, value: string) => void;
  /** A row dropped before another, by id; within its group only. */
  onMove: (fromId: string, beforeId: string) => void;
  /** What find & replace is looking for, lit in the titles as it is typed. */
  finding: IFindReplace;
  /** Files Save renames: each shown under its song, old name struck. */
  renames: readonly IFileRename[];
}

const GripGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {[4, 8, 12].flatMap((y) =>
      [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />),
    )}
  </svg>
);

const CaretGlyph = ({ isOpen }: { isOpen: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path d={isOpen ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} />
  </svg>
);

/**
 * The songs as a spreadsheet, for what is each song's own: number, title
 * and artist. Enter moves down and Shift+Enter up, Tab right, Ctrl+D
 * copies the cell above; a row's grip drags it to a new place, and Renumber
 * then numbers by the new order. A changed cell wears the accent; an empty
 * one says it is missing.
 */
const LibraryTagSheet = ({
  groups,
  state,
  tracks,
  onCell,
  onMove,
  finding,
  renames,
}: ILibraryTagSheetProps) => {
  const { t } = useTranslation();
  const renameOf = new Map(renames.map((rename) => [rename.trackId, rename]));
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [dragId, setDragId] = useState<string | undefined>(undefined);
  const [overId, setOverId] = useState<string | undefined>(undefined);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const rows = groups.flatMap((group) =>
    folded.has(group.key) ? [] : group.sheets,
  );

  const focusCell = (rowIndex: number, key: TTagFieldKey) => {
    const target = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${rowIndex}"][data-key="${key}"]`,
    );
    target?.focus();
    target?.select();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    sheet: ITrackTagSheet,
    key: TTagFieldKey,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusCell(rowIndex + (event.shiftKey ? -1 : 1), key);
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'd'
    ) {
      event.preventDefault();
      const above = rows[rowIndex - 1];
      if (above) {
        onCell(sheet, key, effectiveValue(state, above, key));
      }
    }
  };

  const cell = (sheet: ITrackTagSheet, rowIndex: number, key: TTagFieldKey) => {
    const value = effectiveValue(state, sheet, key);
    const isChanged = value !== (sheet.fields[key] ?? '');
    const isNumber = TAG_NUMBER_LIMITS[key] !== undefined;
    const isInvalid = cleanTagValue(key, value) === undefined;
    let emptyHint: string | undefined;
    if (value === '') {
      emptyHint = isNumber ? '—' : t('library.tags.set.missingCell');
    }
    // What find & replace would do to this title, drawn over the cell while
    // the caret is elsewhere: the match lit, or struck through with its
    // replacement beside it (Ivan, 2026-11-16: "highlight lo que está
    // encontrando ... como un tachado").
    const parts = key === 'title' ? findParts(value, finding.find) : [];
    const isFound = parts.some((part) => part.isMatch);
    // A text cell changed from what the file says shows the new value and,
    // struck through after it, the old one — what Fix tags typed in reads
    // as a change at a glance, not as the file's own value.
    const original = sheet.fields[key] ?? '';
    // Where the file had nothing ("<Desconocido>" is nothing), a value is an
    // addition: green, with nothing to strike (Ivan, 2026-11-16: "en verde,
    // como en addition").
    const wasNothing = original === '' || isPlaceholderName(original);
    const isAdded = isChanged && wasNothing && value !== '';
    const showsChange = !isFound && !isNumber && isChanged && !wasNothing;
    const isPreviewed = isFound || showsChange;
    return (
      <td
        key={key}
        className={`${isNumber ? 'is-number' : ''}${
          isChanged && !isAdded ? ' is-changed' : ''
        }${isAdded ? ' is-added' : ''}${
          value === '' ? ' is-empty' : ''
        }${isInvalid ? ' is-invalid' : ''}${isPreviewed ? ' is-previewed' : ''}`}
      >
        <input
          className="library-tags-sheet__cell"
          value={value}
          data-row={rowIndex}
          data-key={key}
          inputMode={isNumber ? 'numeric' : undefined}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${t(FIELD_LABEL_KEYS[key])} · ${sheet.fileName}`}
          placeholder={emptyHint}
          onChange={(event) => onCell(sheet, key, event.target.value)}
          onKeyDown={(event) => onKeyDown(event, rowIndex, sheet, key)}
        />
        {isFound && (
          <span className="library-tags-sheet__preview" aria-hidden="true">
            {parts.map((part, index) => {
              // The pieces of one title, in order: their place is their key.
              const partKey = `${index}-${part.text}`;
              if (!part.isMatch) {
                return <span key={partKey}>{part.text}</span>;
              }
              // An empty "Replace with" deletes: the match is struck.
              if (finding.replace === '') {
                return <del key={partKey}>{part.text}</del>;
              }
              return (
                <span key={partKey}>
                  <del>{part.text}</del>
                  <ins>{finding.replace}</ins>
                </span>
              );
            })}
          </span>
        )}
        {showsChange && (
          <span
            className="library-tags-sheet__preview is-change"
            aria-hidden="true"
          >
            {value !== '' && <ins>{value}</ins>}
            <del>{original}</del>
          </span>
        )}
      </td>
    );
  };

  /**
   * Each song's cover, and what a new or removed album cover does to it:
   * green where the song had none, the accent where it replaces one, an
   * empty red frame where it is taken off (Ivan, 2026-11-16: "cuando cambie
   * la portada, debe marcar los cambios para las canciones que no la
   * tienen").
   */
  const coverCell = (sheet: ITrackTagSheet, artId: string | undefined) => {
    const hadCover = sheet.cover !== undefined;
    let mark = '';
    if (state.cover === null && hadCover) {
      mark = ' is-removed';
    } else if (state.cover) {
      mark = hadCover ? ' is-changed' : ' is-added';
    }
    let picture = null;
    if (state.cover) {
      picture = <img src={state.cover.url} alt="" />;
    } else if (state.cover === undefined && artId !== undefined) {
      // The Library may draw a folder picture for a song whose file holds
      // none: drawn faint, as it is not in the file.
      picture = <LibraryCoverArt artId={artId} label="" size="row" />;
      if (!hadCover) {
        mark = ' is-folder';
      }
    }
    return (
      <td className={`library-tags-sheet__cover${mark}`}>
        <span className="library-tags-sheet__thumb">{picture}</span>
      </td>
    );
  };

  let rowIndex = -1;
  return (
    <div className="library-tags-sheet">
      <table ref={tableRef}>
        <colgroup>
          <col className="is-grip" />
          <col className="is-cover" />
          <col className="is-no" />
          <col className="is-title" />
          <col className="is-artist" />
          <col className="is-time" />
        </colgroup>
        <thead>
          <tr>
            <th aria-label={t('library.tags.set.grip')} />
            <th aria-label={t('library.tags.changes.cover')} />
            <th className="is-number">{t('library.tags.set.col.no')}</th>
            <th>{t(FIELD_LABEL_KEYS.title)}</th>
            <th>{t(FIELD_LABEL_KEYS.artist)}</th>
            <th className="is-number">{t('library.tags.set.col.time')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isFolded = folded.has(group.key);
            return [
              group.label !== undefined && (
                <tr
                  key={`group-${group.key}`}
                  className="library-tags-sheet__group"
                >
                  <td colSpan={6}>
                    <button
                      type="button"
                      aria-expanded={!isFolded}
                      onClick={() =>
                        setFolded((current) => {
                          const next = new Set(current);
                          if (next.has(group.key)) {
                            next.delete(group.key);
                          } else {
                            next.add(group.key);
                          }
                          return next;
                        })
                      }
                    >
                      <CaretGlyph isOpen={!isFolded} />
                      <span>{group.label}</span>
                      <span className="library-tags-sheet__group-count">
                        {t('library.tags.set.groupSongs', {
                          count: group.sheets.length,
                        })}
                      </span>
                    </button>
                  </td>
                </tr>
              ),
              ...(isFolded
                ? []
                : group.sheets.map((sheet) => {
                    rowIndex += 1;
                    const index = rowIndex;
                    const track = tracks.get(sheet.trackId) ?? undefined;
                    const rename = renameOf.get(sheet.trackId);
                    return [
                      <tr
                        key={sheet.trackId}
                        className={`${dragId === sheet.trackId ? 'is-dragging' : ''}${
                          overId === sheet.trackId && dragId !== sheet.trackId
                            ? ' is-over'
                            : ''
                        }`}
                        onDragOver={(event) => {
                          if (
                            dragId !== undefined &&
                            group.sheets.some((s) => s.trackId === dragId)
                          ) {
                            event.preventDefault();
                            setOverId(sheet.trackId);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (
                            dragId !== undefined &&
                            dragId !== sheet.trackId
                          ) {
                            onMove(dragId, sheet.trackId);
                          }
                          setDragId(undefined);
                          setOverId(undefined);
                        }}
                      >
                        <td
                          className="library-tags-sheet__grip"
                          title={t('library.tags.set.grip')}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData(
                              'text/plain',
                              sheet.trackId,
                            );
                            setDragId(sheet.trackId);
                          }}
                          onDragEnd={() => {
                            setDragId(undefined);
                            setOverId(undefined);
                          }}
                        >
                          <GripGlyph />
                        </td>
                        {coverCell(sheet, track?.artId)}
                        {SHEET_FIELDS.map((key) => cell(sheet, index, key))}
                        <td
                          className="is-number is-fact"
                          title={sheet.fileName}
                        >
                          {track?.durationMs
                            ? formatDuration(track.durationMs)
                            : ''}
                        </td>
                      </tr>,
                      rename && (
                        <tr
                          key={`file-${sheet.trackId}`}
                          className={`library-tags-sheet__file${rename.isClash ? ' is-clash' : ''}`}
                        >
                          <td colSpan={6}>
                            <span className="library-tags-sheet__file-name">
                              <del title={rename.before}>{rename.before}</del>
                              <span aria-hidden="true">→</span>
                              <ins title={rename.after}>{rename.after}</ins>
                              {rename.isClash && (
                                <em>{t('library.tags.files.clashRow')}</em>
                              )}
                            </span>
                          </td>
                        </tr>
                      ),
                    ];
                  })),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LibraryTagSheet;
