import { useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { TProjectCodeRole } from 'main/memberScenes/projectCode';
import type { ICodeProblem } from 'main/memberScenes/projectCodeDraft';
import { useTranslation } from '../utils/I18nContext';
import { bytesOf, useFileMeta } from './codeFileMeta';
import { glslPieces } from './glslTokens';
import jsonPieces from './jsonTokens';
import StudioCodeCard, { StudioCodeDelta } from './StudioCodeCard';
import StudioCodeDiff from './StudioCodeDiff';
import StudioCodeEditor from './StudioCodeEditor';
import StudioCodeWhy from './StudioCodeWhy';
import useCodeEdit from './useCodeEdit';

const NOTHING = new Set<number>();

/** Why the stage could not compile the draft it was handed, and where. */
export interface ICodeCompileFailure {
  lines: readonly number[];
  message: string;
}

interface IStudioCodeEditableProps {
  projectId: string;
  file: string;
  kind: TProjectCodeRole;
  /** The file as it is on disk now. */
  diskText: string;
  open: boolean;
  onToggle: () => void;
  /** Lines the last build of the saved file found wrong (the shader's). */
  savedWrong?: readonly number[];
  /** The stage's compile of the draft failed (the shader's). */
  compile?: ICodeCompileFailure;
}

/** A problem's reason, in the words the problem list under the stage uses. */
const reasonKey = (problem: ICodeProblem): TranslationKey => {
  if (problem.code === 'bad-json') {
    return 'studio.code.badJson';
  }
  if (problem.code === 'bad-animation') {
    return 'studio.code.badAnimation';
  }
  return `studio.problem.${problem.code}` as TranslationKey;
};

/**
 * A file of the scene edited in the Code tab: the shader, the world, a
 * material, an animation (the mockup Ivan approved on 2026-11-11: "Every
 * file of the scene that is its code gets the editor the shader already
 * has").
 *
 * A draft until Save, with Undo, Redo and Discard (`useCodeEdit.ts`). It is
 * checked as it is typed by the rules every save of the folder goes
 * through, and Save waits for a check that passed: a line found wrong turns
 * red with its reason in words over the file, and nothing is written until
 * it is fixed. A draft that passes plays on the stage before it is saved;
 * one the stage cannot compile says so and is not saved either.
 */
export default function StudioCodeEditable({
  projectId,
  file,
  kind,
  diskText,
  open,
  onToggle,
  savedWrong,
  compile,
}: IStudioCodeEditableProps) {
  const { t, locale } = useTranslation();
  const edit = useCodeEdit(projectId, file, diskText);
  const [showDiff, setShowDiff] = useState(false);
  // Brings a problem's line into view when its reason is pressed.
  const [revealed, setRevealed] = useState<{ id: number; line: number }>();
  const { draft, dirty, problems, change } = edit;
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
  const pieces = /\.json$/i.test(file) ? jsonPieces : glslPieces;
  // A compile is of the last draft that passed the rules, so it speaks for
  // the draft only while the draft is that text's.
  const compileFailed = dirty && compile !== undefined && !edit.checking;
  const wrong = useMemo(() => {
    if (!dirty) {
      return new Set(savedWrong ?? []);
    }
    const lines = new Set(
      problems.flatMap((problem) => (problem.line ? [problem.line] : [])),
    );
    if (compileFailed) {
      compile.lines.forEach((line) => lines.add(line));
    }
    return lines;
  }, [dirty, savedWrong, problems, compileFailed, compile]);
  const blocked = problems.length > 0 || compileFailed;
  const ready = dirty && !edit.checking && !blocked;

  let status = t('studio.code.watching');
  let tone = '';
  if (dirty && edit.checking) {
    status = t('studio.code.checking');
    tone = ' is-dirty';
  } else if (dirty && blocked) {
    status =
      problems.length > 1
        ? t('studio.code.problems', { count: problems.length })
        : t(
            compileFailed && problems.length === 0
              ? 'studio.code.noCompile'
              : 'studio.code.problemOne',
          );
    tone = ' is-wrong';
  } else if (dirty) {
    status = t('studio.code.ready');
    tone = ' is-dirty';
  } else if (change) {
    status = t('studio.code.updatedAt', { time: timeOf.format(change.at) });
    tone = ' is-changed';
  }
  const diffShown = showDiff && change !== undefined;
  const save = () => edit.save(compileFailed);

  return (
    <StudioCodeCard
      file={file}
      kind={kind}
      open={open}
      onToggle={onToggle}
      meta={meta}
      actions={
        <>
          {/* Folded, the row says only what is news: a draft, or a save from
              outside. The rest is for the file being read. */}
          {(open || dirty || change) && (
            <span className={`studio-code__state${tone}`} role="status">
              <span className="studio-code__dot" aria-hidden="true" />
              {status}
            </span>
          )}
          {change && !dirty && (
            <StudioCodeDelta
              change={change}
              showDiff={showDiff}
              onToggle={() => {
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
            <span className="studio-code__edit-actions">
              <button
                type="button"
                className="button small subtle"
                disabled={!edit.canUndo}
                title={`${t('studio.code.undo')} (Ctrl+Z)`}
                onClick={edit.undo}
              >
                {t('studio.code.undo')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={!edit.canRedo}
                title={`${t('studio.code.redo')} (Ctrl+Y)`}
                onClick={edit.redo}
              >
                {t('studio.code.redo')}
              </button>
              <button
                type="button"
                className={`button small${edit.saving ? ' is-running' : ''}`}
                aria-busy={edit.saving}
                disabled={!ready || edit.saving}
                title={blocked ? t('studio.code.saveBlocked') : 'Ctrl+S'}
                onClick={save}
              >
                {edit.saving ? t('studio.code.saving') : t('studio.code.save')}
              </button>
              {dirty && (
                <button
                  type="button"
                  className="button small subtle"
                  onClick={edit.discard}
                >
                  {t('studio.code.discard')}
                </button>
              )}
            </span>
          )}
          {/* In the head, which stays at the tab's top while the file is
              scrolled through: below it, the reason scrolled away while the
              red line it explains was still being read. */}
          {dirty && blocked && !edit.checking && (
            <StudioCodeWhy
              reasons={[
                ...problems.map((problem) => ({
                  ...(problem.line ? { line: problem.line } : {}),
                  text: t(reasonKey(problem)),
                })),
                ...(compileFailed && problems.length === 0
                  ? [
                      {
                        ...(compile.lines.length > 0
                          ? { line: compile.lines[0] }
                          : {}),
                        text: t('studio.code.compileError', {
                          detail: compile.message,
                        }),
                      },
                    ]
                  : []),
              ]}
              onLine={(line) =>
                setRevealed((was) => ({ id: (was?.id ?? 0) + 1, line }))
              }
            />
          )}
        </>
      }
      notices={
        (edit.incoming !== undefined || edit.trouble) && (
          <div className="studio-code__notices">
            {edit.incoming !== undefined && (
              <div className="studio-code__incoming" role="alert">
                <span>{t('studio.code.changed')}</span>
                <button
                  type="button"
                  className="button small"
                  onClick={edit.loadIncoming}
                >
                  {t('studio.code.load')}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={edit.keepMine}
                >
                  {t('studio.code.keep')}
                </button>
              </div>
            )}
            {edit.trouble && (
              <p className="studio-code__trouble" role="alert">
                {t(
                  edit.trouble === 'not-editable'
                    ? 'studio.code.notEditable'
                    : 'studio.code.failed',
                )}
              </p>
            )}
          </div>
        )
      }
    >
      {diffShown ? (
        <StudioCodeDiff lines={change.detail.lines} pieces={pieces} />
      ) : (
        <StudioCodeEditor
          text={draft}
          label={t('studio.code.label', { file })}
          pieces={pieces}
          onText={(text) => {
            edit.type(text);
            setShowDiff(false);
          }}
          onSave={save}
          onUndo={edit.undo}
          onRedo={edit.redo}
          wrong={wrong}
          added={change?.detail.added ?? NOTHING}
          removedAbove={change?.detail.removedAbove ?? NOTHING}
          reveal={
            revealed ??
            (change
              ? { id: change.id, line: change.detail.firstLine }
              : undefined)
          }
        />
      )}
      {dirty && (
        <p className="studio-code__foot">
          <span>{t('studio.code.checkedBy')}</span>
          {kind !== 'animation' && <span>{t('studio.code.playsDraft')}</span>}
        </p>
      )}
    </StudioCodeCard>
  );
}
