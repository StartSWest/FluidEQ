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

/**
 * The tag editor's state for the whole Library tab: which editor is open,
 * the edits each song is waiting with, and the write running now.
 *
 * Drafts live here and not in the panel, because "Esc closes, keeping
 * unsaved edits" — closing the panel and opening it again on the same song
 * finds the edits where they were left. A song's draft goes the moment its
 * file is written, and only then: a file that refused keeps its edits for
 * the retry.
 *
 * A song playing in FluidEQ is sent as held; the moment the player moves
 * off it (another song, or stopped), main is told it may write it.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ITagJobState,
  ITagWriteRequest,
  TTagItemAnswer,
} from '../../../common/library/tagFields';
import { useLibraryPlayerSessionIfAny } from '../player/LibraryPlayerContext';
import { type ITagDraft, isDraftEmpty, requestOfDrafts } from './tagDrafts';

export type TTagSetScope = 'album' | 'folder' | 'selection';

export type TTagEditorView =
  /** One song in the side panel; ‹ › walks `ids`. */
  | { kind: 'song'; ids: string[]; index: number }
  /** An album, a folder or a selection: the page becomes the editor. */
  | {
      kind: 'set';
      /**
       * Opened by Fix tags: the editor comes up with what Fix proposes
       * already typed in, to look over and save. It used to be a page of its
       * own, of ticks, sources and word diffs, that Ivan could not read
       * ("not liking this WTF is this", 2026-11-16).
       */
      fix?: boolean;
      scope: TTagSetScope;
      ids: string[];
      title: string;
      /** The folder an album or folder lives in, for the eyebrow. */
      place?: string;
    };

interface ITagEditorContextValue {
  view: TTagEditorView | undefined;
  openSong: (ids: readonly string[], startId: string) => void;
  openSet: (
    scope: TTagSetScope,
    ids: readonly string[],
    title: string,
    place?: string,
  ) => void;
  /** "Fix tags": the same editor, opened with Fix's proposals filled in. */
  openFix: (
    scope: TTagSetScope,
    ids: readonly string[],
    title: string,
    place?: string,
  ) => void;
  walkTo: (index: number) => void;
  close: () => void;
  /**
   * Leaves an album's, folder's or selection's page for `then` (a view, a
   * shelf, a folder, Back). It leaves at once unless the page holds unsaved
   * edits; then its leave question is raised and `then` waits for the answer.
   * With no page open, `then` simply runs.
   */
  leavePage: (then?: () => void) => void;
  /** A leave is waiting on the page's question. */
  isLeaveAsked: boolean;
  /** The page's answer: discard leaves and runs what waited, keep stays. */
  answerLeave: (discard: boolean) => void;
  /** The page says whether it holds unsaved edits. */
  setPageHasChanges: (hasChanges: boolean) => void;
  drafts: ReadonlyMap<string, ITagDraft>;
  setDraft: (trackId: string, draft: ITagDraft) => void;
  discardDrafts: (trackIds?: readonly string[]) => void;
  /** Starts a write of the song drafts; answers whether main took it. */
  saveDrafts: () => Promise<boolean>;
  /** Starts any write (the set editor builds its own). */
  write: (request: ITagWriteRequest) => Promise<boolean>;
  /** The latest write and, after Undo, the undo itself. */
  job: ITagJobState | undefined;
  /** The write Undo puts back: the latest write job that can be undone. */
  undoable: ITagJobState | undefined;
  answer: (trackId: string, answer: TTagItemAnswer) => void;
  cancel: () => void;
  undo: () => void;
  /** When each song's file was last written this session (a counter), for
   * sheets to read it again. */
  writtenRevisions: ReadonlyMap<string, number>;
  isProblemsOpen: boolean;
  setIsProblemsOpen: (open: boolean) => void;
  isJobInBackground: boolean;
  setIsJobInBackground: (background: boolean) => void;
}

const TagEditorContext = createContext<ITagEditorContextValue | undefined>(
  undefined,
);

