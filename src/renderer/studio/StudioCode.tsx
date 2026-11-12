import { useEffect, useMemo, useRef, useState } from 'react';
import type { IMemberSceneProblem } from 'common/memberScenes';
import type { IProjectSource } from 'main/memberScenes/project';
import type { IProjectCodeFile } from 'main/memberScenes/projectCode';
import { useTranslation } from '../utils/I18nContext';
import { openFilesOf, rememberOpenFiles } from './codeOpenFiles';
import StudioCodeFile from './StudioCodeFile';
import StudioCodeNotes from './StudioCodeNotes';
import StudioCodeScene from './StudioCodeScene';
import { readStudioProjectCode, useStudio } from './studioStore';
import '../styles/StudioCode.scss';

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

interface IStudioCodeProps {
  /** The open project, so what is open in the tab is remembered for it. */
  projectId?: string;
  /** The open project's scene source as it is on disk now. */
  source: IProjectSource | undefined;
  problemLines: readonly number[];
  /**
   * Whether the scene is the member's to change: not one of FluidEQ's own
   * or a copy of another member's, opened to look inside.
   */
  editable: boolean;
}

/**
 * The open project's code, beside the stage it becomes: every file of it,
 * one under another, each folding to its name.
 *
 * It showed the scene's shader and nothing else (Ivan, 2026-11-11: "code
 * only show scene frag, it needs to show the full code, all files, and
 * expand collapse on each"). A scene with a 3D world keeps most of itself
 * in `world.json` and its materials' files, and all of it is here now: the
 * shader first and open, edited as before (`StudioCodeScene`), the rest
 * shown as they are on disk (`StudioCodeFile`).
 *
 * A scene with several files opens as the list of them, every one folded.
 * Its shader runs to a thousand lines and more, and open it stood between
 * the member and every other file, so the tab looked exactly as it did when
 * it had the one. The list is also where a change is seen first: each file
 * says when it was last written from outside and by how much. A scene that
 * is one file shows that file, as it always did, and what a member opens or
 * folds is kept for the project (`codeOpenFiles.ts`).
 *
 * The files are read again whenever the Studio hears of the project - a
 * save, a build - and whenever the window is come back to, which is when a
 * member returns from their own editor. A file is known by its name, so one
 * that is open stays open, and keeps its marks, across every read.
 */
export default function StudioCode({
  projectId,
  source,
  problemLines,
  editable,
}: IStudioCodeProps) {
  const { t } = useTranslation();
  const view = useStudio();
  // Not known until the first read answers. Nothing is drawn before it: a
  // shader shown open and folded a moment later, when its other files are
  // heard of, is a thousand lines flashing past.
  const [files, setFiles] = useState<readonly IProjectCodeFile[]>();
  const [open, setOpen] = useState(() => openFilesOf(projectId));
  // Whether the scene was one file when the tab came up, settled by the
  // first read and never again: a shader being read must not fold itself
  // because the member's AI has just written the scene a second file.
  const [alone, setAlone] = useState<boolean>();
  const [focused, setFocused] = useState(0);
  const asked = useRef(0);

  useEffect(() => {
    const again = () => setFocused((count) => count + 1);
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, []);

  useEffect(() => {
    asked.current += 1;
    const mine = asked.current;
    const take = (list: readonly IProjectCodeFile[]) => {
      // Only the newest answer: two saves a moment apart are two reads,
      // and the first may come back last.
      if (mine === asked.current) {
        setFiles(list);
        setAlone((was) => was ?? list.every((file) => file.role === 'scene'));
      }
    };
    readStudioProjectCode()
      .then((list) => {
        take(list);
        return undefined;
      })
      // Unread, the scene's own file is still shown: it comes another way.
      .catch(() => take([]));
    // `view` is a new object for everything the Studio hears of the project.
  }, [view, focused]);

  // The scene's own file is the live one the Studio is sent on every save;
  // the read's copy of it only says where it stands among the others.
  const others = useMemo(
    () => (files ?? []).filter((file) => file.role !== 'scene'),
    [files],
  );
  const names = useMemo(
    () => [...(source ? [source.file] : []), ...others.map((f) => f.file)],
    [source, others],
  );
  const isOpen = (file: string) =>
    open ? open.has(file) : alone === true && file === source?.file;
  const remember = (next: ReadonlySet<string>) => {
    setOpen(next);
    rememberOpenFiles(projectId, next);
  };
  const toggle = (file: string) => {
    const next = new Set(names.filter(isOpen));
    if (!next.delete(file)) {
      next.add(file);
    }
    remember(next);
  };
  const openCount = names.filter(isOpen).length;

  return (
    <section className="studio-card studio-code">
      <div className="studio-code__head">
        <h3 className="studio-code__heading">
          <span className="studio-code__title">{t('studio.code.title')}</span>
          {names.length > 1 && (
            <span className="studio-code__count" aria-hidden="true">
              {names.length}
            </span>
          )}
        </h3>
        {names.length > 1 && (
          <div className="studio-code__fold-all">
            <button
              type="button"
              className="button small subtle"
              disabled={openCount === names.length}
              onClick={() => remember(new Set(names))}
            >
              {t('studio.code.expandAll')}
            </button>
            <button
              type="button"
              className="button small subtle"
              disabled={openCount === 0}
              onClick={() => remember(new Set())}
            >
              {t('studio.code.collapseAll')}
            </button>
          </div>
        )}
      </div>

      <div className="studio-code__files">
        {source && files !== undefined && (
          <StudioCodeScene
            source={source}
            problemLines={problemLines}
            open={isOpen(source.file)}
            onToggle={() => toggle(source.file)}
          />
        )}
        {others.map((file) =>
          file.role === 'notes' && projectId ? (
            <StudioCodeNotes
              key={file.file}
              projectId={projectId}
              file={file}
              open={isOpen(file.file)}
              onToggle={() => toggle(file.file)}
              editable={editable}
              // Written by the notes' own writer, which the Studio does not
              // hear of: the tab reads its files again at once.
              onSaved={() => setFocused((count) => count + 1)}
            />
          ) : (
            <StudioCodeFile
              key={file.file}
              file={file}
              open={isOpen(file.file)}
              onToggle={() => toggle(file.file)}
            />
          ),
        )}
        {names.length === 0 && files !== undefined && (
          <p className="studio-code__missing">{t('studio.code.missing')}</p>
        )}
      </div>
    </section>
  );
}
