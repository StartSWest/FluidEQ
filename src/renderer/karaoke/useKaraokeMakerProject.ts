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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IKaraokeMakerProject,
  createKaraokeMakerProject,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../common/karaoke/types';
import { Translate } from '../../common/i18n';
import { extractKaraokeMakerWaveform } from './makerAnalysis';

interface IUseKaraokeMakerProject {
  song: IKaraokeSong;
  audioFile: File;
  /**
   * Whether to adopt a saved draft, or keep the player's timing and leave the
   * draft one Undo away. Decided by the workspace before the editor mounts.
   */
  restoreSavedDraft: boolean;
  t: Translate;
  /**
   * A whole project arrived from disk rather than from an edit.
   *
   * The view state that is derived from the project text — the lyric editor's
   * draft — has to be re-seeded, and that belongs to the component. This hook
   * says when it happened rather than reaching into state it does not own.
   */
  onProjectAdopted: (project: IKaraokeMakerProject) => void;
}

/** How many steps of history Undo keeps. */
const HISTORY_LIMIT = 80;

/**
 * The project, its history, and the draft on disk — one owner for all three.
 *
 * These were spread through a 7,500-line component: the project state near the
 * top, `commit` a thousand lines below it, undo and redo three hundred lines
 * after that, and the autosave, the restore-on-open and the flush-on-close
 * scattered among twenty unrelated effects. Nothing about that arrangement was
 * wrong line by line, and that is the problem with it — the invariants only
 * exist between the pieces, and the pieces were nowhere near each other.
 *
 * The three that matter, now visible together:
 *
 *  - Every edit goes through `commit`, which stamps `updatedAt` and pushes the
 *    previous project onto the undo stack. Anything calling `setProject`
 *    directly is deliberately skipping history, and there are only two such
 *    places: the waveform decode, which is not an edit, and a whole-project
 *    import, which clears history instead.
 *  - Autosave fires on `updatedAt` changing and nothing else, so a render that
 *    did not edit anything cannot write to disk.
 *  - `HISTORY_LIMIT` used to be the number 79 written out at six call sites,
 *    each as `slice(-79)` on a stack capped at 80. It is one constant now.
 */
