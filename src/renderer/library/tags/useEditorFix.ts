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
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import type { IAlbumToFix } from './LibraryTagFixAlbumList';
import { proposalsFor, withFixes } from './fixToSet';
import readFixRules from './tagFixPrefs';
import type { ISheetGroup } from './tagGroups';
import type { ISetState } from './tagSetModel';
import { coverOfferOf, useTagFolders } from './useTagFolders';

/** What the last Fix did: typed proposals in, or found nothing to type. */
export type TFixNote = 'filled' | 'nothing' | undefined;

interface IEditorFixArgs {
  ids: readonly string[];
  ordered: readonly ITrackTagSheet[];
  groups: readonly ISheetGroup[];
  isComplete: boolean;
  /** The editor was opened by Fix tags: run it once everything is read. */
  isFixOpen: boolean;
  setState: Dispatch<SetStateAction<ISetState>>;
}

/**
 * Fix tags as the album editor's own action: on an editor holding one
 * album, the proposals typed into its fields and cells and the folder's
 * picture set as its cover; on a folder of several albums, the list to
 * pick one from, because each album's name and artist are its own. Opened
 * by Fix tags, it runs once the songs and their folders have been read.
 */
export const useEditorFix = ({
  ids,
  ordered,
  groups,
  isComplete,
  isFixOpen,
  setState,
}: IEditorFixArgs) => {
  const folders = useTagFolders(ids);
  const { facts, isRead, loadCover } = folders;
  const rules = useMemo(readFixRules, []);
  const [note, setNote] = useState<TFixNote>(undefined);
  const [isChoosing, setIsChoosing] = useState(false);
  const hasRun = useRef(false);

  const albums = useMemo<IAlbumToFix[]>(
    () =>
      groups.map((group) => ({
        group,
        changes:
          proposalsFor(group.sheets, rules, facts).length +
          (coverOfferOf(group.sheets, facts) ? 1 : 0),
      })),
    [groups, rules, facts],
  );

  const run = useCallback(() => {
    const [group] = groups;
    if (group === undefined) {
      return;
    }
    if (groups.length > 1) {
      setIsChoosing(true);
      return;
    }
    const lines = proposalsFor(group.sheets, rules, facts);
    const offer = coverOfferOf(group.sheets, facts);
    setState((current) => withFixes(current, group.sheets, lines, true));
    setNote(lines.length > 0 || offer ? 'filled' : 'nothing');
    if (offer) {
      loadCover(offer)
        .then((cover) => {
          if (cover !== 'refused') {
            // A cover picked by hand meanwhile stays.
            setState((current) =>
              current.cover === undefined ? { ...current, cover } : current,
            );
          }
          return undefined;
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the album is fixed without its picture
          console.error(`Could not read the picture of ${offer.folder}`, error);
        });
    }
  }, [groups, rules, facts, loadCover, setState]);

  useEffect(() => {
    if (
      isFixOpen &&
      !hasRun.current &&
      isComplete &&
      isRead &&
      ordered.length > 0
    ) {
      hasRun.current = true;
      run();
    }
  }, [isFixOpen, isComplete, isRead, ordered.length, run]);

  return {
    note,
    clearNote: () => setNote(undefined),
    run,
    albums,
    isChoosing: isChoosing && groups.length > 1,
    stopChoosing: () => setIsChoosing(false),
  };
};