export const TagEditorProvider = ({ children }: { children: ReactNode }) => {
  const [view, setView] = useState<TTagEditorView | undefined>(undefined);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, ITagDraft>>(
    () => new Map(),
  );
  /** Every job's latest state as main last told it, by id: a state can
   * arrive before the call that started its job has answered. */
  const states = useRef(new Map<string, ITagJobState>());
  const [statesTick, setStatesTick] = useState(0);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [writeJobId, setWriteJobId] = useState<string | undefined>(undefined);
  const [writtenRevisions, setWrittenRevisions] = useState<
    ReadonlyMap<string, number>
  >(() => new Map());
  const writeCount = useRef(0);
  const [isProblemsOpen, setIsProblemsOpen] = useState(false);
  const [isJobInBackground, setIsJobInBackground] = useState(false);
  /** Item states already seen, to notice the moment one is written. */
  const seenStates = useRef(new Map<string, string>());
  const session = useLibraryPlayerSessionIfAny();
  const playingTrackId = session?.track?.id;
  // Read through the tick, which every state from main bumps.
  const job = useMemo(
    () => (jobId === undefined ? undefined : states.current.get(jobId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- states is a ref read on each tick
    [jobId, statesTick],
  );
  const undoable = useMemo(() => {
    const state =
      writeJobId === undefined ? undefined : states.current.get(writeJobId);
    return state?.canUndo ? state : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- states is a ref read on each tick
  }, [writeJobId, statesTick]);

  useEffect(
    () =>
      window.electron.ipcRenderer.onLibraryTagJob((state) => {
        let wrote = false;
        const written: string[] = [];
        state.items.forEach((item) => {
          const key = `${state.jobId}|${item.trackId}`;
          if (seenStates.current.get(key) !== item.state) {
            seenStates.current.set(key, item.state);
            if (item.state === 'written') {
              wrote = true;
              written.push(item.trackId);
            }
          }
        });
        states.current.set(state.jobId, state);
        setStatesTick((tick) => tick + 1);
        if (wrote) {
          writeCount.current += 1;
          const revision = writeCount.current;
          setWrittenRevisions((current) => {
            const next = new Map(current);
            written.forEach((id) => next.set(id, revision));
            return next;
          });
          if (state.kind === 'write') {
            // Each song's edits go as its file is written, never sooner.
            setDrafts((current) => {
              const next = new Map(current);
              written.forEach((id) => {
                const draft = next.get(id);
                if (draft?.cover) {
                  URL.revokeObjectURL(draft.cover.url);
                }
                next.delete(id);
              });
              return next;
            });
          }
        }
      }),
    [],
  );

  // The playing song's file is written once the player has moved off it.
  useEffect(() => {
    if (job === undefined) {
      return;
    }
    job.items.forEach((item) => {
      if (item.state === 'held' && item.trackId !== playingTrackId) {
        window.electron.ipcRenderer
          .releaseLibraryTagItem(job.jobId, item.trackId)
          .catch(() => undefined);
      }
    });
  }, [job, playingTrackId]);

  const write = useCallback(async (request: ITagWriteRequest) => {
    if (request.edits.length === 0) {
      return false;
    }
    const started = await window.electron.ipcRenderer.writeLibraryTags(request);
    if (started === undefined) {
      return false;
    }
    setIsJobInBackground(false);
    setIsProblemsOpen(false);
    setJobId(started);
    setWriteJobId(started);
    return true;
  }, []);

  const saveDrafts = useCallback(
    () => write(requestOfDrafts(drafts, playingTrackId)),
    [drafts, playingTrackId, write],
  );

  const setDraft = useCallback((trackId: string, draft: ITagDraft) => {
    setDrafts((current) => {
      const next = new Map(current);
      if (isDraftEmpty(draft)) {
        next.delete(trackId);
      } else {
        next.set(trackId, draft);
      }
      return next;
    });
  }, []);

  const discardDrafts = useCallback((trackIds?: readonly string[]) => {
    setDrafts((current) => {
      const next = new Map(current);
      (trackIds ?? [...current.keys()]).forEach((id) => {
        const draft = next.get(id);
        if (draft?.cover) {
          URL.revokeObjectURL(draft.cover.url);
        }
        next.delete(id);
      });
      return next;
    });
  }, []);

  const answer = useCallback(
    (trackId: string, reply: TTagItemAnswer) => {
      if (job !== undefined) {
        window.electron.ipcRenderer
          .answerLibraryTagItem(job.jobId, trackId, reply)
          .catch(() => undefined);
      }
    },
    [job],
  );

  const cancel = useCallback(() => {
    if (job !== undefined) {
      window.electron.ipcRenderer
        .cancelLibraryTagJob(job.jobId)
        .catch(() => undefined);
    }
  }, [job]);

  const undo = useCallback(() => {
    if (undoable === undefined) {
      return;
    }
    window.electron.ipcRenderer
      .undoLibraryTagJob(undoable.jobId)
      .then((undoId) => {
        if (undoId !== undefined) {
          setIsJobInBackground(false);
          setIsProblemsOpen(false);
          setJobId(undoId);
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [undoable]);

  // Ivan, 2026-11-16: pressing Cover Flow, Grid or Details over the editor
  // "tiene que ir para atrás, salir de ahí". A ref, because the page reports
  // on every edit and nothing has to draw from it.
  const pageHasChanges = useRef(false);
  const [waitingLeave, setWaitingLeave] = useState<
    { go: (() => void) | undefined } | undefined
  >(undefined);

  const leavePage = useCallback(
    (then?: () => void) => {
      if (view?.kind !== 'set') {
        then?.();
        return;
      }
      if (pageHasChanges.current) {
        setWaitingLeave({ go: then });
        return;
      }
      setView(undefined);
      then?.();
    },
    [view],
  );

  const answerLeave = useCallback(
    (discard: boolean) => {
      setWaitingLeave(undefined);
      if (discard) {
        pageHasChanges.current = false;
        setView(undefined);
        waitingLeave?.go?.();
      }
    },
    [waitingLeave],
  );

  const setPageHasChanges = useCallback((hasChanges: boolean) => {
    pageHasChanges.current = hasChanges;
  }, []);

  const value = useMemo<ITagEditorContextValue>(
    () => ({
      view,
      openSong: (ids, startId) => {
        const list = [...ids];
        const index = Math.max(0, list.indexOf(startId));
        setView({
          kind: 'song',
          ids: list.length > 0 ? list : [startId],
          index,
        });
      },
      openSet: (scope, ids, title, place) => {
        setWaitingLeave(undefined);
        setView({ kind: 'set', scope, ids: [...ids], title, place });
      },
      openFix: (scope, ids, title, place) => {
        setWaitingLeave(undefined);
        setView({ kind: 'set', fix: true, scope, ids: [...ids], title, place });
      },
      walkTo: (index) =>
        setView((current) =>
          current?.kind === 'song' && index >= 0 && index < current.ids.length
            ? { ...current, index }
            : current,
        ),
      close: () => {
        setWaitingLeave(undefined);
        setView(undefined);
      },
      leavePage,
      isLeaveAsked: waitingLeave !== undefined,
      answerLeave,
      setPageHasChanges,
      drafts,
      setDraft,
      discardDrafts,
      saveDrafts,
      write,
      job,
      undoable,
      answer,
      cancel,
      undo,
      writtenRevisions,
      isProblemsOpen,
      setIsProblemsOpen,
      isJobInBackground,
      setIsJobInBackground,
    }),
    [
      view,
      leavePage,
      waitingLeave,
      answerLeave,
      setPageHasChanges,
      drafts,
      setDraft,
      discardDrafts,
      saveDrafts,
      write,
      job,
      undoable,
      answer,
      cancel,
      undo,
      writtenRevisions,
      isProblemsOpen,
      isJobInBackground,
    ],
  );

  return (
    <TagEditorContext.Provider value={value}>
      {children}
    </TagEditorContext.Provider>
  );
};

export const useTagEditor = (): ITagEditorContextValue => {
  const context = useContext(TagEditorContext);
  if (context === undefined) {
    throw new Error('useTagEditor must be used inside TagEditorProvider');
  }
  return context;
};

/** The editor when the Library has one above, for the parts that also draw
 * without it (a menu in a harness, a test). */
export const useTagEditorIfAny = (): ITagEditorContextValue | undefined =>
  useContext(TagEditorContext);
