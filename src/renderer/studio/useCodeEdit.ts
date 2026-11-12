import { useCallback, useEffect, useRef, useState } from 'react';
import type { ICodeProblem } from 'main/memberScenes/projectCodeDraft';
import {
  canRedo,
  canUndo,
  recordText,
  redo,
  shownText,
  startHistory,
  undo,
} from './codeHistory';
import { dropCodeDraft, showCodeDraft } from './codeDraftStore';
import { describeChange } from './lineDiff';
import type { IOutsideChange } from './StudioCodeCard';
import { checkStudioCode, writeStudioCode } from './studioStore';

export type TCodeTrouble = 'failed' | 'not-editable';

/** What a check said of one text: nothing wrong, or every reason. */
interface IChecked {
  text: string;
  problems: readonly ICodeProblem[];
}

/**
 * One Code tab file being edited (the mockup Ivan approved on 2026-11-11):
 * a draft with its own Undo and Redo, never saved by itself; checked by
 * main against the rules every save goes through as it is typed, and played
 * on the stage once it passes (`codeDraftStore.ts`); written only by Save,
 * and only a text that passed.
 *
 * Checks run one at a time, and the newest text is the one checked next: a
 * check answers in tens of milliseconds, and typing faster than that would
 * otherwise put a stale answer over a newer one. No clock decides when to
 * check - each answer starts the next.
 *
 * Live like the shader always was: a save from outside the tab - the
 * member's AI, their editor - is taken at once while nothing is typed, and
 * offered rather than written over typing that is not saved.
 */
export default function useCodeEdit(
  projectId: string,
  file: string,
  diskText: string,
) {
  const [history, setHistory] = useState(() => startHistory(diskText));
  // The disk text the draft started from: unequal means unsaved typing.
  const [base, setBase] = useState(diskText);
  const [incoming, setIncoming] = useState<string>();
  const [change, setChange] = useState<IOutsideChange>();
  const [checked, setChecked] = useState<IChecked>();
  const [saving, setSaving] = useState(false);
  const [trouble, setTrouble] = useState<TCodeTrouble>();
  const draft = shownText(history);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(base);
  baseRef.current = base;
  const changesRef = useRef(0);
  const pendingRef = useRef<string | undefined>(undefined);
  const runningRef = useRef(false);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      dropCodeDraft(projectId, file);
    };
  }, [projectId, file]);

  const adoptOutside = useCallback((before: string, after: string) => {
    const detail = describeChange(before, after);
    changesRef.current += 1;
    setChange(
      detail ? { id: changesRef.current, at: new Date(), detail } : undefined,
    );
    setHistory((now) => recordText(now, after));
    setBase(after);
    setIncoming(undefined);
  }, []);

  useEffect(() => {
    // What the tab itself just saved coming back, or nothing new.
    if (diskText === draftRef.current) {
      setBase(diskText);
      setIncoming(undefined);
      return;
    }
    if (draftRef.current === baseRef.current) {
      adoptOutside(baseRef.current, diskText);
      return;
    }
    setIncoming(diskText);
  }, [diskText, adoptOutside]);

  const checkNewest = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    try {
      while (pendingRef.current !== undefined && liveRef.current) {
        const text = pendingRef.current;
        pendingRef.current = undefined;
        // eslint-disable-next-line no-await-in-loop -- one check at a time is the point
        const answer = await checkStudioCode(file, text);
        // A newer text is waiting, or the file was left: this answer is old.
        if (pendingRef.current === undefined && liveRef.current) {
          if (answer.ok) {
            setChecked({ text, problems: [] });
            if (answer.pack) {
              showCodeDraft(projectId, file, answer.pack);
            }
          } else if ('problems' in answer) {
            setChecked({ text, problems: answer.problems });
          } else {
            setTrouble('not-editable');
          }
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [projectId, file]);

  useEffect(() => {
    if (draft === base) {
      pendingRef.current = undefined;
      setChecked(undefined);
      dropCodeDraft(projectId, file);
      return;
    }
    pendingRef.current = draft;
    checkNewest().catch(() => setTrouble('failed'));
  }, [draft, base, projectId, file, checkNewest]);

  const dirty = draft !== base;
  const isChecked = checked?.text === draft;
  const problems = isChecked ? checked.problems : [];

  const type = (text: string) => {
    setHistory((now) => recordText(now, text));
    setTrouble(undefined);
    // Typing moves the lines the marks were counted against.
    setChange(undefined);
  };

  /**
   * Saves the draft, when it is one a check passed. `compileFailed`: the
   * stage could not compile it, which only the stage knows.
   */
  const save = (compileFailed = false) => {
    if (
      saving ||
      !dirty ||
      !isChecked ||
      problems.length > 0 ||
      compileFailed
    ) {
      return;
    }
    const text = draft;
    setSaving(true);
    setTrouble(undefined);
    writeStudioCode(file, text)
      .then((outcome) => {
        if (outcome === 'written') {
          // The draft is what is saved now: it stops playing as a draft.
          setBase(text);
          setIncoming(undefined);
        } else if (typeof outcome === 'object') {
          setChecked({ text, problems: outcome.problems });
        } else {
          setTrouble(outcome);
        }
        return undefined;
      })
      .catch(() => setTrouble('failed'))
      .finally(() => setSaving(false));
  };

  return {
    draft,
    base,
    dirty,
    /** A check of the newest text is still on its way. */
    checking: dirty && !isChecked,
    problems,
    incoming,
    change,
    saving,
    trouble,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    type,
    save,
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    /** Back to the file as it is on disk; one more step, so Undo brings it back. */
    discard: () => setHistory((now) => recordText(now, baseRef.current)),
    loadIncoming: () => {
      if (incoming !== undefined) {
        adoptOutside(base, incoming);
      }
    },
    keepMine: () => {
      if (incoming !== undefined) {
        setBase(incoming);
        setIncoming(undefined);
      }
    },
    forgetChange: () => setChange(undefined),
  };
}
