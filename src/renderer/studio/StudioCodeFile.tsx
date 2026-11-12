import { useEffect, useMemo, useRef, useState } from 'react';
import type { IProjectCodeFile } from 'main/memberScenes/projectCode';
import { useTranslation } from '../utils/I18nContext';
import { useFileMeta, useFileSize } from './codeFileMeta';
import { glslPieces } from './glslTokens';
import jsonPieces from './jsonTokens';
import { describeChange } from './lineDiff';
import StudioCodeCard, {
  StudioCodeDelta,
  type IOutsideChange,
} from './StudioCodeCard';
import StudioCodeDiff from './StudioCodeDiff';
import StudioCodeEditor from './StudioCodeEditor';

const NOTHING = new Set<number>();

interface IStudioCodeFileProps {
  file: IProjectCodeFile;
  open: boolean;
  onToggle: () => void;
}

/**
 * A file of the scene that the Code tab shows and does not edit: `pack.json`,
 * a file too large to show, and every file of a scene that is not the
 * member's - one of FluidEQ's own, or a copy of another member's.
 *
 * Shown as it is on disk, and live like the scene's own file: when the
 * member's AI or their editor saves it, the head says when, how many lines
 * came and went, and offers the change as a diff, and the lines that came
 * are lit in the file. That is what the tab is for with these files - they
 * are where a 3D scene keeps most of itself, and what the AI did to them
 * could not be read anywhere in FluidEQ.
 */
export default function StudioCodeFile({
  file,
  open,
  onToggle,
}: IStudioCodeFileProps) {
  const { t, locale } = useTranslation();
  const [change, setChange] = useState<IOutsideChange>();
  const [showDiff, setShowDiff] = useState(false);
  const lastRef = useRef(file.text);
  const changesRef = useRef(0);

  const { text } = file;
  useEffect(() => {
    const before = lastRef.current;
    lastRef.current = text;
    // The first text is the file as it is; so is one that grew too large to
    // show, or came back from being so.
    if (before === undefined || text === undefined || before === text) {
      return;
    }
    const detail = describeChange(before, text);
    changesRef.current += 1;
    setChange(
      detail ? { id: changesRef.current, at: new Date(), detail } : undefined,
    );
  }, [text]);

  const meta = useFileMeta(text, file.bytes);
  const size = useFileSize();
  const timeOf = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [locale],
  );
  const pieces = /\.json$/i.test(file.file) ? jsonPieces : glslPieces;
  const diffShown = showDiff && change !== undefined;

  return (
    <StudioCodeCard
      file={file.file}
      kind={file.role}
      open={open}
      onToggle={onToggle}
      meta={meta}
      actions={
        <>
          {change && (
            <>
              <span className="studio-code__state is-changed">
                <span className="studio-code__dot" aria-hidden="true" />
                {t('studio.code.updatedAt', {
                  time: timeOf.format(change.at),
                })}
              </span>
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
            </>
          )}
          {open && (
            <span
              className="studio-code__view-only"
              title={t('studio.code.viewOnlyHint')}
            >
              {t('studio.code.viewOnly')}
            </span>
          )}
        </>
      }
    >
      {text === undefined && (
        <p className="studio-code__missing">
          {t('studio.code.tooLargeToShow', { size: size(file.bytes) })}
        </p>
      )}
      {text !== undefined && diffShown && (
        <StudioCodeDiff lines={change.detail.lines} pieces={pieces} />
      )}
      {text !== undefined && !diffShown && (
        <StudioCodeEditor
          text={text}
          label={t('studio.code.label', { file: file.file })}
          pieces={pieces}
          wrong={NOTHING}
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