export const useKaraokeMakerProject = ({
  song,
  audioFile,
  restoreSavedDraft,
  onProjectAdopted,
  t,
}: IUseKaraokeMakerProject) => {
  const [project, setProject] = useState(() => createKaraokeMakerProject(song));
  const [past, setPast] = useState<IKaraokeMakerProject[]>([]);
  const [future, setFuture] = useState<IKaraokeMakerProject[]>([]);
  const [restoreToast, setRestoreToast] = useState<string>();
  const [draftReady, setDraftReady] = useState(false);
  const projectRef = useRef(project);
  const draftDecisionReadyRef = useRef(false);
  const persistedDraftUpdatedAtRef = useRef<string | undefined>(undefined);

  // Read by the unmount flush, which cannot see the current render's state.
  projectRef.current = project;

  const commit = useCallback(
    (edit: (current: IKaraokeMakerProject) => IKaraokeMakerProject) => {
      setProject((current) => {
        const next = touchKaraokeMakerProject(edit(current));
        setPast((history) => [...history.slice(-(HISTORY_LIMIT - 1)), current]);
        setFuture([]);
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history[history.length - 1];
      if (!previous) {
        return history;
      }
      setProject((current) => {
        setFuture((redoHistory) =>
          [current, ...redoHistory].slice(0, HISTORY_LIMIT),
        );
        return previous;
      });
      return history.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((history) => {
      const next = history[0];
      if (!next) {
        return history;
      }
      setProject((current) => {
        setPast((undoHistory) => [
          ...undoHistory.slice(-(HISTORY_LIMIT - 1)),
          current,
        ]);
        return next;
      });
      return history.slice(1);
    });
  }, []);

  // Flush a genuine edit that the autosave debounce did not reach.
  //
  // A playlist can advance while the 450ms timer is pending. Flush real edits,
  // but never overwrite a recoverable draft merely because the user opened the
  // current player source — which is what `draftDecisionReadyRef` guards.
  useEffect(
    () => () => {
      const latest = projectRef.current;
      if (
        draftDecisionReadyRef.current &&
        latest.updatedAt !== persistedDraftUpdatedAtRef.current
      ) {
        window.electron.ipcRenderer
          .saveKaraokeMakerDraft(latest)
          .then(() => {
            persistedDraftUpdatedAtRef.current = latest.updatedAt;
            return undefined;
          })
          .catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    if (project.analysis.waveform?.length) {
      return undefined;
    }
    let active = true;
    extractKaraokeMakerWaveform(audioFile)
      .then(({ waveform, durationMs: decodedDurationMs }) => {
        if (!active) {
          return undefined;
        }
        setProject((current) => {
          if (current.analysis.waveform?.length) {
            return current;
          }
          return {
            ...current,
            audio: { ...current.audio, durationMs: decodedDurationMs },
            analysis: { ...current.analysis, waveform },
          };
        });
        return waveform;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [audioFile, project.analysis.waveform?.length]);

  useEffect(() => {
    let active = true;
    window.electron.ipcRenderer
      .loadKaraokeMakerDraft(project.id)
      .then((saved) => {
        if (!active || !saved) {
          return undefined;
        }
        const sameAudio =
          saved.id === project.id &&
          saved.audio.name.toLocaleLowerCase() ===
            audioFile.name.toLocaleLowerCase() &&
          (!saved.audio.size ||
            !audioFile.size ||
            saved.audio.size === audioFile.size) &&
          (!saved.audio.lastModified ||
            !audioFile.lastModified ||
            saved.audio.lastModified === audioFile.lastModified);
        if (!sameAudio) {
          return undefined;
        }
        if (restoreSavedDraft) {
          persistedDraftUpdatedAtRef.current = saved.updatedAt;
          setProject(saved);
          onProjectAdopted(saved);
          setRestoreToast(t('karaoke.maker.draftRestored'));
        } else {
          // Keep the saved work one Undo away, but use the player's normalized
          // timing now. This prevents a stale shifted draft from making an
          // existing karaoke look out of sync only inside the Maker.
          persistedDraftUpdatedAtRef.current = projectRef.current.updatedAt;
          setPast([saved]);
          setRestoreToast(t('karaoke.maker.playerTimingLoaded'));
        }
        return saved;
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          draftDecisionReadyRef.current = true;
          setDraftReady(true);
        }
      });
    return () => {
      active = false;
    };
    // The project identity and entry mode are immutable for this keyed editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoreToast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setRestoreToast(undefined), 2_600);
    return () => window.clearTimeout(timeout);
  }, [restoreToast]);

  useEffect(() => {
    if (
      !draftReady ||
      project.updatedAt === persistedDraftUpdatedAtRef.current
    ) {
      return undefined;
    }
    const snapshot = project;
    const timeout = window.setTimeout(() => {
      window.electron.ipcRenderer
        .saveKaraokeMakerDraft(snapshot)
        .then(() => {
          persistedDraftUpdatedAtRef.current = snapshot.updatedAt;
          return undefined;
        })
        .catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [draftReady, project]);

  /**
   * Push a snapshot onto the undo stack without going through `commit`.
   *
   * For edits that build their "before" picture earlier than the moment they
   * apply it — a drag, which snapshots when the pointer goes down, or a
   * transcription, which snapshots before a long asynchronous run. Redo is
   * dropped for the same reason `commit` drops it: a new edit invalidates any
   * future that was branching off the old one.
   */
  const pushHistory = useCallback((snapshot: IKaraokeMakerProject) => {
    setPast((history) => [...history.slice(-(HISTORY_LIMIT - 1)), snapshot]);
    setFuture([]);
  }, []);

  /** For replacing the whole project, where no earlier state still applies. */
  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  /**
   * Throw the editing away and rebuild the project the import produced.
   *
   * Undoable like the other destructive actions: `commit` leaves the discarded
   * work one Undo away, which is what the confirmation promises.
   *
   * The saved draft is deleted rather than left for autosave to overwrite.
   * Autosave does write the pristine project a moment later, but a user who
   * closes the Maker inside that moment would otherwise reopen onto the very
   * work they just discarded.
   *
   * Returns the rebuilt project so the caller can reset its own view state from
   * it — the lyric draft text, the selection — without this hook needing to
   * know those exist.
   */
  const restoreOriginal = useCallback(() => {
    const original = createKaraokeMakerProject(song);
    commit((current) => ({
      ...original,
      // The waveform describes the audio file, not the editing being thrown
      // away. Carrying it over keeps Restore instant instead of blanking the
      // timeline while the same track is decoded a second time.
      audio: { ...original.audio, durationMs: current.audio.durationMs },
      analysis: { ...original.analysis, waveform: current.analysis.waveform },
    }));
    window.electron.ipcRenderer
      .deleteKaraokeMakerDraft(original.id)
      .catch(() => undefined);
    return original;
  }, [commit, song]);

  return {
    project,
    /** Bypasses history on purpose. See the note on this hook. */
    setProject,
    projectRef,
    commit,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pushHistory,
    clearHistory,
    restoreOriginal,
    draftReady,
    restoreToast,
  };
};
