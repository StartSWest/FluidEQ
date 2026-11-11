import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IProjectSource } from 'main/memberScenes/project';
import { useTranslation } from '../utils/I18nContext';
import { bytesOf, useFileMeta } from './codeFileMeta';
import { describeChange } from './lineDiff';
import StudioCodeCard, {
  StudioCodeDelta,
  type IOutsideChange,
} from './StudioCodeCard';
import StudioCodeDiff from './StudioCodeDiff';
import StudioCodeEditor from './StudioCodeEditor';
import { writeStudioSource } from './studioStore';

type TSaveTrouble = 'failed' | 'too-large' | undefined;

const NOTHING = new Set<number>();

interface IStudioCodeSceneProps {
  /** The open project's scene source as it is on disk now. */
  source: IProjectSource;
  problemLines: readonly number[];
  open: boolean;
  onToggle: () => void;
}

/**
 * The scene's own code in the Code tab: the one file that is edited here.
 *
 * Live in both directions. Whatever writes the file — the member's AI, their
 * editor, this pane — the main process reads it on the save and the pane
 * shows it at once, the way the stage replays it. A save from outside marks
 * what it changed: the added lines in green, a red notch where lines went,
 * brought into view, and the whole change as a diff on request. Typed here,
 * the code is the member's until they save it (Save, or Ctrl+S), and a save
 * arriving from elsewhere meanwhile is offered rather than written over
 * their typing.
 *
 * Folded, it keeps what was typed: the text lives here, not in the editor,
 * and the head goes on saying "Not saved" with Save beside it.
 */
export default function StudioCodeScene({
  source,
  problemLines,
  open,
  onToggle,
}: IStudioCodeSceneProps) {
  const { t, locale } = useTranslation();
  const [draft, setDraft] = useState(source.text);
  // The disk text the draft started from: unequal means unsaved typing.
  const [base, setBase] = useState(source.text);
  const [incoming, setIncoming] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [trouble, setTrouble] = useState<TSaveTrouble>();
  const [change, setChange] = useState<IOutsideChange>();
  const [showDiff, setShowDiff] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(base);
  baseRef.current = base;
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

  const diskText = source.text;
  useEffect(() => {
    // What the pane itself just saved coming back, or nothing new.
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

  const wrong = useMemo(() => new Set(problemLines), [problemLines]);
  const dirty = draft !== base;
  const meta = useFileMeta(
    draft,
    useMemo(() => bytesOf(draft), [draft]),
  );
  const timeOf = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  );

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
  const diffShown = showDiff && change !== undefined;

  return (
    <StudioCodeCard
      file={source.file}
      kind="scene"
      open={open}
      onToggle={onToggle}
      meta={meta}
      actions={
        <>
          {/* Folded, the row says only what is news: typing not saved, or a
              save from outside. "Updates as it is saved" and a Save with
              nothing to save are for the file being read. */}
          {(open || dirty || change) && (
            <span
              className={`studio-code__state${dirty ? ' is-dirty' : ''}${change && !dirty ? ' is-changed' : ''}`}
              role="status"
            >
              <span className="studio-code__dot" aria-hidden="true" />
              {status}
            </span>
          )}
          {change && !dirty && (
            <StudioCodeDelta
              change={change}
              showDiff={showDiff}
              onToggle={() => {
                // Asked for on a folded file, the change is what opens.
                if (open) {
                  setShowDiff((was) => !was);
                } else {
                  setShowDiff(true);
                  onToggle();
                }
              }}
            />
          )}
          {(open || dirty) && (
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
        </>
      }
      notices={
        (incoming !== undefined || trouble) && (
          <div className="studio-code__notices">
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
          </div>
        )
      }
    >
      {diffShown ? (
        <StudioCodeDiff lines={change.detail.lines} />
      ) : (
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
    </StudioCodeCard>
  );
}
