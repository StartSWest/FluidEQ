import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { IMemberSceneProblem } from 'common/memberScenes';
import type { IProjectSource } from 'main/memberScenes/project';
import { useTranslation } from '../utils/I18nContext';
import { describeChange, type ILineChange } from './lineDiff';
import StudioCodeDiff from './StudioCodeDiff';
import StudioCodeEditor from './StudioCodeEditor';
import { writeStudioSource } from './studioStore';
import '../styles/StudioCode.scss';

const OPEN_KEY = 'fluideq.studio.codeOpen';

/** Whether the pane was left open; open the first time, and wherever storage is refused. */
const readOpen = () => {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

const writeOpen = (open: boolean) => {
  try {
    window.localStorage.setItem(OPEN_KEY, String(open));
  } catch {
    // Only the pane's remembered state is lost; it opens next time.
  }
};

/**
 * The source lines something is wrong on: the rules' own line numbers, and
 * the driver's `ERROR: 0:<line>` from a failed compile, which the stage has
 * already moved to point into the author's file.
 */
export const problemLinesOf = (
  problems: readonly IMemberSceneProblem[] | undefined,
  compileLog: string | undefined,
): number[] => {
  const lines = new Set<number>();
  problems?.forEach((problem) => {
    if (problem.file === 'source' && problem.line) {
      lines.add(problem.line);
    }
  });
  compileLog?.replace(/ERROR:\s*\d+:(\d+)/g, (match, line: string) => {
    lines.add(Number(line));
    return match;
  });
  return [...lines];
};

type TSaveTrouble = 'failed' | 'too-large' | undefined;

/** The last save that came from outside the pane, and what it changed. */
interface IOutsideChange {
  id: number;
  at: Date;
  detail: ILineChange;
}

const NOTHING = new Set<number>();

interface IStudioCodeProps {
  /** The open project's scene source as it is on disk now. */
  source: IProjectSource | undefined;
  problemLines: readonly number[];
}

/**
 * The open project's scene code, beside the stage it becomes.
 *
 * Live in both directions. Whatever writes the file — the member's AI, their
 * editor, this pane — the main process reads it on the save and the pane
 * shows it at once, the way the stage replays it. A save from outside marks
 * what it changed: the added lines in green, a red notch where lines went,
 * brought into view, and the whole change as a diff on request. Typed here,
 * the code is the member's until they save it (Save, or Ctrl+S), and a save
 * arriving from elsewhere meanwhile is offered rather than written over
 * their typing.
 */
export default function StudioCode({ source, problemLines }: IStudioCodeProps) {
  const { t, locale } = useTranslation();
  const bodyId = useId();
  const [open, setOpen] = useState(readOpen);
  const [draft, setDraft] = useState(source?.text ?? '');
  // The disk text the draft started from: unequal means unsaved typing.
  const [base, setBase] = useState(source?.text ?? '');
  const [incoming, setIncoming] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [trouble, setTrouble] = useState<TSaveTrouble>();
  const [change, setChange] = useState<IOutsideChange>();
  const [showDiff, setShowDiff] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(base);
  baseRef.current = base;
  // Whether a disk text has been shown yet: the first one is the file as it
  // is, not a change to it.
  const seenRef = useRef(source !== undefined);
  const changesRef = useRef(0);

  const adoptOutside = useCallback((before: string, after: string) => {
    const detail = describeChange(before, after);
    changesRef.current += 1;
    setChange(
      detail ? { id: changesRef.current, at: new Date(), detail } : undefined,
    );
    setDraft(after);
    setBase(after);
    setIncoming(undefined);
  }, []);

  const diskText = source?.text;
  useEffect(() => {
    if (diskText === undefined) {
      return;
    }
    const seen = seenRef.current;
    seenRef.current = true;
    // What the pane itself just saved coming back, or nothing new.
    if (diskText === draftRef.current) {
      setBase(diskText);
      setIncoming(undefined);
      return;
    }
    if (draftRef.current === baseRef.current) {
      if (seen) {
        adoptOutside(baseRef.current, diskText);
      } else {
        setDraft(diskText);
        setBase(diskText);
      }
      return;
    }
    setIncoming(diskText);
  }, [diskText, adoptOutside]);

  const wrong = useMemo(() => new Set(problemLines), [problemLines]);
  const dirty = draft !== base;
  const timeOf = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  );

  const toggle = () => {
    setOpen((was) => {
      writeOpen(!was);
      return !was;
    });
  };

  const type = (text: string) => {
    setDraft(text);
    // Typing moves the lines the marks were counted against.
    setChange(undefined);
    setShowDiff(false);
  };

  const save = () => {
    if (saving || !dirty) {
      return;
    }
    const text = draft;
    setSaving(true);
    setTrouble(undefined);
    writeStudioSource(text)
      .then((outcome) => {
        if (outcome === 'written') {
          setBase(text);
          setIncoming(undefined);
        } else {
          setTrouble(outcome);
        }
        return undefined;
      })
      .catch(() => setTrouble('failed'))
      .finally(() => setSaving(false));
  };

  let status = t('studio.code.watching');
  if (dirty) {
    status = t('studio.code.unsaved');
  } else if (change) {
    status = t('studio.code.updatedAt', { time: timeOf.format(change.at) });
  }

  return (
    <section className="studio-card studio-code">
      <div className="studio-code__head">
        <button
          type="button"
          className="studio-code__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
          <span className="studio-code__title">{t('studio.code.title')}</span>
          {source && <span className="studio-code__file">{source.file}</span>}
        </button>
        {source && (
          <span
            className={`studio-code__state${dirty ? ' is-dirty' : ''}${change && !dirty ? ' is-changed' : ''}`}
            role="status"
          >
            <span className="studio-code__dot" aria-hidden="true" />
            {status}
          </span>
        )}
        {open && change && !dirty && (
          <>
            <span
              className="studio-code__delta"
              title={t('studio.code.delta', {
                added: change.detail.addedCount,
                removed: change.detail.removedCount,
              })}
            >
              <span className="studio-code__delta-add">
                +{change.detail.addedCount}
              </span>
              <span className="studio-code__delta-remove">
                −{change.detail.removedCount}
              </span>
            </span>
            <button
              type="button"
              className="button small subtle"
              aria-pressed={showDiff}
              onClick={() => setShowDiff((was) => !was)}
            >
              {showDiff
                ? t('studio.code.showCode')
                : t('studio.code.showChanges')}
            </button>
          </>
        )}
        {open && source && (
          <button
            type="button"
            className={`button small${saving ? ' is-running' : ''}`}
            aria-busy={saving}
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? t('studio.code.saving') : t('studio.code.save')}
          </button>
        )}
      </div>

      {open && (
        <div id={bodyId} className="studio-code__body">
          {incoming !== undefined && (
            <div className="studio-code__incoming" role="alert">
              <span>{t('studio.code.changed')}</span>
              <button
                type="button"
                className="button small"
                onClick={() => adoptOutside(base, incoming)}
              >
                {t('studio.code.load')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setBase(incoming);
                  setIncoming(undefined);
                }}
              >
                {t('studio.code.keep')}
              </button>
            </div>
          )}
          {trouble && (
            <p className="studio-code__trouble" role="alert">
              {t(
                trouble === 'too-large'
                  ? 'studio.code.tooLarge'
                  : 'studio.code.failed',
              )}
            </p>
          )}
          {source && showDiff && change && (
            <StudioCodeDiff lines={change.detail.lines} />
          )}
          {source && !(showDiff && change) && (
            <StudioCodeEditor
              text={draft}
              label={t('studio.code.label', { file: source.file })}
              onText={type}
              onSave={save}
              wrong={wrong}
              added={change?.detail.added ?? NOTHING}
              removedAbove={change?.detail.removedAbove ?? NOTHING}
              reveal={
                change
                  ? { id: change.id, line: change.detail.firstLine }
                  : undefined
              }
            />
          )}
          {!source && (
            <p className="studio-code__missing">{t('studio.code.missing')}</p>
          )}
        </div>
      )}
    </section>
  );
}
