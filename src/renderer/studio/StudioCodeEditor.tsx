import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { glslPieces, type IGlslPiece } from './glslTokens';

interface IStudioCodeEditorProps {
  text: string;
  label: string;
  /** Absent for a file that is only shown: nothing typed reaches it. */
  onText?: (text: string) => void;
  onSave?: () => void;
  /** How a line is coloured; the shader's way unless the file is another kind. */
  pieces?: (line: string) => IGlslPiece[];
  /** Lines something is wrong on, in red. */
  wrong: ReadonlySet<number>;
  /** Lines the last outside save added or rewrote, in green. */
  added: ReadonlySet<number>;
  /** Lines with lines removed just above them. */
  removedAbove: ReadonlySet<number>;
  /** A line to bring into view, once per change. */
  reveal?: { id: number; line: number };
}

/** The nearest box above that scrolls up and down: the tab's panel. */
const scrollerOf = (from: HTMLElement): HTMLElement | undefined => {
  for (let box = from.parentElement; box; box = box.parentElement) {
    const { overflowY } = getComputedStyle(box);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return box;
    }
  }
  return undefined;
};

/**
 * The code itself: a textarea over its own highlighted copy. The textarea
 * holds the caret, the selection and the undo history the platform already
 * gives it; the copy under it paints the colours, the problem lines and the
 * lines an outside save just changed.
 *
 * As tall as its text. The Code tab holds every file of the scene, one
 * under another, and the tab's panel is the one thing that scrolls up and
 * down; an editor with a height of its own put a second bar inside the
 * first (Ivan, 2026-09-27: "remove source in studio double scroll"). The
 * height is the line count times the line's height, set in the stylesheet
 * from `--code-lines`, so nothing is measured. A long line still scrolls
 * sideways, inside its own file.
 */
export default function StudioCodeEditor({
  text,
  label,
  onText,
  onSave,
  pieces = glslPieces,
  wrong,
  added,
  removedAbove,
  reveal,
}: IStudioCodeEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paintRef = useRef<HTMLPreElement>(null);

  // One block per line, as many as the textarea has — a text ending in a
  // newline has an empty last line there too — so the two line up.
  const lines = useMemo(
    () =>
      text.split('\n').map((line, number) => ({
        number: number + 1,
        pieces: pieces(line).map((piece, at) => ({ ...piece, at })),
      })),
    [text, pieces],
  );
  const lastLine = lines.length;

  const follow = useCallback(() => {
    if (inputRef.current && paintRef.current) {
      paintRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  // An outside save lands where the member can see it — unless they are
  // typing in the pane, where moving the view would move it out from under
  // their caret. The panel is what scrolls, so the panel is what is moved,
  // and only it: `scrollIntoView` would also move every box above.
  const revealId = reveal?.id;
  const revealLine = reveal?.line;
  useEffect(() => {
    const row = paintRef.current?.children[(revealLine ?? 0) - 1];
    if (!row || document.activeElement === inputRef.current) {
      return;
    }
    const scroller = scrollerOf(row as HTMLElement);
    const file = paintRef.current?.getBoundingClientRect();
    if (!scroller || !file) {
      return;
    }
    // Only a file already on screen is moved to its change. The tab holds
    // several, and one saved while another is being read must not pull the
    // reader away from it: its head says it changed.
    const view = scroller.getBoundingClientRect();
    if (file.bottom <= view.top || file.top >= view.bottom) {
      return;
    }
    scroller.scrollTop +=
      row.getBoundingClientRect().top - view.top - scroller.clientHeight / 3;
  }, [revealId, revealLine]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      onSave?.();
      return;
    }
    // Tab indents, as in any code editor; Escape gives the key back to the
    // page so the keyboard can leave the pane. A file only shown keeps Tab
    // for what it does everywhere else: moving on.
    if (event.key === 'Tab' && !event.shiftKey && onText) {
      event.preventDefault();
      event.currentTarget.setRangeText(
        '  ',
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd,
        'end',
      );
      onText(event.currentTarget.value);
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  const lineClass = (number: number) =>
    [
      wrong.has(number) && 'is-wrong',
      added.has(number) && 'is-added',
      removedAbove.has(number) && 'is-cut-above',
      number === lastLine && removedAbove.has(lastLine + 1) && 'is-cut-below',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div
      className={`studio-code__editor${onText ? '' : ' is-view-only'}`}
      style={{ '--code-lines': lastLine } as CSSProperties}
    >
      <div className="studio-code__gutter" aria-hidden="true">
        {lines.map((line) => (
          <span
            key={line.number}
            className={lineClass(line.number) || undefined}
          >
            {line.number}
          </span>
        ))}
      </div>
      <div className="studio-code__area">
        <pre ref={paintRef} className="studio-code__paint" aria-hidden="true">
          {lines.map((line) => (
            <span
              // A new outside change remakes the rows, so a line it touched
              // again lights up again rather than keeping last time's tint.
              key={`${revealId ?? 0}:${line.number}`}
              className={`studio-code__line ${lineClass(line.number)}`}
            >
              {line.pieces.map((piece) => (
                <span
                  key={piece.at}
                  className={`studio-code__glsl studio-code__glsl--${piece.kind}`}
                >
                  {piece.text}
                </span>
              ))}
              {/* An empty block has no height; a space gives it one. */}
              {line.pieces.length === 0 && ' '}
            </span>
          ))}
        </pre>
        <textarea
          ref={inputRef}
          className="studio-code__input"
          aria-label={label}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          readOnly={!onText}
          value={text}
          onChange={(event) => onText?.(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={follow}
        />
      </div>
    </div>
  );
}
